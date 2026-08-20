from dataclasses import dataclass

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
