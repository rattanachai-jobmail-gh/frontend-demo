import { Product } from "./product";

export interface SearchProductsResponse {
  searchProductSpu: string;
  searchProductSku: string;
  searchProductName: string;
  searchUnitOfMeasure: string;
  searchProductAmount: number;
  searchProductSellingPricePerUnit: number;
  searchProductCostPricePerUnit: number | null; // ใช้ | null เพราะใน Java เป็น Double (Object) ซึ่งอาจเป็น null ได้

  searchReceivedDateExisted: boolean;
  searchExpiredDateExisted: boolean;

  // ใน JSON จาก Spring Boot มักจะส่ง Date มาเป็น ISO String (เช่น "2024-03-27T...")
  searchReceivedDate: string | Date | null; 
  searchExpiredDate: string | Date | null;

  searchProductBarCode: string;
}