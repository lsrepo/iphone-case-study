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
    body = json.dumps({"type": "payment_approved", "data": {"reference": "order-1"}}).encode()

    response = client.post(
        "/api/webhooks/checkout",
        content=body,
        headers={"Cko-Signature": "not-the-real-signature", "Content-Type": "application/json"},
    )

    assert response.status_code == 401
