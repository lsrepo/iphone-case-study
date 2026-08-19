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
