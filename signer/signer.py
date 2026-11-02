@'
import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from solders.message import Message
from solders.transaction import Transaction
from solana.rpc.api import Client
from solana.rpc.types import TxOpts

app = FastAPI()
client = Client("https://api.devnet.solana.com")

MEMO_PROGRAM = Pubkey.from_string(
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
)

key_data = json.loads(os.environ["SOLANA_KEYPAIR_JSON"])
wallet = Keypair.from_bytes(bytes(key_data))

class RecordRequest(BaseModel):
    product_id: int
    product_hash: str

@app.get("/")
def home():
    return {"status": "signer aktif"}

@app.post("/record")
def record_product(data: RecordRequest):
    if len(data.product_hash) != 64 or any(
        c not in "0123456789abcdef"
        for c in data.product_hash.lower()
    ):
        raise HTTPException(400, "Hash SHA-256 tidak valid")

    memo = f"BATIK:v1:id={data.product_id}:sha256={data.product_hash}"

    instruction = Instruction(
        MEMO_PROGRAM,
        memo.encode(),
        [AccountMeta(wallet.pubkey(), is_signer=True, is_writable=False)]
    )

    latest = client.get_latest_blockhash().value
    message = Message.new_with_blockhash(
        [instruction], wallet.pubkey(), latest.blockhash
    )
    transaction = Transaction([wallet], message, latest.blockhash)

    result = client.send_transaction(
        transaction,
        opts=TxOpts(
            skip_preflight=False,
            preflight_commitment="confirmed"
        )
    )

    signature = str(result.value)

    return {
        "product_id": data.product_id,
        "product_hash": data.product_hash,
        "signature": signature,
        "explorer_url": (
            "https://explorer.solana.com/tx/"
            + signature + "?cluster=devnet"
        )
    }
'@ | Set-Content -Encoding utf8 signer/signer.py