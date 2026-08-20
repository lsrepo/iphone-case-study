// frontend/__tests__/checkout-page.test.tsx
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutPage from "../app/checkout/page";
import * as api from "../lib/api";
import { addItem, clearBasket } from "../lib/basket";

vi.mock("../components/CheckoutFlowMount", () => ({
  CheckoutFlowMount: ({
    paymentSession,
    onPaymentCompleted,
    onPaymentDeclined,
  }: {
    paymentSession: unknown;
    onPaymentCompleted: (payment: { id: string; status: string; type: string }) => void;
    onPaymentDeclined: (paymentId: string, reason?: string) => void;
  }) => (
    <div data-testid="flow-mount">
      {JSON.stringify(paymentSession)}
      <button type="button" onClick={() => onPaymentCompleted({ id: "pay_1", status: "Approved", type: "card" })}>
        simulate approved
      </button>
      <button type="button" onClick={() => onPaymentDeclined("pay_2", "not_enough_funds")}>
        simulate declined
      </button>
    </div>
  ),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const PRODUCTS = [
  { id: "clear-case", name: "Clear Case", description: "", image: "", price: 19900, currency: "EUR" as const },
];

async function fillAndSubmitDetails(user: UserEvent) {
  // Fields carry demo defaults already — clear before typing so the test
  // isn't order-dependent on what those defaults happen to be.
  await user.clear(screen.getByLabelText(/full name/i));
  await user.type(screen.getByLabelText(/full name/i), "Jordan Smith");
  await user.clear(screen.getByLabelText(/email address/i));
  await user.type(screen.getByLabelText(/email address/i), "jordan.smith@example.com");
  await user.click(screen.getByRole("button", { name: /continue to payment/i }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearBasket();
  addItem("clear-case");
  pushMock.mockClear();
  vi.spyOn(api, "fetchProducts").mockResolvedValue(PRODUCTS);
  vi.spyOn(api, "createPaymentSession").mockResolvedValue({
    orderId: "order-1",
    paymentSession: { id: "ps_1" },
    requestBody: {
      market: "HK",
      items: [{ product_id: "clear-case", quantity: 1 }],
      customer_name: "Jordan Smith",
      customer_email: "jordan.smith@example.com",
    },
  });
  vi.spyOn(api, "fetchPaymentStatus").mockResolvedValue({
    orderId: "order-1",
    status: "pending",
    amount: 19900,
    currency: "EUR",
  });
});

describe("CheckoutPage", () => {
  it("shows the basket total before any details are entered", async () => {
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText(/199\.00/)).toBeInTheDocument());
    expect(api.createPaymentSession).not.toHaveBeenCalled();
  });

  it("creates the payment session with the entered name and email, then mounts Flow", async () => {
    const user = userEvent.setup();
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText(/199\.00/)).toBeInTheDocument());
    await fillAndSubmitDetails(user);

    expect(api.createPaymentSession).toHaveBeenCalledWith(
      "HK",
      [{ productId: "clear-case", quantity: 1 }],
      "Jordan Smith",
      "jordan.smith@example.com"
    );
    expect(await screen.findByTestId("flow-mount")).toHaveTextContent('{"id":"ps_1"}');
    expect(JSON.parse(window.sessionStorage.getItem("paymentRequest") ?? "null")).toEqual({
      market: "HK",
      items: [{ product_id: "clear-case", quantity: 1 }],
      customer_name: "Jordan Smith",
      customer_email: "jordan.smith@example.com",
    });
  });

  it("shows an error message when session creation fails", async () => {
    vi.spyOn(api, "createPaymentSession").mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText(/199\.00/)).toBeInTheDocument());
    await fillAndSubmitDetails(user);

    expect(await screen.findByText(/couldn't start checkout/i)).toBeInTheDocument();
  });

  it("redirects to /cart and never creates a payment session when the basket is empty", async () => {
    clearBasket();

    render(<CheckoutPage />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/cart"));
    expect(api.createPaymentSession).not.toHaveBeenCalled();
  });

  it("redirects straight to the success outcome once Flow reports the payment approved — no polling", async () => {
    const user = userEvent.setup();
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText(/199\.00/)).toBeInTheDocument());
    await fillAndSubmitDetails(user);
    await user.click(await screen.findByRole("button", { name: /simulate approved/i }));

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/checkout\/success\?order_id=order-1&outcome=success&payment_id=pay_1&status=Approved&type=card$/)
    );
  });

  it("redirects to the failure outcome with the decline reason once Flow reports the payment declined", async () => {
    const user = userEvent.setup();
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText(/199\.00/)).toBeInTheDocument());
    await fillAndSubmitDetails(user);
    await user.click(await screen.findByRole("button", { name: /simulate declined/i }));

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/checkout\/success\?order_id=order-1&outcome=failure&payment_id=pay_2&reason=not_enough_funds$/)
    );
  });

  it("falls back to polling the backend once a webhook resolves the order — for payment methods with no Flow callback", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const statusMock = vi
      .spyOn(api, "fetchPaymentStatus")
      .mockResolvedValueOnce({ orderId: "order-1", status: "pending", amount: 19900, currency: "EUR" })
      .mockResolvedValueOnce({ orderId: "order-1", status: "pending", amount: 19900, currency: "EUR" })
      .mockResolvedValueOnce({ orderId: "order-1", status: "paid", amount: 19900, currency: "EUR" });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText(/199\.00/)).toBeInTheDocument());
    await fillAndSubmitDetails(user);

    await vi.waitFor(() => expect(statusMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(pushMock).toHaveBeenCalledWith("/checkout/success?order_id=order-1&outcome=success");

    vi.useRealTimers();
  });
});
