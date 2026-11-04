import os
import json
import hashlib
import urllib.request
import urllib.error
import tempfile
from urllib.parse import urlparse, unquote
from uuid import uuid4
from inference_sdk import InferenceHTTPClient, InferenceConfiguration

import psycopg
from psycopg.rows import dict_row
from supabase import create_client

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# CONFIGURATION
DATABASE_URL = os.environ["DATABASE_URL"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

BUCKET_NAME = "batik-photos"
SIGNER_URL = os.getenv(
    "SIGNER_URL",
    "http://127.0.0.1:8765/record"
)

MAX_PHOTO_SIZE = 10 * 1024 * 1024

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Sistem Verifikasi Batik")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://batik-verifikasi.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# DATABASE
def connect_db():
    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )
@app.get("/api/local-knowledge")
def list_local_knowledge():
    try:
        with connect_db() as conn:
            rows = conn.execute(
                "SELECT * FROM local_knowledge ORDER BY id ASC"
            ).fetchall()
        return {"knowledge": rows}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil pengetahuan lokal: {exc}"
        )


@app.get("/api/ai-knowledge")
def list_ai_knowledge():
    try:
        with connect_db() as conn:
            rows = conn.execute(
                "SELECT * FROM ai_knowledge ORDER BY id ASC"
            ).fetchall()
        return {"knowledge": rows}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil pengetahuan AI: {exc}"
        )

@app.get("/")
def home():
    return {"status": "ok", "message": "API Batik aktif"}


@app.get("/api/health")
def health():
    try:
        with connect_db() as conn:
            conn.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as exc:
        raise HTTPException(500, f"Database error: {exc}")


@app.get("/api/products")
def list_products():
    try:
        with connect_db() as conn:
            rows = conn.execute(
                "SELECT * FROM products ORDER BY id DESC"
            ).fetchall()

        return {"products": rows}
    except Exception as exc:
        raise HTTPException(500, f"Gagal mengambil produk: {exc}")


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    artisan: str = Field(min_length=1, max_length=150)
    origin: str = Field(min_length=1, max_length=150)
    technique: str = Field(min_length=1, max_length=150)
    motif: str = Field(min_length=1, max_length=150)


@app.post("/api/products", status_code=201)
def create_product(product: ProductCreate):
    values = [
        product.name.strip(),
        product.artisan.strip(),
        product.origin.strip(),
        product.technique.strip(),
        product.motif.strip(),
    ]

    if not all(values):
        raise HTTPException(400, "Semua kolom wajib diisi")

    try:
        with connect_db() as conn:
            row = conn.execute(
                """
                INSERT INTO products
                (name, artisan, origin, technique, motif)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *
                """,
                values,
            ).fetchone()

        return row
    except Exception as exc:
        raise HTTPException(500, f"Gagal menyimpan produk: {exc}")


# PHOTO UPLOAD TO SUPABASE STORAGE
@app.post("/api/products/{product_id}/photo")
async def upload_photo(
    product_id: int,
    photo: UploadFile = File(...)
):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    extension = allowed_types.get(photo.content_type)

    if not extension:
        raise HTTPException(
            400,
            "Gunakan foto JPG, PNG, atau WEBP"
        )

    content = await photo.read(MAX_PHOTO_SIZE + 1)

    if not content or len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(
            400,
            "Ukuran foto harus 10 MB atau kurang"
        )

    try:
        with connect_db() as conn:
            product = conn.execute(
                "SELECT id FROM products WHERE id = %s",
                (product_id,)
            ).fetchone()

        if not product:
            raise HTTPException(404, "Produk tidak ditemukan")

        filename = f"{product_id}_{uuid4().hex}{extension}"

        supabase.storage.from_(BUCKET_NAME).upload(
            filename,
            content,
            file_options={
                "content-type": photo.content_type,
                "upsert": "true",
            },
        )

        photo_url = supabase.storage.from_(
            BUCKET_NAME
        ).get_public_url(filename)

        with connect_db() as conn:
            conn.execute(
                """
                UPDATE products
                SET photo_url = %s,
                    product_hash = NULL,
                    blockchain_id = NULL,
                    status = 'Menunggu Verifikasi'
                WHERE id = %s
                """,
                (photo_url, product_id),
            )

        return {
            "message": "Foto berhasil diunggah",
            "photo_url": photo_url,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            500,
            f"Gagal mengunggah foto: {exc}"
        )

ROBOFLOW_API_KEY = os.environ["ROBOFLOW_API_KEY"]
ROBOFLOW_WORKSPACE = "rika-bagus-wijaya"
ROBOFLOW_WORKFLOW = (
    "detect-batik-v1-2-yolov8s-t1-vdetect-batik-v1-2-yolov8s-t1-logic"
)

roboflow = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key=ROBOFLOW_API_KEY
).configure(
    InferenceConfiguration(api_key_transport="header")
)


# DOWNLOAD PHOTO FROM SUPABASE STORAGE
def get_photo_content(photo_url):
    marker = f"/storage/v1/object/public/{BUCKET_NAME}/"

    if marker not in photo_url:
        raise ValueError("URL foto tidak valid")

    filename = unquote(photo_url.split(marker, 1)[1])

    return supabase.storage.from_(
        BUCKET_NAME
    ).download(filename)


# BLOCKCHAIN VERIFICATION
@app.post("/api/products/{product_id}/verify")
def verify_product(product_id: int):
    with connect_db() as conn:
        product = conn.execute(
            "SELECT * FROM products WHERE id = %s",
            (product_id,)
        ).fetchone()

    if not product:
        raise HTTPException(404, "Produk tidak ditemukan")

    if not product.get("photo_url"):
        raise HTTPException(
            400,
            "Unggah foto produk terlebih dahulu"
        )

    try:
        photo_content = get_photo_content(product["photo_url"])
    except Exception as exc:
        raise HTTPException(
            404,
            f"File foto tidak ditemukan: {exc}"
        )

    photo_hash = hashlib.sha256(photo_content).hexdigest()

    metadata = {
        "id": product["id"],
        "name": product["name"],
        "artisan": product["artisan"],
        "origin": product["origin"],
        "technique": product["technique"],
        "motif": product["motif"],
        "photo_sha256": photo_hash,
    }

    canonical = json.dumps(
        metadata,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )

    product_hash = hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()

    payload = json.dumps({
        "product_id": product_id,
        "product_hash": product_hash,
    }).encode("utf-8")

    request = urllib.request.Request(
        SIGNER_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    print("SIGNER DIPANGGIL:", SIGNER_URL, flush=True)

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            print("SIGNER STATUS:", response.status, flush=True)
            result = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print("SIGNER HTTP ERROR:", exc.code, body, flush=True)
        raise HTTPException(
            502,
            f"Signer HTTP {exc.code}: {body}"
        )

    except Exception as exc:
        print("SIGNER CONNECTION ERROR:", repr(exc), flush=True)
        raise HTTPException(
            502,
            f"Gagal mencatat ke Solana: {exc}"
        )

    signature = result.get("signature")
    explorer_url = result.get("explorer_url")

    if not signature or not explorer_url:
        raise HTTPException(
            502,
            "Respons signer tidak lengkap"
        )

    with connect_db() as conn:
        conn.execute(
            """
            UPDATE products
            SET product_hash = %s,
                blockchain_id = %s,
                status = 'Tercatat di Solana Devnet'
            WHERE id = %s
            """,
            (product_hash, signature, product_id),
        )

    return {
        "message": "Hash produk berhasil dikirim ke Solana Devnet",
        "product_id": product_id,
        "product_hash": product_hash,
        "signature": signature,
        "explorer_url": explorer_url,
    }

# AI BATIK DETECTION
@app.post("/api/predict")
async def predict_batik(photo: UploadFile = File(...)):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    extension = allowed_types.get(photo.content_type)
    if not extension:
        raise HTTPException(400, "Gunakan foto JPG, PNG, atau WEBP")

    content = await photo.read(MAX_PHOTO_SIZE + 1)
    if not content or len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(400, "Ukuran foto maksimal 10 MB")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=extension, delete=False
        ) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        result = roboflow.run_workflow(
            workspace_name=ROBOFLOW_WORKSPACE,
            workflow_id=ROBOFLOW_WORKFLOW,
            images={"image": temp_path},
            use_cache=True
        )

        return {
            "message": "Deteksi batik berhasil",
            "result": result
        }

    except Exception as exc:
        raise HTTPException(
            502, f"Gagal menjalankan deteksi Roboflow: {exc}"
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
