from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_products_hk_returns_hkd_prices():
    response = client.get("/api/products", params={"market": "HK"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert all(item["currency"] == "HKD" for item in body)
    assert all(isinstance(item["price"], int) for item in body)


def test_get_products_nl_returns_eur_prices():
    response = client.get("/api/products", params={"market": "NL"})
    assert response.status_code == 200
    body = response.json()
    assert all(item["currency"] == "EUR" for item in body)


def test_get_products_rejects_unknown_market():
    response = client.get("/api/products", params={"market": "US"})
    assert response.status_code == 422
