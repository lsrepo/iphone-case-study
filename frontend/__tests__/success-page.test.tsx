import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SuccessPage from "../app/checkout/success/page";
import * as api from "../lib/api";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("order_id=order-1&outcome=success"),
}));

beforeEach(() => {
  vi.restoreAllMocks();
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
});
