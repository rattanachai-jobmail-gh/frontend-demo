import { UserLogin } from "./user-login";

export interface Product {
  productSpu: string;
  productSku: string;
  productName: string;
  unitOfMeasure: string;
  productAmount: number;
  productSellingPricePerUnit: number;
  productCostPricePerUnit: number;
  receivedDateExisted: boolean;
  expiredDateExisted: boolean;

  receivedDate: Date | null;
  expiredDate: Date | null;

  productBarCode: string;

  byUser?: UserLogin;
}