import respx
from httpx import Response
from fastapi.testclient import TestClient

from app.main import app
from app.config import get_settings

client = TestClient(app)


@respx.mock
def test_create_payment_session_recalculates_amount_server_side():
    settings = get_settings()
    route = respx.post(f"{settings.checkout_api_base_url}/payment-sessions").mock(
        return_value=Response(201, json={"id": "ps_123", "_links": {}})
    )

    response = client.post(
        "/api/payment-sessions",
        json={
            "market": "HK",
            "items": [{"product_id": "silicone-case-sage", "quantity": 2}],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert "order_id" in body
    assert body["payment_session"] == {"id": "ps_123", "_links": {}}

    sent_body = route.calls[0].request.content
    import json

    payload = json.loads(sent_body)
    assert payload["amount"] == 50000  # 2 x 25000, never trusts a client-sent amount
    assert payload["currency"] == "HKD"
    assert payload["reference"] == body["order_id"]


@respx.mock
def test_create_payment_session_rejects_unknown_product():
    response = client.post(
        "/api/payment-sessions",
        json={"market": "HK", "items": [{"product_id": "not-a-product", "quantity": 1}]},
    )
    assert response.status_code == 400


@respx.mock
def test_create_payment_session_rejects_empty_basket():
    response = client.post(
        "/api/payment-sessions",
        json={"market": "HK", "items": []},
    )
    assert response.status_code == 400


@respx.mock
def test_create_payment_session_returns_502_when_checkout_com_rejects_request():
    settings = get_settings()
    respx.post(f"{settings.checkout_api_base_url}/payment-sessions").mock(
        return_value=Response(422, json={"error_type": "request_invalid", "error_codes": ["amount_invalid"]})
    )

    response = client.post(
        "/api/payment-sessions",
        json={
            "market": "HK",
            "items": [{"product_id": "silicone-case-sage", "quantity": 2}],
        },
    )

    assert response.status_code == 502
    # the raw Checkout.com error body must not leak to the client
    assert "amount_invalid" not in response.text
