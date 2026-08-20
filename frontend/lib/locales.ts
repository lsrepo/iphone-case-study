// frontend/lib/locales.ts
//
// Flow's payment-form language, derived from the selected market — see
// https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/add-localization-to-your-flow-integration
//
// Checkout.com's own docs list the Hong Kong Chinese locale as "zh-hk"
// (lowercase), but the SDK only applies translations when the region
// subtag is capitalized ("zh-HK") — verified by mounting Flow directly
// with each casing and comparing the rendered label.

import type { Market } from "./types";

export const MARKET_LOCALES: Record<Market, string> = {
  HK: "zh-HK",
  NL: "nl",
};
