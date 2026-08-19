from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import payments, products, webhooks

app = FastAPI(title="iPhone Case Study Checkout API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(payments.router)
app.include_router(webhooks.router)
