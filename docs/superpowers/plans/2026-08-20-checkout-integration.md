# Checkout Page Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working FastAPI + Next.js checkout flow for an iPhone-case merchant that accepts cards and Apple Pay via Checkout.com Flow, in the Checkout.com sandbox, for the HK (HKD) and NL (EUR) markets.

**Architecture:** A FastAPI backend holds the Checkout.com secret key and does three things: serves a hard-coded product catalog, creates Payment Sessions (recalculating the amount server-side from the basket), and receives/verifies Checkout.com webhooks to update an in-memory order store that a status endpoint exposes. A Next.js (App Router, TypeScript) frontend keeps the basket in `localStorage`, and on `/checkout` calls the backend for a Payment Session, then mounts Checkout.com's prebuilt Flow component (`@checkout.com/checkout-web-components`) with the public key to collect card details or trigger Apple Pay — no card data ever reaches the FastAPI backend. The two apps are connected only over the documented JSON API in "API Contract" below, so backend and frontend tasks can be built and reviewed independently once that contract is fixed.

**Tech Stack:** Python 3.11+, FastAPI, httpx, pydantic v2 / pydantic-settings, pytest + pytest-asyncio + respx (backend); Next.js 14 (App Router), TypeScript, React 18, `@checkout.com/checkout-web-components`, Vitest + Testing Library (frontend).

**Spec:** Product Requirements Document — "Checkout Page Integration" (pasted into the `/superpowers:writing-plans` invocation that produced this plan; not stored as a separate file). Key decisions locked in during refinement, superseding the PRD's "Open Questions" section:
- **Market selection:** manual toggle in the UI (not env-var, not geo-detection).
- **Customer identity:** placeholder customer data (no guest checkout form) in v1.
- **Order persistence:** in-memory store only (no SQLite), reset on backend restart.
- **Delivery:** local-only, run via README instructions — no hosted deployment.

## Global Constraints

- No raw card data may reach the FastAPI backend at any point — verified per-task by inspecting network calls, and again manually in Task 12.
- Secret key (`CHECKOUT_SECRET_KEY`) is read only by the backend; the frontend only ever sees the public key.
- All Checkout.com API calls use `Authorization: Bearer {secret_key}` (confirmed against current Checkout.com docs — not the bare-key format used by older integrations).
- Sandbox API base URL is `https://api.sandbox.checkout.com`.
- Webhook signature verification: HMAC-SHA256 over the **raw request body bytes** (not re-serialized JSON) using `CHECKOUT_WEBHOOK_SECRET` as the key, hex-digest, compared against the `Cko-Signature` request header. This env var is an addition beyond the PRD's §7.1 list — it's required to satisfy §4.2's signature-verification requirement and wasn't itemized there.
- `CHECKOUT_PUBLIC_KEY` (backend) from PRD §7.1 is intentionally **not** added to the backend `.env` — the backend never needs the public key, only `NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY` (frontend) is used. Documented here so it doesn't look like an oversight.
- Checkout.com's Flow script must never be bundled by webpack/Next.js — only `loadCheckoutWebComponents` (from the `@checkout.com/checkout-web-components` npm loader) may fetch it, at runtime, from `https://checkout-web-components.checkout.com`. This is a PCI requirement from Checkout.com's own docs, not a style preference.
- All amounts are integers in the currency's minor unit (cents), for both HKD and EUR (both 2 decimal places) — never floats.
- Order/payment correlation uses a backend-generated `order_id` (our own UUID), sent as `reference` on the Payment Session request. Checkout.com echoes `reference` back on the resulting payment and in webhook payloads, so the webhook handler matches by `reference`, not by payment-session ID (a payment session ID and the resulting payment ID are different Checkout.com objects).
- The `payment_session` object returned by `POST /payment-sessions` is treated as **opaque** by the backend (forwarded to the frontend untouched) and by the frontend (passed straight into `loadCheckoutWebComponents({ paymentSession })`) — no code destructures its internal fields, since Checkout.com's contract for those fields isn't guaranteed stable.
- Every task that touches payment logic includes an automated test using a mocked Checkout.com API (respx on the backend). Actually calling the live sandbox is exercised once, manually, in Task 12 — the sandbox requires real browser/Apple Pay tester interaction that can't be scripted.

---

## API Contract (backend ⟷ frontend)

Fixed here so backend (Tasks 1–5) and frontend (Tasks 6–10) can be built independently.

```
GET /api/products?market=HK|NL
  -> 200 [{ id: string, name: string, description: string, image: string, price: int, currency: "HKD"|"EUR" }]

POST /api/payment-sessions
  body: { market: "HK"|"NL", items: [{ product_id: string, quantity: int }] }
  -> 201 { order_id: string, payment_session: <opaque Checkout.com PaymentSession object> }
  -> 400 if any product_id is unknown or quantity <= 0

GET /api/payments/{order_id}
  -> 200 { order_id: string, status: "pending"|"paid"|"declined"|"failed", amount: int, currency: string }
  -> 404 if order_id unknown

POST /api/webhooks/checkout   (called by Checkout.com, not the frontend)
  headers: Cko-Signature: <hex hmac-sha256>
  -> 200 always (once signature verifies), 401 if signature invalid
```

Success/failure redirect URLs sent to Checkout.com are:
`{FRONTEND_BASE_URL}/checkout/success?order_id={order_id}&outcome=success`
`{FRONTEND_BASE_URL}/checkout/success?order_id={order_id}&outcome=failure`

---

## File Structure

```
iphone-case-study/
├── README.md
├── .gitignore
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS, router mounting
│   │   ├── config.py            # pydantic-settings Settings, loaded from env
│   │   ├── products.py          # hard-coded catalog + price-by-market lookup
│   │   ├── models.py            # Pydantic request/response/order models
│   │   ├── checkout_client.py   # CheckoutComClient: create_payment_session, get_payment
│   │   ├── orders.py            # in-memory OrderStore
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── products.py      # GET /api/products
│   │       ├── payments.py      # POST /api/payment-sessions, GET /api/payments/{id}
│   │       └── webhooks.py      # POST /api/webhooks/checkout
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_products.py
│   │   ├── test_payment_sessions.py
│   │   ├── test_payment_status.py
│   │   └── test_webhooks.py
│   ├── requirements.txt
│   ├── pytest.ini
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css          # brand color CSS variables
    │   ├── page.tsx             # redirects to /cart
    │   ├── cart/page.tsx
    │   ├── checkout/page.tsx
    │   └── checkout/success/page.tsx
    ├── lib/
    │   ├── types.ts             # Product, BasketItem, Market shared types
    │   ├── market.ts            # market state (localStorage-backed)
    │   ├── basket.ts            # basket state (localStorage-backed)
    │   └── api.ts                # fetch wrappers for the backend API contract above
    ├── components/
    │   ├── MarketToggle.tsx
    │   ├── ProductCard.tsx
    │   ├── BasketSummary.tsx
    │   └── CheckoutFlowMount.tsx # wraps loadCheckoutWebComponents
    ├── __tests__/
    │   ├── market.test.ts
    │   ├── basket.test.ts
    │   └── cart-page.test.tsx
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── vitest.config.ts
    └── .env.example
```

---

### Task 1: Backend scaffold, config, and product catalog

**Files:**
- Create: `backend/requirements.txt`, `backend/pytest.ini`, `backend/.env.example`
- Create: `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/products.py`, `backend/app/main.py`
- Create: `backend/app/routers/__init__.py`, `backend/app/routers/products.py`
- Test: `backend/tests/conftest.py`, `backend/tests/test_products.py`

**Interfaces:**
- Produces: `Settings` class (`app/config.py`) with fields `checkout_secret_key: str`, `checkout_webhook_secret: str`, `checkout_processing_channel_id: str | None`, `checkout_api_base_url: str = "https://api.sandbox.checkout.com"`, `frontend_base_url: str`; module-level `get_settings()` returning a cached `Settings()`.
- Produces: `PRODUCTS: list[dict]` in `app/products.py`, and `get_products_for_market(market: str) -> list[dict]` returning `{id, name, description, image, price, currency}` dicts.
- Produces: `app` FastAPI instance in `app/main.py`, importable as `from app.main import app`.

- [ ] **Step 1: Write the failing test for the product catalog**

```python
# backend/tests/test_products.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pip install -r requirements.txt && pytest tests/test_products.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'` (nothing exists yet)

- [ ] **Step 3: Write `requirements.txt`, `.env.example`, `pytest.ini`**

```
# backend/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
httpx==0.27.2
pydantic==2.9.2
pydantic-settings==2.5.2
pytest==8.3.3
pytest-asyncio==0.24.0
respx==0.21.1
```

```bash
# backend/.env.example
CHECKOUT_SECRET_KEY=sk_test_replace_me
CHECKOUT_WEBHOOK_SECRET=whsec_replace_me
CHECKOUT_PROCESSING_CHANNEL_ID=
CHECKOUT_API_BASE_URL=https://api.sandbox.checkout.com
FRONTEND_BASE_URL=http://localhost:3000
```

```ini
# backend/pytest.ini
[pytest]
pythonpath = .
asyncio_mode = auto
```

- [ ] **Step 4: Write `app/config.py`**

```python
# backend/app/config.py
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    checkout_secret_key: str
    checkout_webhook_secret: str
    checkout_processing_channel_id: str | None = None
    checkout_api_base_url: str = "https://api.sandbox.checkout.com"
    frontend_base_url: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Write `app/products.py`**

```python
# backend/app/products.py
PRODUCTS = [
    {
        "id": "silicone-case-sage",
        "name": "Silicone iPhone Case — Sage",
        "description": "Soft-touch silicone case in sage green.",
        "image": "/products/silicone-sage.png",
        "prices": {"HKD": 25000, "EUR": 2500},
    },
    {
        "id": "clear-case",
        "name": "Clear iPhone Case",
        "description": "Slim clear case with raised bezel protection.",
        "image": "/products/clear-case.png",
        "prices": {"HKD": 19900, "EUR": 1900},
    },
]

MARKET_CURRENCY = {"HK": "HKD", "NL": "EUR"}


def get_products_for_market(market: str) -> list[dict]:
    currency = MARKET_CURRENCY[market]
    return [
        {
            "id": product["id"],
            "name": product["name"],
            "description": product["description"],
            "image": product["image"],
            "price": product["prices"][currency],
            "currency": currency,
        }
        for product in PRODUCTS
    ]


def get_product_price(product_id: str, market: str) -> int:
    currency = MARKET_CURRENCY[market]
    for product in PRODUCTS:
        if product["id"] == product_id:
            return product["prices"][currency]
    raise KeyError(product_id)
```

- [ ] **Step 6: Write `app/routers/products.py` and wire up `app/main.py`**

```python
# backend/app/routers/products.py
from typing import Literal

from fastapi import APIRouter

from app.products import get_products_for_market

router = APIRouter()


@router.get("/api/products")
def list_products(market: Literal["HK", "NL"]):
    return get_products_for_market(market)
```

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import products

app = FastAPI(title="iPhone Case Study Checkout API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
```

```python
# backend/app/routers/__init__.py
```

```python
# backend/app/__init__.py
```

- [ ] **Step 7: Write `tests/conftest.py` so tests don't need real env vars**

```python
# backend/tests/conftest.py
import os

os.environ.setdefault("CHECKOUT_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("CHECKOUT_WEBHOOK_SECRET", "whsec_dummy")
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_products.py -v`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
cd /Users/pak/dev/checkout-dot-com/iphone-case-study
git init
git add backend/requirements.txt backend/pytest.ini backend/.env.example backend/app backend/tests
git commit -m "feat: backend scaffold with product catalog endpoint"
```

---

### Task 2: Checkout.com client + Payment Session creation endpoint

**Files:**
- Create: `backend/app/checkout_client.py`, `backend/app/models.py`, `backend/app/orders.py`
- Create: `backend/app/routers/payments.py`
- Modify: `backend/app/main.py` (mount `payments.router`)
- Test: `backend/tests/test_payment_sessions.py`

**Interfaces:**
- Consumes: `get_settings()`, `get_products_for_market`, `get_product_price` from Task 1.
- Produces: `CheckoutComClient.create_payment_session(*, amount: int, currency: str, country: str, reference: str, success_url: str, failure_url: str) -> dict` (async).
- Produces: `OrderStore` (module-level singleton `order_store`) with `create(order_id, market, currency, amount, items) -> Order` and `get(order_id) -> Order | None`; `Order` has `.status: Literal["pending","paid","declined","failed"]`.
- Produces: `POST /api/payment-sessions` per the API Contract above — later consumed by frontend Task 9.

- [ ] **Step 1: Write the failing test, mocking the Checkout.com API with respx**

```python
# backend/tests/test_payment_sessions.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_payment_sessions.py -v`
Expected: FAIL — 404 (route doesn't exist)

- [ ] **Step 3: Write `app/models.py`**

```python
# backend/app/models.py
from typing import Literal

from pydantic import BaseModel, Field

OrderStatus = Literal["pending", "paid", "declined", "failed"]
Market = Literal["HK", "NL"]


class BasketItem(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)


class PaymentSessionRequest(BaseModel):
    market: Market
    items: list[BasketItem]


class PaymentSessionResponse(BaseModel):
    order_id: str
    payment_session: dict


class PaymentStatusResponse(BaseModel):
    order_id: str
    status: OrderStatus
    amount: int
    currency: str
```

- [ ] **Step 4: Write `app/orders.py`**

```python
# backend/app/orders.py
from dataclasses import dataclass, field

from app.models import BasketItem, Market, OrderStatus


@dataclass
class Order:
    id: str
    market: Market
    currency: str
    amount: int
    items: list[BasketItem]
    status: OrderStatus = "pending"


class OrderStore:
    def __init__(self) -> None:
        self._orders: dict[str, Order] = {}

    def create(self, order_id: str, market: Market, currency: str, amount: int, items: list[BasketItem]) -> Order:
        order = Order(id=order_id, market=market, currency=currency, amount=amount, items=items)
        self._orders[order_id] = order
        return order

    def get(self, order_id: str) -> Order | None:
        return self._orders.get(order_id)

    def set_status(self, order_id: str, status: OrderStatus) -> Order | None:
        order = self._orders.get(order_id)
        if order:
            order.status = status
        return order


order_store = OrderStore()
```

- [ ] **Step 5: Write `app/checkout_client.py`**

```python
# backend/app/checkout_client.py
import httpx


class CheckoutComClient:
    def __init__(self, secret_key: str, base_url: str, processing_channel_id: str | None = None) -> None:
        self._secret_key = secret_key
        self._base_url = base_url
        self._processing_channel_id = processing_channel_id

    async def create_payment_session(
        self,
        *,
        amount: int,
        currency: str,
        country: str,
        reference: str,
        success_url: str,
        failure_url: str,
    ) -> dict:
        payload = {
            "amount": amount,
            "currency": currency,
            "reference": reference,
            "display_name": "iPhone Case Study",
            "billing": {"address": {"country": country}},
            "customer": {"name": "Guest Customer", "email": "guest@example.com"},
            "success_url": success_url,
            "failure_url": failure_url,
        }
        if self._processing_channel_id:
            payload["processing_channel_id"] = self._processing_channel_id

        async with httpx.AsyncClient(base_url=self._base_url) as client:
            response = await client.post(
                "/payment-sessions",
                json=payload,
                headers={"Authorization": f"Bearer {self._secret_key}"},
            )
        response.raise_for_status()
        return response.json()

    async def get_payment(self, payment_id: str) -> dict:
        async with httpx.AsyncClient(base_url=self._base_url) as client:
            response = await client.get(
                f"/payments/{payment_id}",
                headers={"Authorization": f"Bearer {self._secret_key}"},
            )
        response.raise_for_status()
        return response.json()
```

- [ ] **Step 6: Write `app/routers/payments.py`**

```python
# backend/app/routers/payments.py
import uuid

from fastapi import APIRouter, HTTPException

from app.checkout_client import CheckoutComClient
from app.config import get_settings
from app.models import PaymentSessionRequest, PaymentSessionResponse, PaymentStatusResponse
from app.orders import order_store
from app.products import MARKET_CURRENCY, get_product_price

router = APIRouter()

BILLING_COUNTRY = {"HK": "HK", "NL": "NL"}


@router.post("/api/payment-sessions", status_code=201, response_model=PaymentSessionResponse)
async def create_payment_session(body: PaymentSessionRequest):
    settings = get_settings()

    try:
        amount = sum(get_product_price(item.product_id, body.market) * item.quantity for item in body.items)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Unknown product_id: {exc.args[0]}") from exc

    currency = MARKET_CURRENCY[body.market]
    order_id = str(uuid.uuid4())
    order_store.create(order_id, body.market, currency, amount, body.items)

    client = CheckoutComClient(
        secret_key=settings.checkout_secret_key,
        base_url=settings.checkout_api_base_url,
        processing_channel_id=settings.checkout_processing_channel_id,
    )
    payment_session = await client.create_payment_session(
        amount=amount,
        currency=currency,
        country=BILLING_COUNTRY[body.market],
        reference=order_id,
        success_url=f"{settings.frontend_base_url}/checkout/success?order_id={order_id}&outcome=success",
        failure_url=f"{settings.frontend_base_url}/checkout/success?order_id={order_id}&outcome=failure",
    )

    return PaymentSessionResponse(order_id=order_id, payment_session=payment_session)


@router.get("/api/payments/{order_id}", response_model=PaymentStatusResponse)
def get_payment_status(order_id: str):
    order = order_store.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return PaymentStatusResponse(order_id=order.id, status=order.status, amount=order.amount, currency=order.currency)
```

- [ ] **Step 7: Mount the router in `app/main.py`**

```python
# backend/app/main.py — add these two lines
from app.routers import payments  # add to imports

app.include_router(payments.router)  # add after app.include_router(products.router)
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_payment_sessions.py -v`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add backend/app/checkout_client.py backend/app/models.py backend/app/orders.py backend/app/routers/payments.py backend/app/main.py backend/tests/test_payment_sessions.py
git commit -m "feat: create Checkout.com payment sessions with server-side amount calc"
```

---

### Task 3: Payment status endpoint test coverage

**Files:**
- Test: `backend/tests/test_payment_status.py`
- Modify: none (endpoint already exists from Task 2 — this task locks in its contract with tests before other tasks build on it)

**Interfaces:**
- Consumes: `GET /api/payments/{order_id}` from Task 2, `order_store` from Task 2.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_payment_status.py
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
```

- [ ] **Step 2: Run test — it should already pass since Task 2 built the endpoint**

Run: `cd backend && pytest tests/test_payment_status.py -v`
Expected: PASS (2 tests). If it fails, fix `app/routers/payments.py` from Task 2 before continuing — do not proceed with a broken contract.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_payment_status.py
git commit -m "test: lock in payment status endpoint contract"
```

---

### Task 4: Webhook endpoint with signature verification and order updates

**Files:**
- Create: `backend/app/routers/webhooks.py`
- Modify: `backend/app/main.py` (mount `webhooks.router`)
- Test: `backend/tests/test_webhooks.py`

**Interfaces:**
- Consumes: `order_store` from Task 2, `get_settings()` from Task 1.
- Produces: `POST /api/webhooks/checkout` per the API Contract above.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_webhooks.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_webhooks.py -v`
Expected: FAIL — 404 (route doesn't exist)

- [ ] **Step 3: Write `app/routers/webhooks.py`**

```python
# backend/app/routers/webhooks.py
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

    payload = json.loads(raw_body)
    event_type = payload.get("type")
    reference = payload.get("data", {}).get("reference")
    new_status = STATUS_BY_EVENT.get(event_type)

    if new_status and reference:
        order_store.set_status(reference, new_status)

    return {"received": True}
```

- [ ] **Step 4: Mount the router in `app/main.py`**

```python
# backend/app/main.py — add these two lines
from app.routers import webhooks  # add to imports

app.include_router(webhooks.router)  # add after app.include_router(payments.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_webhooks.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full backend test suite**

Run: `cd backend && pytest -v`
Expected: PASS (all tests from Tasks 1–4)

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/webhooks.py backend/app/main.py backend/tests/test_webhooks.py
git commit -m "feat: verify and process Checkout.com webhooks"
```

---

### Task 5: Frontend scaffold, branding, and shared types

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.js`, `frontend/vitest.config.ts`, `frontend/.env.example`
- Create: `frontend/app/layout.tsx`, `frontend/app/globals.css`, `frontend/app/page.tsx`
- Create: `frontend/lib/types.ts`

**Interfaces:**
- Produces: `Product`, `BasketItem`, `Market` TypeScript types in `lib/types.ts`, consumed by every later frontend task.
- Produces: CSS variables `--color-dark-olive: #323416`, `--color-sage: #8C9E6E`, `--color-off-white: #FFFFFD` in `globals.css`, used by every later frontend task's components.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "iphone-case-study-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "14.2.13",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@checkout.com/checkout-web-components": "1.4.4"
  },
  "devDependencies": {
    "typescript": "5.6.2",
    "@types/node": "22.7.4",
    "@types/react": "18.3.10",
    "@types/react-dom": "18.3.0",
    "vitest": "2.1.1",
    "@vitejs/plugin-react": "4.3.1",
    "@testing-library/react": "16.0.1",
    "@testing-library/jest-dom": "6.5.0",
    "jsdom": "25.0.1"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`, `next.config.js`, `vitest.config.ts`**

```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

```js
// frontend/next.config.js
/** @type {import('next').NextConfig} */
module.exports = {};
```

```ts
// frontend/vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

```bash
# frontend/.env.example
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY=pk_test_replace_me
```

- [ ] **Step 3: Write `lib/types.ts`**

```ts
// frontend/lib/types.ts
export type Market = "HK" | "NL";

export interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  currency: "HKD" | "EUR";
}

export interface BasketLine {
  productId: string;
  quantity: number;
}
```

- [ ] **Step 4: Write branding CSS and root layout**

```css
/* frontend/app/globals.css */
:root {
  --color-dark-olive: #323416;
  --color-sage: #8c9e6e;
  --color-off-white: #fffffd;
}

body {
  background: var(--color-off-white);
  color: var(--color-dark-olive);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  margin: 0;
}

a {
  color: var(--color-dark-olive);
}

button {
  background: var(--color-sage);
  color: var(--color-dark-olive);
  border: none;
  border-radius: 6px;
  padding: 0.6rem 1.2rem;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

```tsx
// frontend/app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "iPhone Case Study" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// frontend/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/cart");
}
```

- [ ] **Step 5: Install dependencies and verify the dev server boots**

Run: `cd frontend && npm install && npm run build`
Expected: build succeeds (redirect-only home page, no other routes yet)

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/next.config.js frontend/vitest.config.ts frontend/.env.example frontend/app frontend/lib/types.ts
git commit -m "feat: frontend scaffold with branding and shared types"
```

---

### Task 6: Market and basket state (localStorage), with unit tests

**Files:**
- Create: `frontend/lib/market.ts`, `frontend/lib/basket.ts`
- Test: `frontend/__tests__/market.test.ts`, `frontend/__tests__/basket.test.ts`

**Interfaces:**
- Consumes: `Market`, `BasketLine` types from Task 5.
- Produces: `getMarket(): Market`, `setMarket(market: Market): void` in `lib/market.ts` — consumed by Tasks 7–10.
- Produces: `getBasket(): BasketLine[]`, `addItem(productId: string): BasketLine[]`, `setQuantity(productId: string, quantity: number): BasketLine[]`, `removeItem(productId: string): BasketLine[]`, `clearBasket(): void` in `lib/basket.ts` — consumed by Tasks 8–9. All read/write `localStorage` under keys `iphone-case-study:market` and `iphone-case-study:basket`, and no-op safely when `window` is undefined (SSR).

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/__tests__/market.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { getMarket, setMarket } from "../lib/market";

describe("market", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to HK when nothing is stored", () => {
    expect(getMarket()).toBe("HK");
  });

  it("persists a chosen market across reads", () => {
    setMarket("NL");
    expect(getMarket()).toBe("NL");
  });
});
```

```ts
// frontend/__tests__/basket.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { addItem, clearBasket, getBasket, removeItem, setQuantity } from "../lib/basket";

describe("basket", () => {
  beforeEach(() => {
    localStorage.clear();
    clearBasket();
  });

  it("starts empty", () => {
    expect(getBasket()).toEqual([]);
  });

  it("adds an item, incrementing quantity on repeat adds", () => {
    addItem("clear-case");
    const basket = addItem("clear-case");
    expect(basket).toEqual([{ productId: "clear-case", quantity: 2 }]);
  });

  it("sets an exact quantity", () => {
    addItem("clear-case");
    const basket = setQuantity("clear-case", 5);
    expect(basket).toEqual([{ productId: "clear-case", quantity: 5 }]);
  });

  it("removes an item", () => {
    addItem("clear-case");
    const basket = removeItem("clear-case");
    expect(basket).toEqual([]);
  });

  it("persists across separate getBasket calls", () => {
    addItem("silicone-case-sage");
    expect(getBasket()).toEqual([{ productId: "silicone-case-sage", quantity: 1 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- __tests__/market.test.ts __tests__/basket.test.ts`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Write `lib/market.ts`**

```ts
// frontend/lib/market.ts
import type { Market } from "./types";

const STORAGE_KEY = "iphone-case-study:market";

export function getMarket(): Market {
  if (typeof window === "undefined") return "HK";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "NL" ? "NL" : "HK";
}

export function setMarket(market: Market): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, market);
}
```

- [ ] **Step 4: Write `lib/basket.ts`**

```ts
// frontend/lib/basket.ts
import type { BasketLine } from "./types";

const STORAGE_KEY = "iphone-case-study:basket";

function readBasket(): BasketLine[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as BasketLine[]) : [];
}

function writeBasket(basket: BasketLine[]): BasketLine[] {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
  }
  return basket;
}

export function getBasket(): BasketLine[] {
  return readBasket();
}

export function addItem(productId: string): BasketLine[] {
  const basket = readBasket();
  const existing = basket.find((line) => line.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    basket.push({ productId, quantity: 1 });
  }
  return writeBasket(basket);
}

export function setQuantity(productId: string, quantity: number): BasketLine[] {
  const basket = readBasket();
  const existing = basket.find((line) => line.productId === productId);
  if (existing) {
    existing.quantity = quantity;
  }
  return writeBasket(basket);
}

export function removeItem(productId: string): BasketLine[] {
  const basket = readBasket().filter((line) => line.productId !== productId);
  return writeBasket(basket);
}

export function clearBasket(): void {
  writeBasket([]);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm test -- __tests__/market.test.ts __tests__/basket.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/market.ts frontend/lib/basket.ts frontend/__tests__/market.test.ts frontend/__tests__/basket.test.ts
git commit -m "feat: localStorage-backed market and basket state"
```

---

### Task 7: Backend API client (frontend)

**Files:**
- Create: `frontend/lib/api.ts`
- Test: `frontend/__tests__/api.test.ts`

**Interfaces:**
- Consumes: `Market`, `Product`, `BasketLine` types from Task 5; `NEXT_PUBLIC_API_BASE_URL` env var.
- Produces: `fetchProducts(market: Market): Promise<Product[]>`, `createPaymentSession(market: Market, items: BasketLine[]): Promise<{ orderId: string; paymentSession: unknown }>`, `fetchPaymentStatus(orderId: string): Promise<{ orderId: string; status: string; amount: number; currency: string }>` — consumed by Tasks 8–10.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/__tests__/api.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentSession, fetchPaymentStatus, fetchProducts } from "../lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("fetchProducts calls the products endpoint with the market", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "clear-case", name: "Clear Case", description: "", image: "", price: 19900, currency: "EUR" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const products = await fetchProducts("NL");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/products?market=NL"));
    expect(products[0].currency).toBe("EUR");
  });

  it("createPaymentSession posts market and items, and maps snake_case to camelCase", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ order_id: "order-1", payment_session: { id: "ps_1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaymentSession("HK", [{ productId: "clear-case", quantity: 1 }]);

    expect(result).toEqual({ orderId: "order-1", paymentSession: { id: "ps_1" } });
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(requestInit.body)).toEqual({
      market: "HK",
      items: [{ product_id: "clear-case", quantity: 1 }],
    });
  });

  it("fetchPaymentStatus maps snake_case order_id to camelCase orderId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ order_id: "order-1", status: "paid", amount: 19900, currency: "EUR" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPaymentStatus("order-1");

    expect(result).toEqual({ orderId: "order-1", status: "paid", amount: 19900, currency: "EUR" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- __tests__/api.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Write `lib/api.ts`**

```ts
// frontend/lib/api.ts
import type { BasketLine, Market, Product } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchProducts(market: Market): Promise<Product[]> {
  const response = await fetch(`${API_BASE_URL}/api/products?market=${market}`);
  if (!response.ok) throw new Error("Failed to fetch products");
  return response.json();
}

export async function createPaymentSession(
  market: Market,
  items: BasketLine[]
): Promise<{ orderId: string; paymentSession: unknown }> {
  const response = await fetch(`${API_BASE_URL}/api/payment-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      market,
      items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    }),
  });
  if (!response.ok) throw new Error("Failed to create payment session");
  const body = await response.json();
  return { orderId: body.order_id, paymentSession: body.payment_session };
}

export async function fetchPaymentStatus(orderId: string): Promise<{
  orderId: string;
  status: string;
  amount: number;
  currency: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/payments/${orderId}`);
  if (!response.ok) throw new Error("Failed to fetch payment status");
  const body = await response.json();
  return { orderId: body.order_id, status: body.status, amount: body.amount, currency: body.currency };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- __tests__/api.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/__tests__/api.test.ts
git commit -m "feat: typed API client for backend contract"
```

---

### Task 8: Cart page

**Files:**
- Create: `frontend/components/MarketToggle.tsx`, `frontend/components/ProductCard.tsx`, `frontend/components/BasketSummary.tsx`
- Create: `frontend/app/cart/page.tsx`
- Test: `frontend/__tests__/cart-page.test.tsx`

**Interfaces:**
- Consumes: `getMarket`/`setMarket` (Task 6), `getBasket`/`addItem`/`setQuantity`/`removeItem` (Task 6), `fetchProducts` (Task 7).
- Produces: `/cart` route, rendering products for the current market with add/remove/quantity controls, a running total, and a "Proceed to checkout" link to `/checkout` (disabled when the basket is empty) — the entry point Task 12's manual QA starts from.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/cart-page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartPage from "../app/cart/page";
import * as api from "../lib/api";
import { clearBasket } from "../lib/basket";

const PRODUCTS = [
  { id: "clear-case", name: "Clear Case", description: "", image: "", price: 19900, currency: "EUR" as const },
];

beforeEach(() => {
  localStorage.clear();
  clearBasket();
  vi.spyOn(api, "fetchProducts").mockResolvedValue(PRODUCTS);
});

describe("CartPage", () => {
  it("lists products and disables checkout when the basket is empty", async () => {
    render(<CartPage />);

    await waitFor(() => expect(screen.getByText("Clear Case")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /proceed to checkout/i })).toHaveAttribute("aria-disabled", "true");
  });

  it("adding a product enables checkout and shows a running total", async () => {
    const user = userEvent.setup();
    render(<CartPage />);

    await waitFor(() => expect(screen.getByText("Clear Case")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(await screen.findByText(/199\.00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /proceed to checkout/i })).toHaveAttribute("aria-disabled", "false");
  });
});
```

- [ ] **Step 2: Install test utilities and run test to verify it fails**

Run: `cd frontend && npm install --save-dev @testing-library/user-event@14.5.2 && npm test -- __tests__/cart-page.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Write `components/MarketToggle.tsx`**

```tsx
// frontend/components/MarketToggle.tsx
"use client";

import type { Market } from "../lib/types";

export function MarketToggle({ market, onChange }: { market: Market; onChange: (market: Market) => void }) {
  return (
    <div>
      <button type="button" disabled={market === "HK"} onClick={() => onChange("HK")}>
        Hong Kong (HKD)
      </button>
      <button type="button" disabled={market === "NL"} onClick={() => onChange("NL")}>
        Netherlands (EUR)
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Write `components/ProductCard.tsx` and `components/BasketSummary.tsx`**

```tsx
// frontend/components/ProductCard.tsx
import type { Product } from "../lib/types";

function formatPrice(price: number, currency: string): string {
  return `${currency} ${(price / 100).toFixed(2)}`;
}

export function ProductCard({ product, onAdd }: { product: Product; onAdd: (productId: string) => void }) {
  return (
    <div>
      <img src={product.image} alt={product.name} width={120} />
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <p>{formatPrice(product.price, product.currency)}</p>
      <button type="button" onClick={() => onAdd(product.id)}>
        Add to cart
      </button>
    </div>
  );
}

export { formatPrice };
```

```tsx
// frontend/components/BasketSummary.tsx
import type { BasketLine, Product } from "../lib/types";
import { formatPrice } from "./ProductCard";

interface Props {
  basket: BasketLine[];
  products: Product[];
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function BasketSummary({ basket, products, onSetQuantity, onRemove }: Props) {
  const lines = basket
    .map((line) => ({ line, product: products.find((product) => product.id === line.productId) }))
    .filter((entry): entry is { line: BasketLine; product: Product } => Boolean(entry.product));

  const total = lines.reduce((sum, { line, product }) => sum + line.quantity * product.price, 0);
  const currency = products[0]?.currency ?? "";

  return (
    <div>
      {lines.map(({ line, product }) => (
        <div key={product.id}>
          <span>{product.name}</span>
          <input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(event) => onSetQuantity(product.id, Number(event.target.value))}
            aria-label={`Quantity for ${product.name}`}
          />
          <button type="button" onClick={() => onRemove(product.id)}>
            Remove
          </button>
        </div>
      ))}
      <p>Total: {formatPrice(total, currency)}</p>
    </div>
  );
}
```

- [ ] **Step 5: Write `app/cart/page.tsx`**

```tsx
// frontend/app/cart/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BasketSummary } from "../../components/BasketSummary";
import { MarketToggle } from "../../components/MarketToggle";
import { ProductCard } from "../../components/ProductCard";
import { fetchProducts } from "../../lib/api";
import { addItem, getBasket, removeItem, setQuantity } from "../../lib/basket";
import { getMarket, setMarket } from "../../lib/market";
import type { BasketLine, Market, Product } from "../../lib/types";

export default function CartPage() {
  const [market, setMarketState] = useState<Market>("HK");
  const [products, setProducts] = useState<Product[]>([]);
  const [basket, setBasket] = useState<BasketLine[]>([]);

  useEffect(() => {
    setMarketState(getMarket());
    setBasket(getBasket());
  }, []);

  useEffect(() => {
    fetchProducts(market).then(setProducts);
  }, [market]);

  function handleMarketChange(next: Market) {
    setMarket(next);
    setMarketState(next);
  }

  function handleAdd(productId: string) {
    setBasket(addItem(productId));
  }

  function handleSetQuantity(productId: string, quantity: number) {
    setBasket(setQuantity(productId, quantity));
  }

  function handleRemove(productId: string) {
    setBasket(removeItem(productId));
  }

  const isEmpty = basket.length === 0;

  return (
    <main>
      <h1>iPhone Cases</h1>
      <MarketToggle market={market} onChange={handleMarketChange} />
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={handleAdd} />
      ))}
      <BasketSummary basket={basket} products={products} onSetQuantity={handleSetQuantity} onRemove={handleRemove} />
      <Link href="/checkout" aria-disabled={!isEmpty ? "false" : "true"} onClick={(event) => isEmpty && event.preventDefault()}>
        Proceed to checkout
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm test -- __tests__/cart-page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add frontend/components/MarketToggle.tsx frontend/components/ProductCard.tsx frontend/components/BasketSummary.tsx frontend/app/cart frontend/__tests__/cart-page.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: cart page with market toggle and basket controls"
```

---

### Task 9: Checkout page — basket summary, Payment Session creation, and Flow mount

**Files:**
- Create: `frontend/components/CheckoutFlowMount.tsx`
- Create: `frontend/app/checkout/page.tsx`
- Test: `frontend/__tests__/checkout-page.test.tsx`

**Interfaces:**
- Consumes: `getBasket` (Task 6), `getMarket` (Task 6), `fetchProducts`/`createPaymentSession` (Task 7), `BasketSummary` (Task 8).
- Produces: `/checkout` route. `CheckoutFlowMount` is a thin client component wrapping `loadCheckoutWebComponents` — its `paymentSession` prop is treated as opaque per Global Constraints, so it is not unit-tested against real Flow rendering (that needs a live sandbox session and a browser — see Task 12). The test below verifies the page's own logic: it fetches the basket total, calls `createPaymentSession`, and renders `CheckoutFlowMount` once the session exists, without asserting on Flow's internals.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/checkout-page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutPage from "../app/checkout/page";
import * as api from "../lib/api";
import { addItem, clearBasket } from "../lib/basket";

vi.mock("../components/CheckoutFlowMount", () => ({
  CheckoutFlowMount: ({ paymentSession }: { paymentSession: unknown }) => (
    <div data-testid="flow-mount">{JSON.stringify(paymentSession)}</div>
  ),
}));

const PRODUCTS = [
  { id: "clear-case", name: "Clear Case", description: "", image: "", price: 19900, currency: "EUR" as const },
];

beforeEach(() => {
  localStorage.clear();
  clearBasket();
  addItem("clear-case");
  vi.spyOn(api, "fetchProducts").mockResolvedValue(PRODUCTS);
  vi.spyOn(api, "createPaymentSession").mockResolvedValue({
    orderId: "order-1",
    paymentSession: { id: "ps_1" },
  });
});

describe("CheckoutPage", () => {
  it("shows the basket total and mounts Flow once the session is created", async () => {
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText(/199\.00/)).toBeInTheDocument());
    expect(api.createPaymentSession).toHaveBeenCalledWith("HK", [{ productId: "clear-case", quantity: 1 }]);
    expect(await screen.findByTestId("flow-mount")).toHaveTextContent('{"id":"ps_1"}');
  });

  it("shows an error message when session creation fails", async () => {
    vi.spyOn(api, "createPaymentSession").mockRejectedValue(new Error("network error"));

    render(<CheckoutPage />);

    expect(await screen.findByText(/couldn't start checkout/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- __tests__/checkout-page.test.tsx`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Write `components/CheckoutFlowMount.tsx`**

```tsx
// frontend/components/CheckoutFlowMount.tsx
"use client";

import { useEffect, useRef } from "react";

interface Props {
  paymentSession: unknown;
  onPaymentCompleted: (paymentId: string) => void;
  onError: (message: string) => void;
}

export function CheckoutFlowMount({ paymentSession, onPaymentCompleted, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountFlow() {
      const { loadCheckoutWebComponents } = await import("@checkout.com/checkout-web-components");
      const checkout = await loadCheckoutWebComponents({
        publicKey: process.env.NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY!,
        environment: "sandbox",
        paymentSession,
        onPaymentCompleted: (_component: unknown, paymentResponse: { id: string }) => {
          onPaymentCompleted(paymentResponse.id);
        },
        onError: (_component: unknown, error: { message?: string }) => {
          onError(error.message ?? "Payment failed");
        },
      });

      if (cancelled || !containerRef.current) return;
      const flowComponent = checkout.create("flow");
      flowComponent.mount(containerRef.current);
    }

    mountFlow().catch((error) => onError(error instanceof Error ? error.message : "Failed to load payment form"));

    return () => {
      cancelled = true;
    };
  }, [paymentSession, onPaymentCompleted, onError]);

  return <div ref={containerRef} id="flow-container" />;
}
```

Note: per Global Constraints, this loader must never be manually bundled — `import("@checkout.com/checkout-web-components")` stays dynamic so Next.js keeps it as a runtime-loaded chunk, and the loader itself fetches the actual Flow UI from `https://checkout-web-components.checkout.com` at runtime, never from our own bundle.

- [ ] **Step 4: Write `app/checkout/page.tsx`**

```tsx
// frontend/app/checkout/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutFlowMount } from "../../components/CheckoutFlowMount";
import { createPaymentSession, fetchProducts } from "../../lib/api";
import { getBasket } from "../../lib/basket";
import { getMarket } from "../../lib/market";
import { formatPrice } from "../../components/ProductCard";
import type { BasketLine, Product } from "../../lib/types";

export default function CheckoutPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [paymentSession, setPaymentSession] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const market = getMarket();
    const currentBasket = getBasket();
    setBasket(currentBasket);

    fetchProducts(market).then(setProducts).catch(() => setError("Couldn't load your basket"));

    createPaymentSession(market, currentBasket)
      .then(({ orderId, paymentSession }) => {
        setPaymentSession(paymentSession);
        window.sessionStorage.setItem("orderId", orderId);
      })
      .catch(() => setError("Couldn't start checkout — please try again"));
  }, []);

  const total = basket.reduce((sum, line) => {
    const product = products.find((product) => product.id === line.productId);
    return product ? sum + product.price * line.quantity : sum;
  }, 0);
  const currency = products[0]?.currency ?? "";

  function handlePaymentCompleted(paymentId: string) {
    const orderId = window.sessionStorage.getItem("orderId");
    router.push(`/checkout/success?order_id=${orderId}&outcome=success&payment_id=${paymentId}`);
  }

  return (
    <main>
      <h1>Checkout</h1>
      <p>Total: {formatPrice(total, currency)}</p>
      {error && <p role="alert">{error}</p>}
      {paymentSession && (
        <CheckoutFlowMount paymentSession={paymentSession} onPaymentCompleted={handlePaymentCompleted} onError={setError} />
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm test -- __tests__/checkout-page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/components/CheckoutFlowMount.tsx frontend/app/checkout/page.tsx frontend/__tests__/checkout-page.test.tsx
git commit -m "feat: checkout page creates a payment session and mounts Flow"
```

---

### Task 10: Success page

**Files:**
- Create: `frontend/app/checkout/success/page.tsx`
- Test: `frontend/__tests__/success-page.test.tsx`

**Interfaces:**
- Consumes: `fetchPaymentStatus` from Task 7. Reads `order_id` and `outcome` from the URL query string (set either by Checkout.com's redirect per the API Contract, or by Task 9's `onPaymentCompleted` push).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/__tests__/success-page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SuccessPage from "../app/checkout/success/page";
import * as api from "../lib/api";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("order_id=order-1&outcome=success"),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SuccessPage", () => {
  it("shows a confirmation once the backend confirms payment as paid", async () => {
    vi.spyOn(api, "fetchPaymentStatus").mockResolvedValue({
      orderId: "order-1",
      status: "paid",
      amount: 19900,
      currency: "EUR",
    });

    render(<SuccessPage />);

    expect(await screen.findByText(/payment confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/order-1/)).toBeInTheDocument();
  });

  it("shows a failure message and a link back to checkout when declined", async () => {
    vi.spyOn(api, "fetchPaymentStatus").mockResolvedValue({
      orderId: "order-1",
      status: "declined",
      amount: 19900,
      currency: "EUR",
    });

    render(<SuccessPage />);

    expect(await screen.findByText(/payment wasn't successful/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to checkout/i })).toHaveAttribute("href", "/checkout");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- __tests__/success-page.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Write `app/checkout/success/page.tsx`**

```tsx
// frontend/app/checkout/success/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchPaymentStatus } from "../../../lib/api";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function poll() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const result = await fetchPaymentStatus(orderId!);
        if (cancelled) return;
        if (result.status !== "pending") {
          setStatus(result.status);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!cancelled) setStatus("pending");
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!orderId) {
    return <p role="alert">Missing order reference.</p>;
  }

  if (status === null) {
    return <p>Confirming your payment…</p>;
  }

  if (status === "paid") {
    return (
      <main>
        <h1>Payment confirmed</h1>
        <p>Order reference: {orderId}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Payment wasn't successful</h1>
      <p>Order reference: {orderId}</p>
      <Link href="/checkout">Return to checkout</Link>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- __tests__/success-page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd frontend && npm test`
Expected: PASS (all tests from Tasks 5–10)

- [ ] **Step 6: Commit**

```bash
git add frontend/app/checkout/success
git commit -m "feat: success page polls payment status and handles failure"
```

---

### Task 11: Root README, .gitignore, and env var wiring

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Verify: `backend/.env.example` and `frontend/.env.example` (from Tasks 1 and 5) match this README's instructions

**Interfaces:** None — this task is documentation and repo hygiene, not code.

- [ ] **Step 1: Write `.gitignore`**

```
# .gitignore
backend/.env
frontend/.env
frontend/.env.local
node_modules/
.next/
__pycache__/
*.pyc
.pytest_cache/
```

- [ ] **Step 2: Verify no real secrets are staged**

Run: `git status --short && git grep -n "sk_" -- ':!*.example' || true`
Expected: no `.env` files listed under `git status`, and no `sk_` matches outside `.env.example` files.

- [ ] **Step 3: Write `README.md`**

```markdown
# iPhone Case Study — Checkout Integration

A cart + checkout flow for an iPhone-case merchant selling in Hong Kong (HKD) and
the Netherlands (EUR), using Checkout.com's Flow to accept cards and Apple Pay
without the backend ever seeing raw card data.

## Stack

- `backend/` — FastAPI. Holds the Checkout.com secret key, creates Payment
  Sessions, verifies and processes webhooks. In-memory order store (resets on
  restart — this is a local demo, not a production order system).
- `frontend/` — Next.js (App Router, TypeScript). Cart, checkout, and success
  pages. Mounts Checkout.com's Flow component client-side with the public key.

## Prerequisites

- Python 3.11+
- Node.js 20+
- A Checkout.com sandbox account with a public key, secret key, and webhook
  signing secret (see "Getting sandbox credentials" below if you don't have
  these yet).

## Setup

### 1. Backend

\`\`\`bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: fill in CHECKOUT_SECRET_KEY and CHECKOUT_WEBHOOK_SECRET
uvicorn app.main:app --reload --port 8000
\`\`\`

### 2. Frontend

\`\`\`bash
cd frontend
npm install
cp .env.example .env.local
# edit .env.local: fill in NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY
npm run dev
\`\`\`

Open http://localhost:3000 — it redirects to `/cart`.

### 3. Webhooks (needed for order status to update)

Checkout.com needs to reach `POST /api/webhooks/checkout` on your backend. For
local development, expose it with a tunnel (e.g. `ngrok http 8000`) and add
`https://<your-tunnel>/api/webhooks/checkout` as a webhook endpoint in the
Checkout.com sandbox Dashboard, subscribed to at least: `payment_approved`,
`payment_captured`, `payment_declined`, `payment_failed`, `payment_expired`.
Copy the webhook's signing secret into `backend/.env` as
`CHECKOUT_WEBHOOK_SECRET`.

## Running the tests

\`\`\`bash
cd backend && pytest
cd frontend && npm test
\`\`\`

## Testing a real sandbox payment

1. With both servers running (and the webhook tunnel active), go to
   http://localhost:3000/cart, add a product, and click "Proceed to checkout".
2. **Card:** use a Checkout.com test card (e.g. `4242 4242 4242 4242`, any
   future expiry, any CVC) in the Flow card form.
3. **Apple Pay:** only appears in Safari on a device with Apple Pay set up
   (real or simulator with a sandbox tester Apple ID signed in). It also
   requires the sandbox account to have Apple Pay configured (Apple Merchant
   ID, processing certificate, domain verification) — see "Apple Pay setup"
   below.
4. After paying, you land on `/checkout/success`, which polls the backend
   until the webhook has updated the order's status.

## Apple Pay setup (account-level, not code)

Apple Pay won't appear in Flow until, in the Checkout.com Dashboard:
- An Apple Merchant ID and processing certificate are registered.
- Your domain (or `localhost` tunnel domain, for testing) is verified for
  Apple Pay.

This is a one-time account configuration step outside this codebase.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `CHECKOUT_SECRET_KEY` | `backend/.env` | Authenticates server-side calls to Checkout.com |
| `CHECKOUT_WEBHOOK_SECRET` | `backend/.env` | Verifies the `Cko-Signature` header on incoming webhooks |
| `CHECKOUT_PROCESSING_CHANNEL_ID` | `backend/.env` | Only needed if your sandbox account has more than one processing channel |
| `CHECKOUT_API_BASE_URL` | `backend/.env` | Defaults to the sandbox API; don't point at production |
| `FRONTEND_BASE_URL` | `backend/.env` | Used to build the success/failure redirect URLs sent to Checkout.com |
| `NEXT_PUBLIC_API_BASE_URL` | `frontend/.env.local` | Where the frontend calls the backend |
| `NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY` | `frontend/.env.local` | Public key used to mount Flow client-side |

Real values (even sandbox ones) only ever go in `.env` / `.env.local`, both
gitignored. If this repo is ever made public or shared beyond the immediate
team, rotate the sandbox keys first.

## Scope notes

- v1 supports cards and Apple Pay only (see PRD §8 for what's out of scope:
  iDEAL, UnionPay, Alipay, multi-language localization, real payment
  processing).
- Market (HK/NL) is picked with a manual toggle on the cart page — there's no
  geo-detection.
- Customer name/email sent to Checkout.com are placeholders; there's no
  guest-checkout form in v1.
- Orders live in backend process memory and are lost on restart.
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore README.md
git commit -m "docs: add README and gitignore for env files"
```

---

### Task 12: Manual sandbox verification (card + Apple Pay)

**Files:** None — this is a manual QA pass against the running app, using the credentials from PRD §7.1. No code changes unless a bug is found, in which case fix it in the relevant file from Tasks 1–11 and re-run that task's automated tests before continuing.

**Interfaces:** None.

- [ ] **Step 1: Start both servers**

Run: `cd backend && uvicorn app.main:app --reload --port 8000` (separate terminal)
Run: `cd frontend && npm run dev` (separate terminal)
Expected: backend on `http://localhost:8000`, frontend on `http://localhost:3000`

- [ ] **Step 2: Expose the webhook endpoint and register it in the Checkout.com Dashboard**

Run: `ngrok http 8000` (or equivalent tunnel)
Then in the Checkout.com sandbox Dashboard, add a webhook pointing at `https://<tunnel>/api/webhooks/checkout` for `payment_approved`, `payment_captured`, `payment_declined`, `payment_failed`, `payment_expired`, and copy its signing secret into `backend/.env` as `CHECKOUT_WEBHOOK_SECRET`. Restart the backend after editing `.env`.

- [ ] **Step 3: Complete a card payment end-to-end**

In a browser: go to `http://localhost:3000/cart`, add a product, click "Proceed to checkout", enter test card `4242 4242 4242 4242` (any future expiry/CVC) into the Flow card form, submit.
Expected: redirected to `/checkout/success?order_id=...&outcome=success`, page shows "Payment confirmed" within a few seconds (once the webhook lands).

- [ ] **Step 4: Verify no card data reached the backend**

With browser devtools open (Network tab) during Step 3, inspect every request made to `http://localhost:8000`.
Expected: none of them contain a card number, expiry, or CVC in the request body — only `POST /api/payment-sessions` (basket contents) and `GET /api/payments/{order_id}` (status polling) are called. Card fields only ever appear in requests to Checkout.com's own domains.

- [ ] **Step 5: Complete an Apple Pay payment end-to-end**

On a Safari browser/device signed in with an Apple Pay sandbox tester account (set up per PRD's Apple Pay setup dependency — Apple Merchant ID, processing certificate, and domain verification must already be configured in the Dashboard, or the Apple Pay button won't render at all): repeat Step 3, but choose the Apple Pay option in Flow instead of entering card details.
Expected: same outcome as Step 3 — success page confirms payment.

- [ ] **Step 6: Verify a declined-card failure path**

Repeat Step 3 using Checkout.com's documented "always declined" test card instead of `4242...`.
Expected: redirected to `/checkout/success?order_id=...&outcome=failure`, page shows "Payment wasn't successful" and a working "Return to checkout" link.

- [ ] **Step 7: Verify webhook-driven status, not just the redirect**

During Step 3, before the success page's polling completes, check `backend`'s logs or add a temporary `print(payload)` in `handle_checkout_webhook` (`backend/app/routers/webhooks.py`) to confirm the webhook actually arrived and the order's status changed as a result of the webhook call, not just the browser redirect.
Expected: webhook log line appears; if `handle_checkout_webhook` weren't called at all, the order would stay `"pending"` forever since nothing else updates it — this proves order status is genuinely webhook-driven per PRD §5.5.

- [ ] **Step 8: Record the outcome**

No commit needed for this task (no files changed) unless Step 3–7 surfaced a bug — if so, fix it in the owning task's files, re-run that task's `pytest`/`npm test`, commit the fix with a message describing the bug, then resume from Step 3.

---

### Task 13: Publish to GitHub

**Files:** None — repository-level operation.

**Interfaces:** None.

> **This task requires explicit user confirmation before pushing** — creating a repository and pushing code makes it visible to others (or at least leaves the user's account with a new public/private artifact) and is not something to do unopposed. Confirm the destination (repo name, visibility) with the user before running Step 2.

- [ ] **Step 1: Verify everything is committed and no secrets are staged**

Run: `git status --short`
Expected: clean (nothing to commit) — if anything's unstaged, review it first; if a `.env` file shows up, stop and check `.gitignore` from Task 11 rather than committing it.

- [ ] **Step 2: Create the GitHub repository and push (after user confirms name/visibility)**

```bash
gh repo create <repo-name> --private --source=. --remote=origin
git push -u origin main
```

- [ ] **Step 3: Confirm the README renders correctly on GitHub**

Open the pushed repo's URL and check the README's setup instructions display correctly, then share the URL with the user.

---

## Self-Review Notes

- **Spec coverage:** §5.1–5.4 pages → Tasks 8–10; §5.5 payment execution (webhook-driven fulfillment) → Task 4 + verified manually in Task 12 Step 7; §5.6 branding → Task 5's `globals.css` + component styling; §6 non-functional (PCI/security/responsiveness) → Global Constraints + Task 9's dynamic-import note + Task 12 Step 4; §7 delivery (repo, README, gitignored env) → Tasks 11 and 13; §9 acceptance criteria map 1:1 onto Tasks 1–13 as listed above.
- **Placeholder scan:** no "TBD"/"handle errors appropriately" left — every step has runnable code; the one open item from the PRD (webhook signature `TODO`) is implemented for real in Task 4, not left as a comment.
- **Type consistency:** `order_id` (snake_case, backend/API) vs `orderId` (camelCase, frontend) is intentional and consistent — `lib/api.ts` (Task 7) is the single place that translates between them; every later frontend task consumes the camelCase form. `BasketLine` (frontend) and `BasketItem` (backend) name the same shape deliberately differently since they're different languages' models connected only by the JSON contract in "API Contract" — not a mismatch to fix.
