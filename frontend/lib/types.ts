// frontend/lib/types.ts
export type Market = "HK" | "NL";

export interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  currency: "HKD" | "EUR";
}

export interface BasketLine {
  productId: string;
  quantity: number;
}
