export interface SaleCheckoutItemRequest {
  productSpu: string;
  productSku: string;
  quantity: number;
  discountType: string;
  discountValue: number;
}
