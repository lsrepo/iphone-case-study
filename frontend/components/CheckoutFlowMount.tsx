// frontend/components/CheckoutFlowMount.tsx
"use client";

import { useEffect, useRef } from "react";
import type { PaymentSessionResponse } from "@checkout.com/checkout-web-components";

interface Props {
  paymentSession: unknown;
  onPaymentCompleted: (paymentId: string) => void;
  onError: (message: string) => void;
}

export function CheckoutFlowMount({ paymentSession, onPaymentCompleted, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountFlow() {
      const { loadCheckoutWebComponents } = await import("@checkout.com/checkout-web-components");
      const checkout = await loadCheckoutWebComponents({
        publicKey: process.env.NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY!,
        environment: "sandbox",
        paymentSession: paymentSession as PaymentSessionResponse | undefined,
        onPaymentCompleted: (_component: unknown, paymentResponse: { id: string }) => {
          onPaymentCompleted(paymentResponse.id);
        },
        onError: (_component: unknown, error: { message?: string }) => {
          onError(error.message ?? "Payment failed");
        },
      });

      if (cancelled || !containerRef.current) return;
      const flowComponent = checkout.create("flow");
      flowComponent.mount(containerRef.current);
    }

    mountFlow().catch((error) => onError(error instanceof Error ? error.message : "Failed to load payment form"));

    return () => {
      cancelled = true;
    };
  }, [paymentSession, onPaymentCompleted, onError]);

  return <div ref={containerRef} id="flow-container" />;
}
