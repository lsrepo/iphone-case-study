import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentSession, fetchProducts } from "../lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("fetchProducts calls the products endpoint with the market", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "clear-case", name: "Clear Case", description: "", image: "", price: 19900, currency: "EUR" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const products = await fetchProducts("NL");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/products?market=NL"));
    expect(products[0].currency).toBe("EUR");
  });

  it("createPaymentSession posts market and items, and maps snake_case to camelCase", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ order_id: "order-1", payment_session: { id: "ps_1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaymentSession("HK", [{ productId: "clear-case", quantity: 1 }]);

    expect(result).toEqual({ orderId: "order-1", paymentSession: { id: "ps_1" } });
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(requestInit.body)).toEqual({
      market: "HK",
      items: [{ product_id: "clear-case", quantity: 1 }],
    });
  });
});
