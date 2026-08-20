import logging
import uuid

import httpx
from fastapi import APIRouter, HTTPException

from app.checkout_client import CheckoutComClient
from app.config import get_settings
from app.models import PaymentSessionRequest, PaymentSessionResponse, PaymentStatusResponse
from app.orders import order_store
from app.products import MARKET_CURRENCY, get_product, get_product_price

router = APIRouter()

logger = logging.getLogger(__name__)

BILLING_COUNTRY = {"HK": "HK", "NL": "NL"}


@router.post("/api/payment-sessions", status_code=201, response_model=PaymentSessionResponse)
async def create_payment_session(body: PaymentSessionRequest):
    settings = get_settings()

    if not body.items:
        raise HTTPException(status_code=400, detail="Basket must contain at least one item")

    try:
        amount = sum(get_product_price(item.product_id, body.market) * item.quantity for item in body.items)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Unknown product_id: {exc.args[0]}") from exc

    currency = MARKET_CURRENCY[body.market]
    order_id = str(uuid.uuid4())
    order_store.create(order_id, body.market, currency, amount, body.items)

    # payment_type and items[] aren't needed for card/wallet payments, but
    # several redirect/QR payment methods (WeChat Pay, Alipay, PayPal) require
    # them to even be considered eligible for a session — see e.g.
    # https://www.checkout.com/docs/payments/add-payment-methods/wechat-pay/web
    items = [
        {
            "reference": item.product_id,
            "name": get_product(item.product_id)["name"],
            "quantity": item.quantity,
            "unit_price": get_product_price(item.product_id, body.market),
        }
        for item in body.items
    ]

    client = CheckoutComClient(
        secret_key=settings.checkout_secret_key,
        base_url=settings.checkout_api_base_url,
        processing_channel_id=settings.checkout_processing_channel_id,
    )
    try:
        payment_session = await client.create_payment_session(
            amount=amount,
            currency=currency,
            country=BILLING_COUNTRY[body.market],
            reference=order_id,
            customer_name=body.customer_name,
            customer_email=body.customer_email,
            items=items,
            success_url=f"{settings.frontend_base_url}/checkout/success?order_id={order_id}&outcome=success",
            failure_url=f"{settings.frontend_base_url}/checkout/success?order_id={order_id}&outcome=failure",
        )
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Checkout.com payment session creation failed: status=%s body=%s",
            exc.response.status_code,
            exc.response.text,
        )
        raise HTTPException(status_code=502, detail="Failed to create payment session with Checkout.com") from exc

    return PaymentSessionResponse(order_id=order_id, payment_session=payment_session)


@router.get("/api/payments/{order_id}", response_model=PaymentStatusResponse)
def get_payment_status(order_id: str):
    order = order_store.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return PaymentStatusResponse(order_id=order.id, status=order.status, amount=order.amount, currency=order.currency)
