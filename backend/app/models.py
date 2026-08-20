from typing import Literal

from pydantic import BaseModel, Field

OrderStatus = Literal["pending", "paid", "declined", "failed"]
Market = Literal["HK", "NL"]


class BasketItem(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)


EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class PaymentSessionRequest(BaseModel):
    market: Market
    items: list[BasketItem]
    customer_name: str = Field(min_length=1, max_length=200)
    customer_email: str = Field(pattern=EMAIL_PATTERN, max_length=200)


class PaymentSessionResponse(BaseModel):
    order_id: str
    payment_session: dict


class PaymentStatusResponse(BaseModel):
    order_id: str
    status: OrderStatus
    amount: int
    currency: str
