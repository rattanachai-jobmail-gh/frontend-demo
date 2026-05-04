import { SaleCheckoutItemRequest } from './sale-checkout-item-request';
import { SalePaymentMethod } from './sale-payment-method';

export interface SaleCheckoutRequest {
  paymentMethod: SalePaymentMethod;
  receivedAmount: number;
  billDiscountType: string;
  billDiscountValue: number;
  billDiscountAmount: number;
  note: string;
  items: SaleCheckoutItemRequest[];
}
