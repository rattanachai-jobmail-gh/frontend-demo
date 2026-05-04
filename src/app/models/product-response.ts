export interface ProductResponse {
  productSpu: string;
  productSku: string;
  productName: string;
  unitOfMeasure: string;
  productAmount: number;
  productSellingPricePerUnit: number;
  productCostPricePerUnit: number;
  productBarCode: string;
  username: string | null;
}
