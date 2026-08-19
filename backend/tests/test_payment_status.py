from fastapi.testclient import TestClient

from app.main import app
from app.orders import order_store
from app.models import BasketItem

client = TestClient(app)


def test_get_payment_status_returns_pending_for_new_order():
    order_store.create("order-abc", "HK", "HKD", 25000, [BasketItem(product_id="clear-case", quantity=1)])

    response = client.get("/api/payments/order-abc")

    assert response.status_code == 200
    body = response.json()
    assert body == {"order_id": "order-abc", "status": "pending", "amount": 25000, "currency": "HKD"}


def test_get_payment_status_404_for_unknown_order():
    response = client.get("/api/payments/does-not-exist")
    assert response.status_code == 404
