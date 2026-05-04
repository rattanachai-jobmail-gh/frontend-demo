import { Product } from './product';
import { SearchProductsResponse } from './search-products-response';

export interface ProductPageResponse {
  content: SearchProductsResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
