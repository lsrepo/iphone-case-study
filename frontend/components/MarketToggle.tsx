// frontend/components/MarketToggle.tsx
"use client";

import type { Market } from "../lib/types";

export function MarketToggle({ market, onChange }: { market: Market; onChange: (market: Market) => void }) {
  return (
    <div>
      <button type="button" disabled={market === "HK"} onClick={() => onChange("HK")}>
        Hong Kong (HKD)
      </button>
      <button type="button" disabled={market === "NL"} onClick={() => onChange("NL")}>
        Netherlands (EUR)
      </button>
    </div>
  );
}
