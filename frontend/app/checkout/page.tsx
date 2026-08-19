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
      {Boolean(paymentSession) && (
        <CheckoutFlowMount paymentSession={paymentSession} onPaymentCompleted={handlePaymentCompleted} onError={setError} />
      )}
    </main>
  );
}
