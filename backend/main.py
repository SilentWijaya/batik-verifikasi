
import os
import json
import hashlib
import tempfile
import time
import httpx
import bcrypt

import psycopg
from psycopg.rows import dict_row

from dotenv import load_dotenv
from supabase import create_client

from uuid import uuid4
from urllib.parse import unquote

from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from solders.message import Message
from solders.transaction import Transaction

from solana.rpc.api import Client
from solana.rpc.types import TxOpts

from inference_sdk import InferenceHTTPClient, InferenceConfiguration

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ==================================================
# 1. ENVIRONMENT CONFIGURATION
# ==================================================

load_dotenv(
    dotenv_path=os.path.join(os.path.dirname(__file__), ".env"),
    override=True
)

DATABASE_URL = os.environ["DATABASE_URL"]

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

ROBOFLOW_API_KEY = os.environ["ROBOFLOW_API_KEY"]

SOLANA_RPC_URL = os.getenv(
    "SOLANA_RPC_URL",
    "https://api.devnet.solana.com"
)

SOLANA_KEYPAIR_JSON = os.environ["SOLANA_KEYPAIR_JSON"]

BUCKET_NAME = "batik-photos"
MAX_PHOTO_SIZE = 10 * 1024 * 1024

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)

app = FastAPI(
    title="Sistem Verifikasi Batik"
)

@app.get("/health")
def health():
    return {"status": "ok"}

# ==================================================
# 2. CORS CONFIGURATION
# ==================================================

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


# ==================================================
# 3. REQUEST MODELS
# ==================================================

class RegisterRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100
    )

    email: str = Field(
        min_length=5,
        max_length=255
    )

    password: str = Field(
        min_length=8,
        max_length=72
    )


class LoginRequest(BaseModel):
    email: str
    password: str


class ProductCreate(BaseModel):
    user_id: int

    name: str = Field(
        min_length=1,
        max_length=150
    )

    artisan: str = Field(
        min_length=1,
        max_length=150
    )

    origin: str = Field(
        min_length=1,
        max_length=150
    )

    technique: str = Field(
        min_length=1,
        max_length=150
    )

    motif: str = Field(
        min_length=1,
        max_length=150
    )


# ==================================================
# 4. DATABASE CONNECTION
# ==================================================

def connect_db():
    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )


# ==================================================
# 5. SOLANA CONFIGURATION
# ==================================================

SOLANA_CLIENT = Client(SOLANA_RPC_URL)

MEMO_PROGRAM = Pubkey.from_string(
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
)

key_data = json.loads(SOLANA_KEYPAIR_JSON)

WALLET = Keypair.from_bytes(
    bytes(key_data)
)


# ==================================================
# 6. SOLANA BLOCKCHAIN FUNCTION
# ==================================================

def record_product_on_solana(
    product_id: int,
    product_hash: str
):
    if (
        len(product_hash) != 64
        or any(
            char not in "0123456789abcdef"
            for char in product_hash.lower()
        )
    ):
        raise HTTPException(
            status_code=400,
            detail="Hash SHA-256 tidak valid"
        )

    memo = (
        f"BATIK:v1:id={product_id}:sha256={product_hash}"
    )

    instruction = Instruction(
        MEMO_PROGRAM,
        memo.encode("utf-8"),
        [
            AccountMeta(
                WALLET.pubkey(),
                is_signer=True,
                is_writable=False
            )
        ]
    )

    try:
        latest = None

        for attempt in range(3):
            try:
                latest = (
                    SOLANA_CLIENT
                    .get_latest_blockhash()
                    .value
                )
                break

            except httpx.HTTPStatusError as exc:
                if (
                    exc.response.status_code != 429
                    or attempt == 2
                ):
                    raise

                time.sleep(2 ** (attempt + 1))

        if latest is None:
            raise Exception(
                "Gagal mendapatkan blockhash Solana"
            )

        message = Message.new_with_blockhash(
            [instruction],
            WALLET.pubkey(),
            latest.blockhash
        )

        transaction = Transaction(
            [WALLET],
            message,
            latest.blockhash
        )

        result = None

        for attempt in range(3):
            try:
                result = SOLANA_CLIENT.send_transaction(
                    transaction,
                    opts=TxOpts(
                        skip_preflight=False,
                        preflight_commitment="confirmed"
                    )
                )
                break

            except httpx.HTTPStatusError as exc:
                if (
                    exc.response.status_code != 429
                    or attempt == 2
                ):
                    raise

                time.sleep(2 ** (attempt + 1))

        if result is None:
            raise Exception(
                "Transaksi Solana gagal dikirim"
            )

        signature = str(result.value)

        return {
            "signature": signature,
            "explorer_url": (
                "https://explorer.solana.com/tx/"
                f"{signature}?cluster=devnet"
            )
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gagal mencatat transaksi Solana: {exc}"
        )


# ==================================================
# 7. AUTHENTICATION - REGISTER
# ==================================================

@app.post(
    "/api/register",
    status_code=201
)
def register_user(data: RegisterRequest):

    name = data.name.strip()
    email = data.email.strip().lower()

    if not name or not email:
        raise HTTPException(
            status_code=400,
            detail="Nama dan email wajib diisi"
        )

    if len(data.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password terlalu panjang untuk diproses"
        )

    try:
        existing = (
            supabase.table("users")
            .select("id")
            .eq("email", email)
            .limit(1)
            .execute()
        )

        if existing.data:
            raise HTTPException(
                status_code=409,
                detail="Email sudah terdaftar"
            )

        hashed_password = bcrypt.hashpw(
            data.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        result = (
            supabase.table("users")
            .insert({
                "name": name,
                "email": email,
                "password": hashed_password,
                "role": "user"
            })
            .execute()
        )

        if not result.data:
            raise Exception(
                "Data pengguna tidak berhasil disimpan"
            )

        user = result.data[0]

        return {
            "message": "Registrasi berhasil",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"]
            }
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal melakukan registrasi: {exc}"
        )


# ==================================================
# 8. AUTHENTICATION - LOGIN
# ==================================================

@app.post("/api/login")
def login_user(data: LoginRequest):

    email = data.email.strip().lower()

    try:
        result = (
            supabase.table("users")
            .select(
                "id, name, email, password, role"
            )
            .eq("email", email)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=401,
                detail="Email atau password salah"
            )

        user = result.data[0]

        password_valid = bcrypt.checkpw(
            data.password.encode("utf-8"),
            user["password"].encode("utf-8")
        )

        if not password_valid:
            raise HTTPException(
                status_code=401,
                detail="Email atau password salah"
            )

        role = user["role"]

        if role not in ["admin", "user"]:
            raise HTTPException(
                status_code=403,
                detail="Role akun tidak valid"
            )

        return {
            "message": "Login berhasil",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": role
            }
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan saat login"
        )


# ==================================================
# 9. LOCAL KNOWLEDGE
# ==================================================

@app.get("/api/local-knowledge")
def list_local_knowledge():

    try:
        with connect_db() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM local_knowledge
                ORDER BY id ASC
                """
            ).fetchall()

        return {
            "knowledge": rows
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil pengetahuan lokal: {exc}"
        )


# ==================================================
# 10. AI KNOWLEDGE
# ==================================================

@app.get("/api/ai-knowledge")
def list_ai_knowledge():

    try:
        with connect_db() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM ai_knowledge
                ORDER BY id ASC
                """
            ).fetchall()

        return {
            "knowledge": rows
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil pengetahuan AI: {exc}"
        )


# ==================================================
# 11. GENERAL API
# ==================================================

@app.get("/")
def home():

    return {
        "status": "ok",
        "message": "API Batik aktif"
    }


@app.get("/api/health")
def health():

    try:
        with connect_db() as conn:
            conn.execute("SELECT 1")

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {exc}"
        )


# ==================================================
# 12. PRODUCT MANAGEMENT
# ==================================================

# GET ALL PRODUCTS - KATALOG

@app.get("/api/products")
def list_products():

    try:
        with connect_db() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM products
                ORDER BY id DESC
                """
            ).fetchall()

        return {
            "products": rows
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil produk: {exc}"
        )


# GET PRODUCTS BY USER - RIWAYAT PENGAJUAN

@app.get("/api/my-products/{user_id}")
def list_my_products(user_id: int):

    try:
        with connect_db() as conn:

            user = conn.execute(
                """
                SELECT id
                FROM users
                WHERE id = %s
                """,
                (user_id,)
            ).fetchone()

            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="Pengguna tidak ditemukan"
                )

            rows = conn.execute(
                """
                SELECT *
                FROM products
                WHERE user_id = %s
                ORDER BY id DESC
                """,
                (user_id,)
            ).fetchall()

        return {
            "message": "Riwayat pengajuan berhasil diambil",
            "user_id": user_id,
            "total": len(rows),
            "products": rows
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil riwayat pengajuan: {exc}"
        )


# CREATE PRODUCT - AJUKAN BATIK

@app.post(
    "/api/products",
    status_code=201
)
def create_product(product: ProductCreate):

    values = [
        product.name.strip(),
        product.artisan.strip(),
        product.origin.strip(),
        product.technique.strip(),
        product.motif.strip()
    ]

    if not all(values):
        raise HTTPException(
            status_code=400,
            detail="Semua kolom wajib diisi"
        )

    try:
        with connect_db() as conn:

            user = conn.execute(
                """
                SELECT id
                FROM users
                WHERE id = %s
                """,
                (product.user_id,)
            ).fetchone()

            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="Pengguna tidak ditemukan"
                )

            row = conn.execute(
                """
                INSERT INTO products
                (
                    user_id,
                    name,
                    artisan,
                    origin,
                    technique,
                    motif
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    product.user_id,
                    product.name.strip(),
                    product.artisan.strip(),
                    product.origin.strip(),
                    product.technique.strip(),
                    product.motif.strip()
                )
            ).fetchone()

        return {
            "message": "Produk berhasil diajukan",
            "product": row
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menyimpan produk: {exc}"
        )


# ==================================================
# 13. SUPABASE STORAGE - PHOTO UPLOAD
# ==================================================

@app.post("/api/products/{product_id}/photo")
async def upload_photo(
    product_id: int,
    photo: UploadFile = File(...)
):

    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp"
    }

    extension = allowed_types.get(
        photo.content_type
    )

    if not extension:
        raise HTTPException(
            status_code=400,
            detail="Gunakan foto JPG, PNG, atau WEBP"
        )

    content = await photo.read(
        MAX_PHOTO_SIZE + 1
    )

    if (
        not content
        or len(content) > MAX_PHOTO_SIZE
    ):
        raise HTTPException(
            status_code=400,
            detail="Ukuran foto harus 10 MB atau kurang"
        )

    try:
        with connect_db() as conn:
            product = conn.execute(
                """
                SELECT id
                FROM products
                WHERE id = %s
                """,
                (product_id,)
            ).fetchone()

        if not product:
            raise HTTPException(
                status_code=404,
                detail="Produk tidak ditemukan"
            )

        filename = (
            f"{product_id}_{uuid4().hex}{extension}"
        )

        supabase.storage.from_(
            BUCKET_NAME
        ).upload(
            filename,
            content,
            file_options={
                "content-type": photo.content_type,
                "upsert": "true"
            }
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
                (photo_url, product_id)
            )

        return {
            "message": "Foto berhasil diunggah",
            "photo_url": photo_url
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengunggah foto: {exc}"
        )

    finally:
        await photo.close()


# ==================================================
# 14. ROBOFLOW CONFIGURATION
# ==================================================

ROBOFLOW_WORKSPACE = "rika-bagus-wijaya"

ROBOFLOW_WORKFLOW = (
    "detect-batik-v1-2-yolov8s-t1-"
    "vdetect-batik-v1-2-yolov8s-t1-logic"
)

roboflow = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key=ROBOFLOW_API_KEY
).configure(
    InferenceConfiguration(
        api_key_transport="header"
    )
)


# ==================================================
# 15. DOWNLOAD PHOTO FROM SUPABASE STORAGE
# ==================================================

def get_photo_content(photo_url: str):

    marker = (
        f"/storage/v1/object/public/{BUCKET_NAME}/"
    )

    if marker not in photo_url:
        raise ValueError(
            "URL foto tidak valid"
        )

    filename = unquote(
        photo_url.split(marker, 1)[1]
    )

    return supabase.storage.from_(
        BUCKET_NAME
    ).download(filename)


# ==================================================
# 16. BLOCKCHAIN PRODUCT VERIFICATION
# ==================================================

@app.post("/api/products/{product_id}/verify")
def verify_product(product_id: int):

    try:
        with connect_db() as conn:
            product = conn.execute(
                """
                SELECT *
                FROM products
                WHERE id = %s
                """,
                (product_id,)
            ).fetchone()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil data produk: {exc}"
        )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Produk tidak ditemukan"
        )

    if not product.get("photo_url"):
        raise HTTPException(
            status_code=400,
            detail="Unggah foto produk terlebih dahulu"
        )

    try:
        photo_content = get_photo_content(
            product["photo_url"]
        )

    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"File foto tidak ditemukan: {exc}"
        )

    photo_hash = hashlib.sha256(
        photo_content
    ).hexdigest()

    metadata = {
        "id": product["id"],
        "name": product["name"],
        "artisan": product["artisan"],
        "origin": product["origin"],
        "technique": product["technique"],
        "motif": product["motif"],
        "photo_sha256": photo_hash
    }

    canonical = json.dumps(
        metadata,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False
    )

    product_hash = hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()

    result = record_product_on_solana(
        product_id,
        product_hash
    )

    signature = result.get("signature")
    explorer_url = result.get("explorer_url")

    if not signature or not explorer_url:
        raise HTTPException(
            status_code=502,
            detail="Respons transaksi Solana tidak lengkap"
        )

    try:
        with connect_db() as conn:
            conn.execute(
                """
                UPDATE products
                SET product_hash = %s,
                    blockchain_id = %s,
                    status = 'Tercatat di Solana Devnet'
                WHERE id = %s
                """,
                (
                    product_hash,
                    signature,
                    product_id
                )
            )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Transaksi blockchain berhasil dikirim, "
                f"tetapi gagal memperbarui database: {exc}. "
                f"Signature: {signature}"
            )
        )

    return {
        "message": "Hash produk berhasil dikirim ke Solana Devnet",
        "product_id": product_id,
        "product_hash": product_hash,
        "signature": signature,
        "explorer_url": explorer_url
    }


# ==================================================
# 17. AI BATIK DETECTION
# ==================================================

@app.post("/api/predict")
async def predict_batik(
    photo: UploadFile = File(...)
):

    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp"
    }

    extension = allowed_types.get(
        photo.content_type
    )

    if not extension:
        raise HTTPException(
            status_code=400,
            detail="Gunakan foto JPG, PNG, atau WEBP"
        )

    content = await photo.read(
        MAX_PHOTO_SIZE + 1
    )

    if (
        not content
        or len(content) > MAX_PHOTO_SIZE
    ):
        raise HTTPException(
            status_code=400,
            detail="Ukuran foto maksimal 10 MB"
        )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=extension,
            delete=False
        ) as temp_file:

            temp_file.write(content)
            temp_path = temp_file.name

        result = roboflow.run_workflow(
            workspace_name=ROBOFLOW_WORKSPACE,
            workflow_id=ROBOFLOW_WORKFLOW,
            images={
                "image": temp_path
            },
            use_cache=True
        )

        return {
            "message": "Deteksi batik berhasil",
            "result": result
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gagal menjalankan deteksi Roboflow: {exc}"
        )

    finally:
        if (
            temp_path
            and os.path.exists(temp_path)
        ):
            os.remove(temp_path)

        await photo.close()
