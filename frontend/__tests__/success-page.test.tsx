// frontend/__tests__/success-page.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SuccessPage from "../app/checkout/success/page";
import { addItem, getBasket } from "../lib/basket";

const mockSearchParams = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearchParams.value),
}));

beforeEach(() => {
  localStorage.clear();
  mockSearchParams.value = "";
});

describe("SuccessPage", () => {
  it("shows a confirmation immediately when the outcome is success — no polling", async () => {
    mockSearchParams.value = "order_id=order-1&outcome=success&payment_id=pay_1";

    render(<SuccessPage />);

    expect(await screen.findByText(/payment confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/order-1/)).toBeInTheDocument();
  });

  it("clears the basket once the outcome is success", async () => {
    addItem("clear-case");
    expect(getBasket()).toHaveLength(1);
    mockSearchParams.value = "order_id=order-1&outcome=success&payment_id=pay_1";

    render(<SuccessPage />);

    await screen.findByText(/payment confirmed/i);
    expect(getBasket()).toEqual([]);
  });

  it("shows a decline-specific message and a link back to checkout", async () => {
    mockSearchParams.value = "order_id=order-1&outcome=failure&payment_id=pay_1&reason=not_enough_funds";

    render(<SuccessPage />);

    expect(await screen.findByText(/payment wasn't successful/i)).toBeInTheDocument();
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to checkout/i })).toHaveAttribute("href", "/checkout");
  });

  it("shows a generic failure message when there's no decline reason", async () => {
    mockSearchParams.value = "order_id=order-1&outcome=failure&payment_id=pay_1";

    render(<SuccessPage />);

    expect(await screen.findByText(/payment wasn't successful/i)).toBeInTheDocument();
    expect(screen.getByText(/try again with a different card/i)).toBeInTheDocument();
  });

  it("shows an alert when the order reference is missing", async () => {
    mockSearchParams.value = "outcome=success";

    render(<SuccessPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/missing order reference/i);
  });
});
