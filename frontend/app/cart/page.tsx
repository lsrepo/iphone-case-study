// frontend/app/cart/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BasketSummary } from "../../components/BasketSummary";
import { MarketToggle } from "../../components/MarketToggle";
import { ProductCard } from "../../components/ProductCard";
import { fetchProducts } from "../../lib/api";
import { addItem, getBasket, removeItem, setQuantity } from "../../lib/basket";
import { getMarket, setMarket } from "../../lib/market";
import type { BasketLine, Market, Product } from "../../lib/types";

export default function CartPage() {
  const [market, setMarketState] = useState<Market>("HK");
  const [products, setProducts] = useState<Product[]>([]);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMarketState(getMarket());
    setBasket(getBasket());
  }, []);

  useEffect(() => {
    fetchProducts(market)
      .then(setProducts)
      .catch(() => setError("Couldn't load products — please try again"));
  }, [market]);

  function handleMarketChange(next: Market) {
    setMarket(next);
    setMarketState(next);
  }

  function handleAdd(productId: string) {
    setBasket(addItem(productId));
  }

  function handleSetQuantity(productId: string, quantity: number) {
    setBasket(setQuantity(productId, quantity));
  }

  function handleRemove(productId: string) {
    setBasket(removeItem(productId));
  }

  const isEmpty = basket.length === 0;

  return (
    <main>
      <h1>iPhone Cases</h1>
      <MarketToggle market={market} onChange={handleMarketChange} />
      {error && <p role="alert">{error}</p>}
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={handleAdd} />
      ))}
      <BasketSummary basket={basket} products={products} onSetQuantity={handleSetQuantity} onRemove={handleRemove} />
      <Link href="/checkout" aria-disabled={isEmpty ? "true" : "false"} onClick={(event) => isEmpty && event.preventDefault()}>
        Proceed to checkout
      </Link>
    </main>
  );
}
