import type { BasketLine, Market, Product } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchProducts(market: Market): Promise<Product[]> {
  const response = await fetch(`${API_BASE_URL}/api/products?market=${market}`);
  if (!response.ok) throw new Error("Failed to fetch products");
  return response.json();
}

export async function createPaymentSession(
  market: Market,
  items: BasketLine[],
  customerName: string,
  customerEmail: string
): Promise<{ orderId: string; paymentSession: unknown; requestBody: unknown }> {
  const requestBody = {
    market,
    items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    customer_name: customerName,
    customer_email: customerEmail,
  };
  const response = await fetch(`${API_BASE_URL}/api/payment-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) throw new Error("Failed to create payment session");
  const body = await response.json();
  return { orderId: body.order_id, paymentSession: body.payment_session, requestBody };
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
