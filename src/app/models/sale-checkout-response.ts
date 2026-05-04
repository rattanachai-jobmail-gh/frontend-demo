import { SaleItemResponse } from './sale-item-response';

export interface SaleCheckoutResponse {
  saleId: number;
  cashierUsername: string;
  cashierFirstName: string;
  cashierLastName: string;
  paymentMethod: string;
  subtotal: number;
  grandTotal: number;
  receivedAmount: number;
  changeAmount: number;
  billDiscountType: string;
  billDiscountValue: number;
  billDiscountAmount: number;
  note: string;
  saleDate: string;
  items: SaleItemResponse[];
}
