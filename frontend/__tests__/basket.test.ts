import { beforeEach, describe, expect, it } from "vitest";
import { addItem, clearBasket, getBasket, removeItem, setQuantity } from "../lib/basket";

describe("basket", () => {
  beforeEach(() => {
    localStorage.clear();
    clearBasket();
  });

  it("starts empty", () => {
    expect(getBasket()).toEqual([]);
  });

  it("adds an item, incrementing quantity on repeat adds", () => {
    addItem("clear-case");
    const basket = addItem("clear-case");
    expect(basket).toEqual([{ productId: "clear-case", quantity: 2 }]);
  });

  it("sets an exact quantity", () => {
    addItem("clear-case");
    const basket = setQuantity("clear-case", 5);
    expect(basket).toEqual([{ productId: "clear-case", quantity: 5 }]);
  });

  it("removes an item", () => {
    addItem("clear-case");
    const basket = removeItem("clear-case");
    expect(basket).toEqual([]);
  });

  it("persists across separate getBasket calls", () => {
    addItem("silicone-case-sage");
    expect(getBasket()).toEqual([{ productId: "silicone-case-sage", quantity: 1 }]);
  });
});
