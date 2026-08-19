"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchPaymentStatus } from "../../../lib/api";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function poll() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const result = await fetchPaymentStatus(orderId!);
        if (cancelled) return;
        if (result.status !== "pending") {
          setStatus(result.status);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!cancelled) setStatus("pending");
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

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

  return (
    <main>
      <h1>Payment wasn't successful</h1>
      <p>Order reference: {orderId}</p>
      <Link href="/checkout">Return to checkout</Link>
    </main>
  );
}
