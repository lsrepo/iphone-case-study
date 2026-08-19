import type { BasketLine } from "./types";

const STORAGE_KEY = "iphone-case-study:basket";

function readBasket(): BasketLine[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as BasketLine[]) : [];
}

function writeBasket(basket: BasketLine[]): BasketLine[] {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
  }
  return basket;
}

export function getBasket(): BasketLine[] {
  return readBasket();
}

export function addItem(productId: string): BasketLine[] {
  const basket = readBasket();
  const existing = basket.find((line) => line.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    basket.push({ productId, quantity: 1 });
  }
  return writeBasket(basket);
}

export function setQuantity(productId: string, quantity: number): BasketLine[] {
  const basket = readBasket();
  const existing = basket.find((line) => line.productId === productId);
  if (existing) {
    existing.quantity = quantity;
  }
  return writeBasket(basket);
}

export function removeItem(productId: string): BasketLine[] {
  const basket = readBasket().filter((line) => line.productId !== productId);
  return writeBasket(basket);
}

export function clearBasket(): void {
  writeBasket([]);
}
