// frontend/components/ProductCard.tsx
import type { Product } from "../lib/types";

function formatPrice(price: number, currency: string): string {
  return `${currency} ${(price / 100).toFixed(2)}`;
}

export function ProductCard({ product, onAdd }: { product: Product; onAdd: (productId: string) => void }) {
  return (
    <div>
      <img src={product.image} alt={product.name} width={120} />
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <p>{formatPrice(product.price, product.currency)}</p>
      <button type="button" onClick={() => onAdd(product.id)}>
        Add to cart
      </button>
    </div>
  );
}

export { formatPrice };
