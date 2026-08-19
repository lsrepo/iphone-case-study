// frontend/components/BasketSummary.tsx
import type { BasketLine, Product } from "../lib/types";
import { formatPrice } from "./ProductCard";

interface Props {
  basket: BasketLine[];
  products: Product[];
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function BasketSummary({ basket, products, onSetQuantity, onRemove }: Props) {
  const lines = basket
    .map((line) => ({ line, product: products.find((product) => product.id === line.productId) }))
    .filter((entry): entry is { line: BasketLine; product: Product } => Boolean(entry.product));

  const total = lines.reduce((sum, { line, product }) => sum + line.quantity * product.price, 0);
  const currency = products[0]?.currency ?? "";

  return (
    <div>
      {lines.map(({ line, product }) => (
        <div key={product.id}>
          <span>{product.name}</span>
          <input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(event) => onSetQuantity(product.id, Number(event.target.value))}
            aria-label={`Quantity for ${product.name}`}
          />
          <button type="button" onClick={() => onRemove(product.id)}>
            Remove
          </button>
        </div>
      ))}
      <p>Total: {formatPrice(total, currency)}</p>
    </div>
  );
}
