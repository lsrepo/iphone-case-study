import hashlib
import hmac
import json

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.orders import order_store

router = APIRouter()

STATUS_BY_EVENT = {
    "payment_approved": "paid",
    "payment_captured": "paid",
    "payment_declined": "declined",
    "payment_failed": "failed",
    "payment_expired": "failed",
}


def _verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/api/webhooks/checkout")
async def handle_checkout_webhook(request: Request):
    settings = get_settings()
    raw_body = await request.body()
    signature = request.headers.get("cko-signature", "")

    if not _verify_signature(raw_body, signature, settings.checkout_webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("type")
    reference = (payload.get("data") or {}).get("reference")
    new_status = STATUS_BY_EVENT.get(event_type)

    if new_status and reference:
        order_store.set_status(reference, new_status)

    return {"received": True}
