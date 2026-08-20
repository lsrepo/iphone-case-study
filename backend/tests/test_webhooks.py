import hashlib
import hmac
import json

from fastapi.testclient import TestClient

from app.main import app
from app.orders import order_store
from app.models import BasketItem
from app.config import get_settings

client = TestClient(app)


def _sign(body: bytes) -> str:
    secret = get_settings().checkout_webhook_secret
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_webhook_updates_order_to_paid_on_payment_approved():
    order_store.create("order-1", "HK", "HKD", 25000, [BasketItem(product_id="clear-case", quantity=1)])
    payload = {"type": "payment_approved", "data": {"reference": "order-1"}}
    body = json.dumps(payload).encode()

    response = client.post(
        "/api/webhooks/checkout",
        content=body,
        headers={"Cko-Signature": _sign(body), "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert order_store.get("order-1").status == "paid"


def test_webhook_updates_order_to_declined_on_payment_declined():
    order_store.create("order-2", "HK", "HKD", 25000, [BasketItem(product_id="clear-case", quantity=1)])
    payload = {"type": "payment_declined", "data": {"reference": "order-2"}}
    body = json.dumps(payload).encode()

    response = client.post(
        "/api/webhooks/checkout",
        content=body,
        headers={"Cko-Signature": _sign(body), "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert order_store.get("order-2").status == "declined"


def test_webhook_rejects_invalid_signature():
    order_store.create("order-3", "HK", "HKD", 25000, [BasketItem(product_id="clear-case", quantity=1)])
    body = json.dumps({"type": "payment_approved", "data": {"reference": "order-3"}}).encode()

    response = client.post(
        "/api/webhooks/checkout",
        content=body,
        headers={"Cko-Signature": "not-the-real-signature", "Content-Type": "application/json"},
    )

    assert response.status_code == 401
    assert order_store.get("order-3").status == "pending"


def test_webhook_rejects_non_ascii_signature_with_401_not_500():
    # Starlette decodes headers as latin-1, so a byte >127 in the header is valid at
    # the ASGI layer even though it's not valid ASCII. httpx's client-side header
    # encoder rejects non-ASCII str values outright, so send the raw latin-1 bytes
    # directly to reproduce what the server actually receives.
    order_store.create("order-4", "HK", "HKD", 25000, [BasketItem(product_id="clear-case", quantity=1)])
    body = json.dumps({"type": "payment_approved", "data": {"reference": "order-4"}}).encode()

    response = client.post(
        "/api/webhooks/checkout",
        content=body,
        headers={"Cko-Signature": "signature-not-real-\xe9".encode("latin-1"), "Content-Type": "application/json"},
    )

    assert response.status_code == 401
    assert order_store.get("order-4").status == "pending"


def test_webhook_rejects_malformed_json_with_valid_signature():
    body = b"not-valid-json{{{"

    response = client.post(
        "/api/webhooks/checkout",
        content=body,
        headers={"Cko-Signature": _sign(body), "Content-Type": "application/json"},
    )

    assert response.status_code == 400
