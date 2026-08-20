// frontend/components/CheckoutFlowMount.tsx
"use client";

import { useEffect, useRef } from "react";
import type { Component, PayPaymentSessionSuccessfulResponse, PaymentSessionResponse } from "@checkout.com/checkout-web-components";
import { CheckoutRequestErrorCode } from "@checkout.com/checkout-web-components";

interface Props {
  paymentSession: unknown;
  customerName: string;
  customerEmail: string;
  locale: string;
  onPaymentCompleted: (payment: PayPaymentSessionSuccessfulResponse) => void;
  onPaymentDeclined: (paymentId: string, reason?: string) => void;
  onError: (message: string) => void;
}

export function CheckoutFlowMount({
  paymentSession,
  customerName,
  customerEmail,
  locale,
  onPaymentCompleted,
  onPaymentDeclined,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flowComponentRef = useRef<Component | null>(null);
  // Keep the latest callbacks in refs so the mount effect below only needs to
  // depend on `paymentSession` — callback identity churn (e.g. a parent
  // re-render after setError) must not cause Flow to be re-mounted into the
  // same container.
  const onPaymentCompletedRef = useRef(onPaymentCompleted);
  const onPaymentDeclinedRef = useRef(onPaymentDeclined);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPaymentCompletedRef.current = onPaymentCompleted;
    onPaymentDeclinedRef.current = onPaymentDeclined;
    onErrorRef.current = onError;
  }, [onPaymentCompleted, onPaymentDeclined, onError]);

  useEffect(() => {
    let cancelled = false;

    async function mountFlow() {
      const { loadCheckoutWebComponents } = await import("@checkout.com/checkout-web-components");
      const checkout = await loadCheckoutWebComponents({
        publicKey: process.env.NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY!,
        environment: "sandbox",
        paymentSession: paymentSession as PaymentSessionResponse | undefined,
        locale,
        onPaymentCompleted: (_component: unknown, paymentResponse: PayPaymentSessionSuccessfulResponse) => {
          // paymentResponse.status is always "Approved" — Flow only calls this
          // callback for a successful payment. Declines arrive via onError.
          onPaymentCompletedRef.current(paymentResponse);
        },
        onError: (_component: unknown, error) => {
          if (error.type === "Request" && error.code === CheckoutRequestErrorCode.PaymentRequestDeclined) {
            onPaymentDeclinedRef.current(error.details.paymentId ?? "", error.details.requestErrorCodes?.[0]);
            return;
          }
          onErrorRef.current(error.message ?? "Payment failed");
        },
      });

      if (cancelled || !containerRef.current) return;
      const flowComponent = checkout.create("flow", { data: { cardholderName: customerName, email: customerEmail } });
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
