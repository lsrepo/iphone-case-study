// frontend/__tests__/checkout-page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    onPaymentCompleted: (paymentId: string) => void;
    onPaymentDeclined: (paymentId: string, reason?: string) => void;
  }) => (
    <div data-testid="flow-mount">
      {JSON.stringify(paymentSession)}
      <button type="button" onClick={() => onPaymentCompleted("pay_1")}>
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

beforeEach(() => {
  localStorage.clear();
  clearBasket();
  addItem("clear-case");
  pushMock.mockClear();
  vi.spyOn(api, "fetchProducts").mockResolvedValue(PRODUCTS);
  vi.spyOn(api, "createPaymentSession").mockResolvedValue({
    orderId: "order-1",
    paymentSession: { id: "ps_1" },
  });
});

describe("CheckoutPage", () => {
  it("shows the basket total and mounts Flow once the session is created", async () => {
    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText(/199\.00/)).toBeInTheDocument());
    expect(api.createPaymentSession).toHaveBeenCalledWith("HK", [{ productId: "clear-case", quantity: 1 }]);
    expect(await screen.findByTestId("flow-mount")).toHaveTextContent('{"id":"ps_1"}');
  });

  it("shows an error message when session creation fails", async () => {
    vi.spyOn(api, "createPaymentSession").mockRejectedValue(new Error("network error"));

    render(<CheckoutPage />);

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

    await user.click(await screen.findByRole("button", { name: /simulate approved/i }));

    expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/^\/checkout\/success\?order_id=order-1&outcome=success&payment_id=pay_1$/));
  });

  it("redirects to the failure outcome with the decline reason once Flow reports the payment declined", async () => {
    const user = userEvent.setup();
    render(<CheckoutPage />);

    await user.click(await screen.findByRole("button", { name: /simulate declined/i }));

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/checkout\/success\?order_id=order-1&outcome=failure&payment_id=pay_2&reason=not_enough_funds$/)
    );
  });
});
