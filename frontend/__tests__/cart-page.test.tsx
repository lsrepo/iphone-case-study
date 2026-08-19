// frontend/__tests__/cart-page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartPage from "../app/cart/page";
import * as api from "../lib/api";
import { clearBasket } from "../lib/basket";

const PRODUCTS = [
  { id: "clear-case", name: "Clear Case", description: "", image: "", price: 19900, currency: "EUR" as const },
];

beforeEach(() => {
  localStorage.clear();
  clearBasket();
  vi.spyOn(api, "fetchProducts").mockResolvedValue(PRODUCTS);
});

describe("CartPage", () => {
  it("lists products and disables checkout when the basket is empty", async () => {
    render(<CartPage />);

    await waitFor(() => expect(screen.getByText("Clear Case")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /proceed to checkout/i })).toHaveAttribute("aria-disabled", "true");
  });

  it("adding a product enables checkout and shows a running total", async () => {
    const user = userEvent.setup();
    render(<CartPage />);

    await waitFor(() => expect(screen.getByText("Clear Case")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(await screen.findByText(/Total:.*199\.00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /proceed to checkout/i })).toHaveAttribute("aria-disabled", "false");
  });
});
