// frontend/__tests__/home-page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../app/page";
import * as api from "../lib/api";
import { clearBasket, getBasket } from "../lib/basket";

const PRODUCTS = [
  { id: "clear-case", name: "Clear Case", description: "", image: "", price: 19900, currency: "EUR" as const },
];

beforeEach(() => {
  localStorage.clear();
  clearBasket();
  vi.spyOn(api, "fetchProducts").mockResolvedValue(PRODUCTS);
});

describe("Home", () => {
  it("lists products for the current market", async () => {
    render(<Home />);

    await waitFor(() => expect(screen.getByText("Clear Case")).toBeInTheDocument());
    expect(screen.getByText(/EUR 199\.00/)).toBeInTheDocument();
  });

  it("adding a product stores it in the basket", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => expect(screen.getByText("Clear Case")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(getBasket()).toEqual([{ productId: "clear-case", quantity: 1 }]);
    expect(await screen.findByRole("button", { name: /added/i })).toBeInTheDocument();
  });

  it("shows an error message when fetching products fails", async () => {
    vi.spyOn(api, "fetchProducts").mockRejectedValue(new Error("network error"));

    render(<Home />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load products/i);
  });
});
