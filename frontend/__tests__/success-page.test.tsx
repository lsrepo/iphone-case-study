import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SuccessPage from "../app/checkout/success/page";
import * as api from "../lib/api";
import { addItem, getBasket } from "../lib/basket";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("order_id=order-1&outcome=success"),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("SuccessPage", () => {
  it("shows a confirmation once the backend confirms payment as paid", async () => {
    vi.spyOn(api, "fetchPaymentStatus").mockResolvedValue({
      orderId: "order-1",
      status: "paid",
      amount: 19900,
      currency: "EUR",
    });

    render(<SuccessPage />);

    expect(await screen.findByText(/payment confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/order-1/)).toBeInTheDocument();
  });

  it("clears the basket once payment is confirmed as paid", async () => {
    addItem("clear-case");
    expect(getBasket()).toHaveLength(1);

    vi.spyOn(api, "fetchPaymentStatus").mockResolvedValue({
      orderId: "order-1",
      status: "paid",
      amount: 19900,
      currency: "EUR",
    });

    render(<SuccessPage />);

    await screen.findByText(/payment confirmed/i);
    expect(getBasket()).toEqual([]);
  });

  it("shows a failure message and a link back to checkout when declined", async () => {
    vi.spyOn(api, "fetchPaymentStatus").mockResolvedValue({
      orderId: "order-1",
      status: "declined",
      amount: 19900,
      currency: "EUR",
    });

    render(<SuccessPage />);

    expect(await screen.findByText(/payment wasn't successful/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to checkout/i })).toHaveAttribute("href", "/checkout");
  });

  it("does not hang forever and shows a distinct message when every poll attempt errors", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(api, "fetchPaymentStatus").mockRejectedValue(new Error("network error"));

    render(<SuccessPage />);

    // 10 attempts, 1s apart — advance past all of them.
    for (let i = 0; i < 11; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(screen.getByRole("heading", { name: /still confirming your payment/i })).toBeInTheDocument();
    expect(screen.queryByText(/payment wasn't successful/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("shows a distinct 'still confirming' message rather than failure when polling is exhausted while still pending", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(api, "fetchPaymentStatus").mockResolvedValue({
      orderId: "order-1",
      status: "pending",
      amount: 19900,
      currency: "EUR",
    });

    render(<SuccessPage />);

    for (let i = 0; i < 11; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(screen.getByRole("heading", { name: /still confirming your payment/i })).toBeInTheDocument();
    expect(screen.queryByText(/payment wasn't successful/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
