// frontend/app/checkout/success/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { clearBasket } from "../../../lib/basket";

// Keys match Checkout.com Flow's PaymentDeclineReason enum, surfaced via
// onError's `details.requestErrorCodes` when a card is declined.
const DECLINE_REASON_MESSAGES: Record<string, string> = {
  not_enough_funds: "The card was declined for insufficient funds.",
  invalid_payment_session_data: "The payment couldn't be processed — please try again.",
  invalid_customer_data: "The payment couldn't be processed — please try again.",
  customer_misconfiguration: "The payment couldn't be processed — please try again.",
  merchant_misconfiguration: "The payment couldn't be processed — please contact support.",
  try_again: "The card was declined — please try again.",
  payment_cancelled: "The payment was cancelled.",
  payment_expired: "The payment session expired — please try again.",
};

export default function SuccessPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <SuccessPageContent />
    </Suspense>
  );
}

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const outcome = searchParams.get("outcome");
  const reason = searchParams.get("reason");
  const paymentId = searchParams.get("payment_id");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  // Flow already told the browser the outcome directly (via onPaymentCompleted
  // or onError) before redirecting here — this page just renders that outcome,
  // it doesn't need to ask the backend and wait for anything.
  useEffect(() => {
    if (outcome === "success") {
      clearBasket();
    }
  }, [outcome]);

  if (!orderId) {
    return (
      <p role="alert" className="error-text">
        Missing order reference.
      </p>
    );
  }

  if (outcome === "success") {
    const outcomeJson = JSON.stringify(
      { order_id: orderId, payment_id: paymentId, status, type },
      null,
      2
    );

    return (
      <main className="page page--narrow">
        <h1>Payment confirmed</h1>
        <p>Order reference: {orderId}</p>
        <pre className="code-block">
          <code>{outcomeJson}</code>
        </pre>
      </main>
    );
  }

  return (
    <main className="page page--narrow">
      <h1>Payment wasn't successful</h1>
      <p>{(reason && DECLINE_REASON_MESSAGES[reason]) ?? "Please try again with a different card."}</p>
      <p>Order reference: {orderId}</p>
      <Link href="/checkout" className="button-link">
        Return to checkout
      </Link>
    </main>
  );
}
