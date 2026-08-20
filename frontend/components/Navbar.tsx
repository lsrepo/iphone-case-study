// frontend/components/Navbar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BASKET_CHANGED_EVENT, getBasket } from "../lib/basket";
import { getMarket, setMarket, MARKET_CHANGED_EVENT } from "../lib/market";
import type { Market } from "../lib/types";

export function Navbar() {
  const [market, setMarketState] = useState<Market>("HK");
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setMarketState(getMarket());
    setItemCount(countItems());

    function handleMarketChanged(event: Event) {
      setMarketState((event as CustomEvent<Market>).detail);
    }
    function handleBasketChanged() {
      setItemCount(countItems());
    }

    window.addEventListener(MARKET_CHANGED_EVENT, handleMarketChanged);
    window.addEventListener(BASKET_CHANGED_EVENT, handleBasketChanged);
    return () => {
      window.removeEventListener(MARKET_CHANGED_EVENT, handleMarketChanged);
      window.removeEventListener(BASKET_CHANGED_EVENT, handleBasketChanged);
    };
  }, []);

  function countItems(): number {
    return getBasket().reduce((sum, line) => sum + line.quantity, 0);
  }

  function handleSelectMarket(next: Market) {
    setMarket(next);
    setMarketState(next);
  }

  return (
    <header className="navbar">
      <Link href="/" className="navbar-brand">
        Kase
      </Link>
      <div className="navbar-right">
        <div className="flag-toggle" role="group" aria-label="Select market">
          <button
            type="button"
            className={`flag-button${market === "HK" ? " flag-button--active" : ""}`}
            aria-pressed={market === "HK"}
            aria-label="Hong Kong (HKD)"
            title="Hong Kong (HKD)"
            onClick={() => handleSelectMarket("HK")}
          >
            🇭🇰
          </button>
          <button
            type="button"
            className={`flag-button${market === "NL" ? " flag-button--active" : ""}`}
            aria-pressed={market === "NL"}
            aria-label="Netherlands (EUR)"
            title="Netherlands (EUR)"
            onClick={() => handleSelectMarket("NL")}
          >
            🇳🇱
          </button>
        </div>
        <Link href="/cart" className="cart-link" aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6 8h12l-1 12.5a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9L6 8Z" strokeLinejoin="round" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
        </Link>
      </div>
    </header>
  );
}
