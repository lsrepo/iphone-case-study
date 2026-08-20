// frontend/app/checkout/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PayPaymentSessionSuccessfulResponse } from "@checkout.com/checkout-web-components";
import { CheckoutFlowMount } from "../../components/CheckoutFlowMount";
import { TestCardPicker } from "../../components/TestCardPicker";
import { createPaymentSession, fetchProducts } from "../../lib/api";
import { getBasket } from "../../lib/basket";
import { getMarket } from "../../lib/market";
import { FLOW_LOCALES } from "../../lib/locales";
import { formatPrice } from "../../components/ProductCard";
import type { BasketLine, Market, Product } from "../../lib/types";

export default function CheckoutPage() {
  const router = useRouter();
  // Keep the latest router in a ref rather than depending on its identity being
  // stable across renders — that keeps handlePaymentCompleted's own identity
  // trivially stable (empty dep array) regardless of what useRouter() returns.
  const routerRef = useRef(router);
  routerRef.current = router;
  const [market, setMarketState] = useState<Market>("HK");
  const [products, setProducts] = useState<Product[]>([]);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [paymentSession, setPaymentSession] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [locale, setLocale] = useState(FLOW_LOCALES[0].code);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const currentMarket = getMarket();
    const currentBasket = getBasket();

    if (currentBasket.length === 0) {
      routerRef.current.push("/cart");
      return;
    }

    setMarketState(currentMarket);
    setBasket(currentBasket);

    fetchProducts(currentMarket).then(setProducts).catch(() => setError("Couldn't load your basket"));
  }, []);

  const total = basket.reduce((sum, line) => {
    const product = products.find((product) => product.id === line.productId);
    return product ? sum + product.price * line.quantity : sum;
  }, 0);
  const currency = products[0]?.currency ?? "";

  async function handleDetailsSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { orderId, paymentSession } = await createPaymentSession(market, basket, customerName, customerEmail);
      setPaymentSession(paymentSession);
      window.sessionStorage.setItem("orderId", orderId);
    } catch {
      setError("Couldn't start checkout — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  // Stable identity across re-renders (e.g. when setError fires after a declined
  // card) so CheckoutFlowMount's effect doesn't see a "new" callback and re-run,
  // which would otherwise re-mount Flow into the same container on every error.
  const handlePaymentCompleted = useCallback((payment: PayPaymentSessionSuccessfulResponse) => {
    const orderId = window.sessionStorage.getItem("orderId") ?? "";
    const params = new URLSearchParams({
      order_id: orderId,
      outcome: "success",
      payment_id: payment.id,
      status: payment.status,
      type: payment.type,
    });
    routerRef.current.push(`/checkout/success?${params.toString()}`);
  }, []);

  const handlePaymentDeclined = useCallback((paymentId: string, reason?: string) => {
    const orderId = window.sessionStorage.getItem("orderId") ?? "";
    const params = new URLSearchParams({ order_id: orderId, outcome: "failure", payment_id: paymentId });
    if (reason) params.set("reason", reason);
    routerRef.current.push(`/checkout/success?${params.toString()}`);
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
      {paymentSession ? (
        <>
          <TestCardPicker />
          <CheckoutFlowMount
            paymentSession={paymentSession}
            customerName={customerName}
            customerEmail={customerEmail}
            locale={locale}
            onPaymentCompleted={handlePaymentCompleted}
            onPaymentDeclined={handlePaymentDeclined}
            onError={handleFlowError}
          />
        </>
      ) : (
        <form className="checkout-details-form" onSubmit={handleDetailsSubmit}>
          <div className="form-field">
            <label htmlFor="customer-name">Full name</label>
            <input
              id="customer-name"
              type="text"
              required
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Jordan Smith"
            />
          </div>
          <div className="form-field">
            <label htmlFor="customer-email">Email address</label>
            <input
              id="customer-email"
              type="email"
              required
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="jordan.smith@email.com"
            />
          </div>
          <div className="form-field">
            <label htmlFor="checkout-locale">Payment form language</label>
            <select id="checkout-locale" value={locale} onChange={(event) => setLocale(event.target.value)}>
              {FLOW_LOCALES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? "Loading…" : "Continue to payment"}
          </button>
        </form>
      )}
    </main>
  );
}
