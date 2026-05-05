import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SaleCheckoutRequest } from '../models/sale-checkout-request';
import { SaleCheckoutResponse } from '../models/sale-checkout-response';
import { buildApiUrl } from './api-base';

@Injectable({
  providedIn: 'root',
})
export class SaleService {
  private http = inject(HttpClient);
  private saleUrl = buildApiUrl('/saleApi');

  checkoutSale(payload: SaleCheckoutRequest): Observable<SaleCheckoutResponse> {
    return this.http.post<SaleCheckoutResponse>(`${this.saleUrl}/checkout`, payload, {
      withCredentials: true,
    });
  }

  getAllSales(): Observable<SaleCheckoutResponse[]> {
    return this.http.get<SaleCheckoutResponse[]>(this.saleUrl, {
      withCredentials: true,
    });
  }

  getSaleById(saleId: number): Observable<SaleCheckoutResponse> {
    return this.http.get<SaleCheckoutResponse>(`${this.saleUrl}/${saleId}`, {
      withCredentials: true,
    });
  }
}
