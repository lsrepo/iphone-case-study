// frontend/lib/locales.ts
//
// A subset of the locales Flow supports — see
// https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/add-localization-to-your-flow-integration

export interface FlowLocale {
  code: string;
  label: string;
}

export const FLOW_LOCALES: FlowLocale[] = [
  { code: "en", label: "English" },
  { code: "zh-hk", label: "繁體中文 (香港)" },
  { code: "nl", label: "Nederlands" },
  { code: "fr", label: "Français" },
  { code: "ja", label: "日本語" },
];
