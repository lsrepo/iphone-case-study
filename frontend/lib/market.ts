import type { Market } from "./types";

const STORAGE_KEY = "iphone-case-study:market";

export function getMarket(): Market {
  if (typeof window === "undefined") return "HK";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "NL" ? "NL" : "HK";
}

export function setMarket(market: Market): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, market);
}
