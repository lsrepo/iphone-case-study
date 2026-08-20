// frontend/components/CheckoutFlowMount.tsx
"use client";

import { useEffect, useRef } from "react";
import type { Component, PaymentSessionResponse } from "@checkout.com/checkout-web-components";

interface Props {
  paymentSession: unknown;
  onPaymentCompleted: (paymentId: string) => void;
  onError: (message: string) => void;
}

export function CheckoutFlowMount({ paymentSession, onPaymentCompleted, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flowComponentRef = useRef<Component | null>(null);
  // Keep the latest callbacks in refs so the mount effect below only needs to
  // depend on `paymentSession` — onPaymentCompleted/onError identity churn (e.g.
  // a parent re-render after setError) must not cause Flow to be re-mounted into
  // the same container.
  const onPaymentCompletedRef = useRef(onPaymentCompleted);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPaymentCompletedRef.current = onPaymentCompleted;
    onErrorRef.current = onError;
  }, [onPaymentCompleted, onError]);

  useEffect(() => {
    let cancelled = false;

    async function mountFlow() {
      const { loadCheckoutWebComponents } = await import("@checkout.com/checkout-web-components");
      const checkout = await loadCheckoutWebComponents({
        publicKey: process.env.NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY!,
        environment: "sandbox",
        paymentSession: paymentSession as PaymentSessionResponse | undefined,
        onPaymentCompleted: (_component: unknown, paymentResponse: { id: string }) => {
          onPaymentCompletedRef.current(paymentResponse.id);
        },
        onError: (_component: unknown, error: { message?: string }) => {
          onErrorRef.current(error.message ?? "Payment failed");
        },
      });

      if (cancelled || !containerRef.current) return;
      const flowComponent = checkout.create("flow");
      flowComponent.mount(containerRef.current);
      flowComponentRef.current = flowComponent;
    }

    mountFlow().catch((error) => onErrorRef.current(error instanceof Error ? error.message : "Failed to load payment form"));

    return () => {
      cancelled = true;
      flowComponentRef.current?.unmount();
      flowComponentRef.current = null;
    };
  }, [paymentSession]);

  return <div ref={containerRef} id="flow-container" />;
}
