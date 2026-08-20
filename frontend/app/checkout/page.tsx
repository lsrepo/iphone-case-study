// frontend/app/checkout/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutFlowMount } from "../../components/CheckoutFlowMount";
import { createPaymentSession, fetchProducts } from "../../lib/api";
import { getBasket } from "../../lib/basket";
import { getMarket } from "../../lib/market";
import { formatPrice } from "../../components/ProductCard";
import type { BasketLine, Product } from "../../lib/types";

export default function CheckoutPage() {
  const router = useRouter();
  // Keep the latest router in a ref rather than depending on its identity being
  // stable across renders — that keeps handlePaymentCompleted's own identity
  // trivially stable (empty dep array) regardless of what useRouter() returns.
  const routerRef = useRef(router);
  routerRef.current = router;
  const [products, setProducts] = useState<Product[]>([]);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [paymentSession, setPaymentSession] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const market = getMarket();
    const currentBasket = getBasket();

    if (currentBasket.length === 0) {
      routerRef.current.push("/cart");
      return;
    }

    setBasket(currentBasket);

    fetchProducts(market).then(setProducts).catch(() => setError("Couldn't load your basket"));

    createPaymentSession(market, currentBasket)
      .then(({ orderId, paymentSession }) => {
        setPaymentSession(paymentSession);
        window.sessionStorage.setItem("orderId", orderId);
      })
      .catch(() => setError("Couldn't start checkout — please try again"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = basket.reduce((sum, line) => {
    const product = products.find((product) => product.id === line.productId);
    return product ? sum + product.price * line.quantity : sum;
  }, 0);
  const currency = products[0]?.currency ?? "";

  // Stable identity across re-renders (e.g. when setError fires after a declined
  // card) so CheckoutFlowMount's effect doesn't see a "new" callback and re-run,
  // which would otherwise re-mount Flow into the same container on every error.
  const handlePaymentCompleted = useCallback((paymentId: string) => {
    const orderId = window.sessionStorage.getItem("orderId");
    routerRef.current.push(`/checkout/success?order_id=${orderId}&outcome=success&payment_id=${paymentId}`);
  }, []);

  const handleFlowError = useCallback((message: string) => {
    setError(message);
  }, []);

  return (
    <main className="page page--narrow">
      <h1>Checkout</h1>
      <p className="checkout-total">Total: {formatPrice(total, currency)}</p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {Boolean(paymentSession) && (
        <CheckoutFlowMount paymentSession={paymentSession} onPaymentCompleted={handlePaymentCompleted} onError={handleFlowError} />
      )}
    </main>
  );
}
