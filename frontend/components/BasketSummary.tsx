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
    <div className="basket-summary">
      <ul className="basket-list">
        {lines.map(({ line, product }) => (
          <li key={product.id} className="basket-line">
            <img src={product.image} alt="" className="basket-line-image" />
            <div className="basket-line-details">
              <span className="basket-line-name">{product.name}</span>
              <span className="basket-line-price">{formatPrice(product.price, product.currency)}</span>
            </div>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(event) => onSetQuantity(product.id, Number(event.target.value))}
              aria-label={`Quantity for ${product.name}`}
              className="basket-line-quantity"
            />
            <button type="button" className="basket-line-remove" onClick={() => onRemove(product.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p className="basket-total">
        <span>Total</span>
        <span>{formatPrice(total, currency)}</span>
      </p>
    </div>
  );
}
