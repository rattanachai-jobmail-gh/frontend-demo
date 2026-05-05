import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Html5QrcodeScanner,
  Html5QrcodeScanType,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { firstValueFrom } from 'rxjs';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth-service';
import { ProductService } from '../../services/product-service';
import { SearchProductsResponse } from '../../models/search-products-response';
import { UpdateProductOptionOneRequest } from '../../models/update-product-option-one-request';
import { playScannerBeep } from '../../services/scanner-beep';

type ScannerMode = 'search' | 'count' | null;
type EditOptionKey = 'option1' | 'option2' | 'option3';

type ProductEditDraft = {
  productSpu: string;
  productSku: string;
  productName: string;
  unitOfMeasure: string;
  productSellingPricePerUnit: number;
  receivedDate: string;
  expiredDate: string;
  productBarCode: string;
  productAmount: number;
  productCostPricePerUnit: number;
};

@Component({
  selector: 'app-find-product-component',
  imports: [FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './find-product-component.html',
  styleUrl: './find-product-component.css',
})
export class FindProductComponent implements OnDestroy {
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private router = inject(Router);
  private scanner?: Html5QrcodeScanner;
  private readonly scannerRegionId = 'find-product-qr-reader';
  private lastScanCode = '';
  private lastScanTimestamp = 0;
  private statusMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ceoAuthorities = signal<string[]>([]);
  statusMessage = signal<string>('');
  isLoading = signal<boolean>(false);
  isScannerOpen = signal<boolean>(false);
  scannerError = signal<string>('');
  scannerStatus = signal<string>('พร้อมสแกนบาร์โค้ด');
  scannerMode = signal<ScannerMode>(null);
  activeCountProductSku = signal<string | null>(null);
  lastScannedCode = signal<string>('');

  searchedProducts = signal<SearchProductsResponse[]>([]);
  totalPages = signal<number>(0);
  totalElements = signal<number>(0);
  expandedProductSku = signal<string | null>(null);
  editDrafts = signal<Record<string, ProductEditDraft>>({});
  selectedEditOptions = signal<Record<string, Partial<Record<EditOptionKey, boolean>>>>({});

  searchKeyword = signal<string>('');
  page = signal<number>(0);
  size = signal<number>(10);

  searchSavedProducts(keyword: string): void {
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword === '') {
      this.showTemporaryStatusMessage('กรุณากรอกคำค้นหา');
      return;
    }

    this.page.set(0);
    this.searchKeyword.set(trimmedKeyword);
    this.statusMessage.set('');
    this.loadProducts();
  }

  goToPage(targetPage: number): void {
    if (targetPage < 0 || targetPage >= this.totalPages() || targetPage === this.page()) {
      return;
    }

    this.page.set(targetPage);
    this.loadProducts();
  }

  clearSearchResults(): void {
    this.searchedProducts.set([]);
    this.totalPages.set(0);
    this.totalElements.set(0);
    this.page.set(0);
    this.searchKeyword.set('');
    this.clearStatusMessage();
    this.lastScannedCode.set('');
    this.expandedProductSku.set(null);
    this.editDrafts.set({});
    this.selectedEditOptions.set({});
  }

  toggleEditPanel(product: SearchProductsResponse): void {
    const targetSku = product.searchProductSku;

    this.getUserAuthorities();

    if (this.expandedProductSku() === targetSku) {
      this.expandedProductSku.set(null);
      if (this.activeCountProductSku() === targetSku) {
        this.closeScanner();
      }
      return;
    }

    this.expandedProductSku.set(targetSku);
    if (!this.editDrafts()[targetSku]) {
      this.editDrafts.update((drafts) => ({
        ...drafts,
        [targetSku]: this.createDraft(product),
      }));
    }
  }

  isEditOptionSelected(productSku: string, option: EditOptionKey): boolean {
    return !!this.selectedEditOptions()[productSku]?.[option];
  }

  getSelectedEditOptionCount(productSku: string): number {
    return Object.values(this.selectedEditOptions()[productSku] ?? {}).filter(Boolean).length;
  }

  toggleEditOption(productSku: string, option: EditOptionKey, event?: Event): void {
    if (event && this.isInteractiveElement(event.target)) {
      return;
    }

    this.selectedEditOptions.update((selectedOptions) => ({
      ...selectedOptions,
      [productSku]: {
        ...selectedOptions[productSku],
        [option]: !selectedOptions[productSku]?.[option],
      },
    }));
  }

  async saveSelectedOptions(product: SearchProductsResponse): Promise<void> {
    const originalSku = product.searchProductSku;
    const selectedCount = this.getSelectedEditOptionCount(originalSku);

    if (selectedCount === 0) {
      return;
    }

    const selectedOptions = this.selectedEditOptions()[originalSku] ?? {};
    const draft = this.editDrafts()[originalSku];

    if (!draft) {
      this.showTemporaryStatusMessage('ไม่พบข้อมูลสินค้าที่ต้องการบันทึก');
      return;
    }

    this.isLoading.set(true);
    this.showTemporaryStatusMessage(`กำลังบันทึก ${selectedCount} option สำหรับสินค้า ${originalSku}`, 1500);

    try {
      let latestProduct = product;

      if (selectedOptions.option1) {
        latestProduct = await firstValueFrom(
          this.productService.updateProductOptionOne(this.buildOptionOnePayload(product, draft))
        );
      }

      if (selectedOptions.option2) {
        latestProduct = await firstValueFrom(
          this.productService.updateProductOptionTwo({
            productSpu: latestProduct.searchProductSpu,
            productSku: latestProduct.searchProductSku,
            productAmount: Math.max(0, draft.productAmount),
          })
        );
      }

      if (selectedOptions.option3) {
        latestProduct = await firstValueFrom(
          this.productService.updateProductOptionThree({
            productSpu: latestProduct.searchProductSpu,
            productSku: latestProduct.searchProductSku,
            productCostPricePerUnit: Math.max(0, draft.productCostPricePerUnit),
          })
        );
      }

      this.syncUpdatedProduct(product, latestProduct);
      this.selectedEditOptions.update((selected) => {
        const nextSelected = { ...selected };
        delete nextSelected[originalSku];
        nextSelected[latestProduct.searchProductSku] = {};
        return nextSelected;
      });
      this.expandedProductSku.set(latestProduct.searchProductSku);
      this.showTemporaryStatusMessage(`บันทึกข้อมูลสินค้า ${latestProduct.searchProductSku} สำเร็จ`);
    } catch (error: any) {
      const backendMessage = error?.error?.message;
      this.showTemporaryStatusMessage(backendMessage || 'บันทึกข้อมูลสินค้าไม่สำเร็จ');
    } finally {
      this.isLoading.set(false);
    }
  }

  updateDraftField<K extends keyof ProductEditDraft>(
    productSku: string,
    field: K,
    value: ProductEditDraft[K]
  ): void {
    this.editDrafts.update((drafts) => ({
      ...drafts,
      [productSku]: {
        ...drafts[productSku],
        [field]: value,
      },
    }));
  }

  increaseCount(productSku: string): void {
    const draft = this.editDrafts()[productSku];
    if (!draft) {
      return;
    }

    this.updateDraftField(productSku, 'productAmount', draft.productAmount + 1);
  }

  decreaseCount(productSku: string): void {
    const draft = this.editDrafts()[productSku];
    if (!draft) {
      return;
    }

    this.updateDraftField(productSku, 'productAmount', Math.max(0, draft.productAmount - 1));
  }

  openSearchScanner(): void {
    this.openScanner('search');
  }

  openCountScanner(product: SearchProductsResponse): void {
    this.activeCountProductSku.set(product.searchProductSku);
    this.openScanner('count');
  }

  closeScanner(): void {
    this.isScannerOpen.set(false);
    this.scannerMode.set(null);
    this.activeCountProductSku.set(null);
    this.scannerStatus.set('ปิดหน้าสแกนแล้ว');
    this.destroyScanner();
  }

  ngOnDestroy(): void {
    this.clearStatusMessageTimer();
    this.destroyScanner();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.showTemporaryStatusMessage('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'),
    });
  }

  private openScanner(mode: ScannerMode): void {
    if (!mode || this.scanner) {
      return;
    }

    if (typeof window === 'undefined') {
      this.scannerError.set('การสแกนบาร์โค้ดใช้งานได้เฉพาะบนเบราว์เซอร์');
      return;
    }

    this.scannerMode.set(mode);
    this.scannerError.set('');
    this.isScannerOpen.set(true);
    this.scannerStatus.set(
      mode === 'search'
        ? 'กำลังเปิดกล้องเพื่อค้นหาสินค้า...'
        : 'กำลังเปิดกล้องเพื่อนับจำนวนสินค้า...'
    );

    setTimeout(() => {
      if (!this.isScannerOpen() || this.scanner) {
        return;
      }

      this.scanner = new Html5QrcodeScanner(
        this.scannerRegionId,
        {
          fps: 12,
          qrbox: { width: 260, height: 160 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
        },
        false
      );

      try {
        this.scanner.render(
          (decodedText) => this.handleScan(decodedText.trim()),
          () => {
            this.scannerStatus.set(
              this.scannerMode() === 'search'
                ? 'กรุณาหันกล้องไปที่บาร์โค้ดสินค้าเพื่อค้นหา'
                : 'กรุณาหันกล้องไปที่บาร์โค้ดสินค้าเพื่อเพิ่มจำนวน'
            );
          }
        );
      } catch (error) {
        console.error('Scanner initialization failed:', error);
        this.scannerError.set('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งานกล้องแล้วลองใหม่อีกครั้ง');
        this.closeScanner();
      }
    }, 0);
  }

  private handleScan(scannedCode: string): void {
    if (!scannedCode || this.shouldIgnoreDuplicateScan(scannedCode)) {
      return;
    }

    this.lastScannedCode.set(scannedCode);
    void playScannerBeep();

    if (this.scannerMode() === 'search') {
      this.searchKeyword.set(scannedCode);
      this.statusMessage.set('');
      this.scannerStatus.set('สแกนบาร์โค้ดสำเร็จ กำลังค้นหาสินค้า');
      this.closeScanner();
      this.searchSavedProducts(scannedCode);
      return;
    }

    const activeSku = this.activeCountProductSku();
    if (!activeSku) {
      this.scannerError.set('ยังไม่ได้เลือกสินค้าที่ต้องการนับ');
      return;
    }

    const draft = this.editDrafts()[activeSku];
    if (!draft) {
      this.scannerError.set('ไม่พบข้อมูลสินค้าที่กำลังนับ');
      return;
    }

    if (draft.productBarCode.trim() !== '' && draft.productBarCode !== scannedCode) {
      this.scannerError.set('บาร์โค้ดที่สแกนไม่ตรงกับสินค้าที่เลือก');
      this.scannerStatus.set('สแกนใหม่อีกครั้งด้วยบาร์โค้ดของสินค้านี้');
      return;
    }

    this.scannerError.set('');
    this.updateDraftField(activeSku, 'productAmount', draft.productAmount + 1);
    this.scannerStatus.set(`นับสินค้าเพิ่มแล้ว จำนวนปัจจุบัน ${draft.productAmount + 1}`);
  }

  private shouldIgnoreDuplicateScan(scannedCode: string): boolean {
    const now = Date.now();
    const isDuplicate = this.lastScanCode === scannedCode && now - this.lastScanTimestamp < 1200;

    this.lastScanCode = scannedCode;
    this.lastScanTimestamp = now;

    return isDuplicate;
  }

  private loadProducts(): void {
    this.isLoading.set(true);
    this.productService.searchProducts(this.searchKeyword(), this.page(), this.size()).subscribe({
      next: (response) => {
        const products = response.content ?? [];
        this.searchedProducts.set(products);
        this.totalPages.set(response.totalPages ?? 0);
        this.totalElements.set(response.totalElements ?? 0);
        this.page.set(response.number ?? 0);
        this.editDrafts.set(
          Object.fromEntries(products.map((product) => [product.searchProductSku, this.createDraft(product)]))
        );
        this.selectedEditOptions.set(
          Object.fromEntries(products.map((product) => [product.searchProductSku, {}]))
        );
      },
      error: () => {
        this.showTemporaryStatusMessage('ค้นหาสินค้าไม่สำเร็จ');
        this.isLoading.set(false);
      },
      complete: () => this.isLoading.set(false),
    });
  }

  private createDraft(product: SearchProductsResponse): ProductEditDraft {
    return {
      productSpu: product.searchProductSpu,
      productSku: product.searchProductSku,
      productName: product.searchProductName,
      unitOfMeasure: product.searchUnitOfMeasure,
      productSellingPricePerUnit: product.searchProductSellingPricePerUnit,
      receivedDate: this.toDateInputValue(product.searchReceivedDate),
      expiredDate: this.toDateInputValue(product.searchExpiredDate),
      productBarCode: product.searchProductBarCode,
      productAmount: product.searchProductAmount,
      productCostPricePerUnit: product.searchProductCostPricePerUnit ?? 0,
    };
  }

  private buildOptionOnePayload(
    product: SearchProductsResponse,
    draft: ProductEditDraft
  ): UpdateProductOptionOneRequest {
    return {
      originalProductSpu: product.searchProductSpu,
      originalProductSku: product.searchProductSku,
      productSpu: draft.productSpu.trim(),
      productSku: draft.productSku.trim(),
      productName: draft.productName.trim(),
      unitOfMeasure: draft.unitOfMeasure.trim(),
      productSellingPricePerUnit: draft.productSellingPricePerUnit,
      receivedDateExisted: !!draft.receivedDate,
      expiredDateExisted: !!draft.expiredDate,
      receivedDate: draft.receivedDate || null,
      expiredDate: draft.expiredDate || null,
      productBarCode: draft.productBarCode.trim(),
    };
  }

  private syncUpdatedProduct(
    originalProduct: SearchProductsResponse,
    updatedProduct: SearchProductsResponse
  ): void {
    this.searchedProducts.update((products) =>
      products.map((product) =>
        product.searchProductSpu === originalProduct.searchProductSpu
          && product.searchProductSku === originalProduct.searchProductSku
          ? updatedProduct
          : product
      )
    );

    const nextDraft = this.createDraft(updatedProduct);
    this.editDrafts.update((drafts) => {
      const nextDrafts = { ...drafts };
      delete nextDrafts[originalProduct.searchProductSku];
      nextDrafts[updatedProduct.searchProductSku] = nextDraft;
      return nextDrafts;
    });
  }

  private toDateInputValue(value: string | Date | null): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value.slice(0, 10);
    }

    return value.toISOString().slice(0, 10);
  }

  private destroyScanner(): void {
    const activeScanner = this.scanner;
    this.scanner = undefined;

    if (!activeScanner) {
      return;
    }

    activeScanner.clear().catch((error) => {
      console.error('Failed to clear scanner:', error);
    });
  }

  private showTemporaryStatusMessage(message: string, durationMs: number = 3000): void {
    this.clearStatusMessageTimer();
    this.statusMessage.set(message);
    this.statusMessageTimeoutId = setTimeout(() => {
      this.statusMessage.set('');
      this.statusMessageTimeoutId = null;
    }, durationMs);
  }

  private clearStatusMessage(): void {
    this.clearStatusMessageTimer();
    this.statusMessage.set('');
  }

  private clearStatusMessageTimer(): void {
    if (this.statusMessageTimeoutId) {
      clearTimeout(this.statusMessageTimeoutId);
      this.statusMessageTimeoutId = null;
    }
  }

  private isInteractiveElement(target: EventTarget | null): boolean {
    return target instanceof HTMLElement
      && !!target.closest('input, button, select, textarea, a, label');
  }

  private getUserAuthorities(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        const authorities = user?.authorities || [];
        this.ceoAuthorities.set(authorities.includes('CEO') ? authorities : []);
      },
      error: (err) => {
        console.error('Failed to get user authorities:', err);
      },
    });
  }
}
