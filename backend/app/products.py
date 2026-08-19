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
