export interface SaleItemResponse {
  saleId: number;
  saleItemSpu: string;
  saleItemSku: string;
  itemName: string;
  saleItemBarCode: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  discountAmount: number;
  discountValue: number;
  netUnitPrice: number;
  discountType: string;
}
