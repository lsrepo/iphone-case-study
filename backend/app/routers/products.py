from typing import Literal

from fastapi import APIRouter

from app.products import get_products_for_market

router = APIRouter()


@router.get("/api/products")
def list_products(market: Literal["HK", "NL"]):
    return get_products_for_market(market)
