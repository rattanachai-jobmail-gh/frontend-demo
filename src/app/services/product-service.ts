import { inject, Injectable } from '@angular/core';
import { Product } from '../models/product';
import { ProductPageResponse } from '../models/product-page-response';
import { ProductResponse } from '../models/product-response';
import { SearchProductsResponse } from '../models/search-products-response';
import { UpdateProductOptionOneRequest } from '../models/update-product-option-one-request';
import { UpdateProductOptionThreeRequest } from '../models/update-product-option-three-request';
import { UpdateProductOptionTwoRequest } from '../models/update-product-option-two-request';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { buildApiUrl } from './api-base';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  
  private http = inject(HttpClient);
  private productUrl = buildApiUrl('/productApi');


  addNewProduct(productData: Product): Observable<{ message: string, productSku: string }> {
    return this.http.post<{ message: string, productSku: string }>(`${this.productUrl}/addNew`, productData, { withCredentials: true });
  }

  getAllProducts(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>(`${this.productUrl}/getAll`, { withCredentials: true });
  }

  searchProducts (
    keyword: string='',
    page: number = 0, 
    size: number = 5,
    sort: string = 'productName,asc'
  ): Observable<ProductPageResponse> {
    

    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sort', sort)

    if (keyword.trim()){
      params = params.set('keyword',keyword.trim());
    }

    return this.http.get<ProductPageResponse>(`${this.productUrl}/search`,{
      params,
      withCredentials: true
    })
  }

  updateProductOptionOne(payload: UpdateProductOptionOneRequest): Observable<SearchProductsResponse> {
    return this.http.put<SearchProductsResponse>(`${this.productUrl}/update/option1`, payload, {
      withCredentials: true,
    });
  }

  updateProductOptionTwo(payload: UpdateProductOptionTwoRequest): Observable<SearchProductsResponse> {
    return this.http.put<SearchProductsResponse>(`${this.productUrl}/update/option2`, payload, {
      withCredentials: true,
    });
  }

  updateProductOptionThree(payload: UpdateProductOptionThreeRequest): Observable<SearchProductsResponse> {
    return this.http.put<SearchProductsResponse>(`${this.productUrl}/update/option3`, payload, {
      withCredentials: true,
    });
  }



}
