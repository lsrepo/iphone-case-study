PRODUCTS = [
    {
        "id": "silicone-case-sage",
        "name": "Silicone Case",
        "description": "Soft-touch silicone, precision-molded for a slim, secure fit.",
        "image": "/products/silicone-case.jpg",
        "prices": {"HKD": 25000, "EUR": 2500},
    },
    {
        "id": "clear-case",
        "name": "Leather Case",
        "description": "Fine leather with a soft microfiber lining that ages naturally with use.",
        "image": "/products/leather-case.jpg",
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
