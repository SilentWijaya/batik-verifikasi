"""
chat_router.py  (FastAPI)

Endpoint POST /api/chat untuk chatbot PusakaBot, meneruskan pesan ke Groq.
API key dibaca dari environment variable di Render, TIDAK ditulis di kode:
    GROQ_API_KEY   (wajib)
    GROQ_MODEL     (opsional, default: llama-3.3-70b-versatile)

Dependensi tambahan:  pip install httpx   (tambahkan "httpx" ke requirements.txt)
"""

import os
import time
from collections import defaultdict, deque
from typing import List, Literal

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
MAX_HISTORY = 12

SYSTEM_PROMPT = """Kamu adalah PusakaBot AI, asisten ahli pakem batik dan pelestarian warisan budaya Indonesia di platform "Pusaka Verifikasi" (Sistem Verifikasi Batik).

Gaya menjawab:
- Bahasa Indonesia yang sopan, hangat, dan ringkas (maksimal sekitar 150 kata kecuali diminta detail).
- Sapa pengguna dengan hormat. Boleh memakai sapaan "Rahayu" sesekali.
- Gunakan poin singkat bila menjelaskan ciri atau langkah.

Bidang keahlian:
- Ciri batik tulis, cap, dan kombinasi; goresan canting; rembesan lilin malam; isen-isen.
- Makna dan pakem motif: Parang, Kawung, Mega Mendung, Sekar Jagad, Sido Asih, dan lainnya.
- Perbedaan batik asli dan tekstil printing.
- Cara kerja platform: pengguna mengajukan produk batik (nama, pengrajin, asal daerah, teknik, motif, foto), lalu data produk dicatat di blockchain Solana (Devnet) dan setiap produk punya QR.

Aturan penting:
- Kamu TIDAK punya akses ke database produk, status verifikasi, atau transaksi blockchain milik pengguna. Jangan mengarang ID produk, hash transaksi, status verifikasi, atau nilai taksiran. Jika ditanya status produk tertentu, arahkan pengguna ke bagian "Riwayat Pengajuan" atau "Katalog Batik" di halaman ini.
- Kamu hanya menerima teks, tidak bisa melihat foto atau file.
- Penilaian keaslian dari deskripsi teks hanya perkiraan, bukan keputusan final. Sampaikan itu dengan jelas.
- Jika pertanyaan di luar topik batik, budaya, atau platform ini, tolak dengan sopan dan arahkan kembali ke topik."""

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=40)


# Pembatas sederhana per IP (disimpan di memori): 15 pesan per menit
RATE_LIMIT = 15
RATE_WINDOW = 60
_hits = defaultdict(deque)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate(ip: str) -> None:
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Terlalu banyak pesan. Coba lagi sebentar lagi.")
    q.append(now)


@router.post("/api/chat")
async def chat(payload: ChatRequest, request: Request):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY belum diatur di server.")

    _check_rate(_client_ip(request))

    messages = [m.model_dump() for m in payload.messages][-MAX_HISTORY:]
    if messages[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="Pesan terakhir harus dari pengguna.")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": MODEL,
                    "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages],
                    "temperature": 0.6,
                    "max_tokens": 600,
                },
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Gagal menghubungi layanan AI.")

    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message")
        except Exception:
            msg = None
        raise HTTPException(status_code=502, detail=msg or f"Layanan AI error ({r.status_code}).")

    data = r.json()
    reply = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    return {"reply": reply}
