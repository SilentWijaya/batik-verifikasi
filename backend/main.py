
from pathlib import Path
import hashlib
import json
import sqlite3
import urllib.request
import uuid

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "batik.db"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

SIGNER_URL = "http://127.0.0.1:8765/record"
MAX_PHOTO_SIZE = 10 * 1024 * 1024

app = FastAPI(title="Sistem Verifikasi Batik")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                artisan TEXT NOT NULL,
                origin TEXT NOT NULL,
                technique TEXT NOT NULL,
                motif TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Menunggu Verifikasi',
                blockchain_id TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(products)")
        }

        if "photo_url" not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN photo_url TEXT")

        if "product_hash" not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN product_hash TEXT")

        if "blockchain_id" not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN blockchain_id TEXT")


init_db()


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    artisan: str = Field(min_length=1, max_length=150)
    origin: str = Field(min_length=1, max_length=150)
    technique: str = Field(min_length=1, max_length=150)
    motif: str = Field(min_length=1, max_length=150)


@app.get("/")
def home():
    return {"status": "ok", "message": "API Batik aktif"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/products")
def list_products():
    with connect_db() as conn:
        rows = conn.execute(
            "SELECT * FROM products ORDER BY id DESC"
        ).fetchall()

    return {"products": [dict(row) for row in rows]}


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

    with connect_db() as conn:
        cursor = conn.execute("""
            INSERT INTO products (name, artisan, origin, technique, motif)
            VALUES (?, ?, ?, ?, ?)
        """, values)

        row = conn.execute(
            "SELECT * FROM products WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return dict(row)


@app.post("/api/products/{product_id}/photo")
async def upload_photo(product_id: int, photo: UploadFile = File(...)):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    extension = allowed_types.get(photo.content_type)
    if not extension:
        raise HTTPException(400, "Gunakan foto JPG, PNG, atau WEBP")

    with connect_db() as conn:
        product = conn.execute(
            "SELECT id FROM products WHERE id = ?",
            (product_id,),
        ).fetchone()

    if not product:
        raise HTTPException(404, "Produk tidak ditemukan")

    content = await photo.read(MAX_PHOTO_SIZE + 1)

    if not content or len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(400, "Ukuran foto harus 10 MB atau kurang")

    filename = f"{product_id}_{uuid.uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(content)
    photo_url = f"/uploads/{filename}"

    with connect_db() as conn:
        conn.execute(
            """
            UPDATE products
            SET photo_url = ?, product_hash = NULL, blockchain_id = NULL,
                status = 'Menunggu Verifikasi'
            WHERE id = ?
            """,
            (photo_url, product_id),
        )

    return {"message": "Foto berhasil diunggah", "photo_url": photo_url}


@app.post("/api/products/{product_id}/verify")
def verify_product(product_id: int):
    with connect_db() as conn:
        row = conn.execute(
            "SELECT * FROM products WHERE id = ?",
            (product_id,),
        ).fetchone()

    if not row:
        raise HTTPException(404, "Produk tidak ditemukan")

    product = dict(row)

    if not product.get("photo_url"):
        raise HTTPException(400, "Unggah foto produk terlebih dahulu")

    photo_path = UPLOAD_DIR / Path(product["photo_url"]).name

    if not photo_path.is_file():
        raise HTTPException(404, "File foto tidak ditemukan")

    photo_hash = hashlib.sha256(photo_path.read_bytes()).hexdigest()

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

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))

    except Exception as exc:
        raise HTTPException(
            502,
            f"Gagal mencatat ke Solana. Pastikan layanan signer aktif. Detail: {exc}",
        ) from exc

    signature = result.get("signature")
    explorer_url = result.get("explorer_url")

    if not signature or not explorer_url:
        raise HTTPException(502, "Respons signer tidak lengkap")

    with connect_db() as conn:
        conn.execute("""
            UPDATE products
            SET product_hash = ?,
                blockchain_id = ?,
                status = 'Tercatat di Solana Devnet'
            WHERE id = ?
        """, (product_hash, signature, product_id))

    return {
        "message": "Hash produk berhasil dikirim ke Solana Devnet",
        "product_id": product_id,
        "product_hash": product_hash,
        "signature": signature,
        "explorer_url": explorer_url,
    }
