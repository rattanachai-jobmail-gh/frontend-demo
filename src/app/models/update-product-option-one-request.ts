export interface UpdateProductOptionOneRequest {
  originalProductSpu: string;
  originalProductSku: string;
  productSpu: string;
  productSku: string;
  productName: string;
  unitOfMeasure: string;
  productSellingPricePerUnit: number;
  receivedDateExisted: boolean;
  expiredDateExisted: boolean;
  receivedDate: string | null;
  expiredDate: string | null;
  productBarCode: string;
}
