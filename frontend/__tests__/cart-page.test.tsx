// frontend/__tests__/cart-page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartPage from "../app/cart/page";
import * as api from "../lib/api";
import { addItem, clearBasket } from "../lib/basket";

const PRODUCTS = [
  { id: "clear-case", name: "Clear Case", description: "", image: "", price: 19900, currency: "EUR" as const },
];

beforeEach(() => {
  localStorage.clear();
  clearBasket();
  vi.spyOn(api, "fetchProducts").mockResolvedValue(PRODUCTS);
});

describe("CartPage", () => {
  it("shows an empty state and no checkout link when the basket is empty", async () => {
    render(<CartPage />);

    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /proceed to checkout/i })).not.toBeInTheDocument();
  });

  it("lists basket items with a running total and a checkout link", async () => {
    addItem("clear-case");

    render(<CartPage />);

    await waitFor(() => expect(screen.getByText("Clear Case")).toBeInTheDocument());
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getAllByText("EUR 199.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /proceed to checkout/i })).toBeInTheDocument();
  });

  it("removing the only item returns to the empty state", async () => {
    addItem("clear-case");
    const user = userEvent.setup();

    render(<CartPage />);

    await waitFor(() => expect(screen.getByText("Clear Case")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /remove/i }));

    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it("shows an error message when fetching products fails", async () => {
    addItem("clear-case");
    vi.spyOn(api, "fetchProducts").mockRejectedValue(new Error("network error"));

    render(<CartPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load your cart/i);
  });
});
