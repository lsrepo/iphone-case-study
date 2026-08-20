"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchPaymentStatus } from "../../../lib/api";
import { clearBasket } from "../../../lib/basket";

export default function SuccessPage() {
  return (
    <Suspense fallback={<p>Confirming your payment…</p>}>
      <SuccessPageContent />
    </Suspense>
  );
}

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function poll() {
      let lastAttemptErrored = false;

      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          const result = await fetchPaymentStatus(orderId!);
          if (cancelled) return;
          lastAttemptErrored = false;
          if (result.status !== "pending") {
            setStatus(result.status);
            return;
          }
        } catch {
          if (cancelled) return;
          lastAttemptErrored = true;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Either the poll kept erroring, or the backend genuinely still reports
      // "pending" after the cap — neither means the payment failed, so don't
      // reuse the decline/failure branch for this. Surface a distinct state.
      if (!cancelled) setStatus(lastAttemptErrored ? "error" : "timeout");
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (status === "paid") {
      clearBasket();
    }
  }, [status]);

  if (!orderId) {
    return <p role="alert">Missing order reference.</p>;
  }

  if (status === null) {
    return <p>Confirming your payment…</p>;
  }

  if (status === "paid") {
    return (
      <main>
        <h1>Payment confirmed</h1>
        <p>Order reference: {orderId}</p>
      </main>
    );
  }

  if (status === "timeout" || status === "error") {
    return (
      <main>
        <h1>Still confirming your payment</h1>
        <p>
          We're still confirming your payment. Check your email for confirmation, or contact support if this
          persists.
        </p>
        <p>Order reference: {orderId}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Payment wasn't successful</h1>
      <p>Order reference: {orderId}</p>
      <Link href="/checkout">Return to checkout</Link>
    </main>
  );
}
