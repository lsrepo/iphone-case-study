// frontend/app/cart/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BasketSummary } from "../../components/BasketSummary";
import { fetchProducts } from "../../lib/api";
import { BASKET_CHANGED_EVENT, getBasket, removeItem, setQuantity } from "../../lib/basket";
import { getMarket, MARKET_CHANGED_EVENT } from "../../lib/market";
import type { BasketLine, Market, Product } from "../../lib/types";

export default function CartPage() {
  const [, setMarketState] = useState<Market>("HK");
  const [products, setProducts] = useState<Product[]>([]);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentMarket = getMarket();
    setMarketState(currentMarket);
    setBasket(getBasket());
    fetchProducts(currentMarket)
      .then(setProducts)
      .catch(() => setError("Couldn't load your cart — please try again"));

    function handleMarketChanged(event: Event) {
      const nextMarket = (event as CustomEvent<Market>).detail;
      setMarketState(nextMarket);
      fetchProducts(nextMarket)
        .then(setProducts)
        .catch(() => setError("Couldn't load your cart — please try again"));
    }
    function handleBasketChanged() {
      setBasket(getBasket());
    }
    window.addEventListener(MARKET_CHANGED_EVENT, handleMarketChanged);
    window.addEventListener(BASKET_CHANGED_EVENT, handleBasketChanged);
    return () => {
      window.removeEventListener(MARKET_CHANGED_EVENT, handleMarketChanged);
      window.removeEventListener(BASKET_CHANGED_EVENT, handleBasketChanged);
    };
  }, []);

  function handleSetQuantity(productId: string, quantity: number) {
    setBasket(setQuantity(productId, quantity));
  }

  function handleRemove(productId: string) {
    setBasket(removeItem(productId));
  }

  const isEmpty = basket.length === 0;

  return (
    <main className="page">
      <h1>Your Cart</h1>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {isEmpty ? (
        <div className="empty-state">
          <p>Your cart is empty.</p>
          <Link href="/" className="button-link">
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          <BasketSummary basket={basket} products={products} onSetQuantity={handleSetQuantity} onRemove={handleRemove} />
          <Link href="/checkout" className="button-link">
            Proceed to checkout
          </Link>
        </>
      )}
    </main>
  );
}
