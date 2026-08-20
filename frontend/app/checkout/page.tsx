// frontend/app/checkout/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PayPaymentSessionSuccessfulResponse } from "@checkout.com/checkout-web-components";
import { CheckoutFlowMount } from "../../components/CheckoutFlowMount";
import { TestCardPicker } from "../../components/TestCardPicker";
import { createPaymentSession, fetchPaymentStatus, fetchProducts } from "../../lib/api";
import { getBasket } from "../../lib/basket";
import { getMarket } from "../../lib/market";
import { MARKET_LOCALES } from "../../lib/locales";
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
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Prefilled with demo defaults so the checkout flow can be run without
  // typing anything — this is a sandbox demo, not a real storefront.
  const [customerName, setCustomerName] = useState("Jordan Smith");
  const [customerEmail, setCustomerEmail] = useState("jordan.smith@email.com");
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
  const locale = MARKET_LOCALES[market];

  async function handleDetailsSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { orderId, paymentSession, requestBody } = await createPaymentSession(market, basket, customerName, customerEmail);
      setPaymentSession(paymentSession);
      setOrderId(orderId);
      window.sessionStorage.setItem("orderId", orderId);
      window.sessionStorage.setItem("paymentRequest", JSON.stringify(requestBody));
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

  // Fallback for payment methods that never fire Flow's own callbacks — e.g.
  // WeChat Pay and Alipay show a QR code the customer scans with their phone,
  // so nothing in this page witnesses the completion the way it does for
  // card/Apple Pay/Google Pay. The only way to learn the outcome is to poll
  // our backend, which itself only updates once a webhook arrives. For
  // card/wallet payments this never gets a chance to matter, since their own
  // callback resolves and navigates away first.
  useEffect(() => {
    if (!orderId || !paymentSession) return;

    let cancelled = false;

    async function poll() {
      for (let attempt = 0; !cancelled && attempt < 200; attempt += 1) {
        try {
          const result = await fetchPaymentStatus(orderId!);
          if (cancelled) return;
          if (result.status === "paid" || result.status === "declined" || result.status === "failed") {
            const outcome = result.status === "paid" ? "success" : "failure";
            const params = new URLSearchParams({ order_id: orderId!, outcome });
            routerRef.current.push(`/checkout/success?${params.toString()}`);
            return;
          }
        } catch {
          // transient network error — keep polling
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [orderId, paymentSession]);

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
          <button type="submit" disabled={submitting}>
            {submitting ? "Loading…" : "Continue to payment"}
          </button>
        </form>
      )}
    </main>
  );
}
