// frontend/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import { fetchProducts } from "../lib/api";
import { addItem } from "../lib/basket";
import { getMarket, MARKET_CHANGED_EVENT } from "../lib/market";
import type { Market, Product } from "../lib/types";

export default function Home() {
  const [, setMarketState] = useState<Market>("HK");
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentMarket = getMarket();
    setMarketState(currentMarket);
    fetchProducts(currentMarket)
      .then(setProducts)
      .catch(() => setError("Couldn't load products — please try again"));

    function handleMarketChanged(event: Event) {
      const nextMarket = (event as CustomEvent<Market>).detail;
      setMarketState(nextMarket);
      fetchProducts(nextMarket)
        .then(setProducts)
        .catch(() => setError("Couldn't load products — please try again"));
    }
    window.addEventListener(MARKET_CHANGED_EVENT, handleMarketChanged);
    return () => window.removeEventListener(MARKET_CHANGED_EVENT, handleMarketChanged);
  }, []);

  function handleAdd(productId: string) {
    addItem(productId);
  }

  return (
    <main className="page">
      <section className="hero">
        <h1>iPhone Cases</h1>
        <p className="hero-subtitle">Considered protection, made simple.</p>
      </section>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={handleAdd} />
        ))}
      </div>
    </main>
  );
}
