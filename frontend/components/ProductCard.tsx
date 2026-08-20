// frontend/components/ProductCard.tsx
"use client";

import { useState } from "react";
import type { Product } from "../lib/types";

function formatPrice(price: number, currency: string): string {
  return `${currency} ${(price / 100).toFixed(2)}`;
}

export function ProductCard({ product, onAdd }: { product: Product; onAdd: (productId: string) => void }) {
  const [added, setAdded] = useState(false);

  function handleAdd() {
    onAdd(product.id);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article className="product-card">
      <div className="product-card-image">
        <img src={product.image} alt={product.name} />
      </div>
      <div className="product-card-body">
        <h3 className="product-card-name">{product.name}</h3>
        <p className="product-card-description">{product.description}</p>
        <div className="product-card-footer">
          <span className="product-card-price">{formatPrice(product.price, product.currency)}</span>
          <button type="button" className="add-to-cart-button" onClick={handleAdd}>
            {added ? "Added" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  );
}

export { formatPrice };
