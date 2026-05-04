import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Html5QrcodeScanner,
  Html5QrcodeScanType,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SaleCheckoutResponse } from '../../models/sale-checkout-response';
import { SalePaymentMethod } from '../../models/sale-payment-method';
import { SearchProductsResponse } from '../../models/search-products-response';
import { AuthService } from '../../services/auth-service';
import { ProductService } from '../../services/product-service';
import { SaleService } from '../../services/sale-service';

type PaymentMethod = 'cash' | 'transfer';
type BillDiscountType = 'NONE' | 'AMOUNT' | 'PERCENT';
type LineDiscountType = 'NONE' | 'AMOUNT' | 'PERCENT';
type ScannerMode = 'add' | 'count';

type CartItem = {
  productSpu: string;
  productSku: string;
  productName: string;
  barcode: string;
  unitOfMeasure: string;
  sellingPricePerUnit: number;
  quantity: number;
  availableAmount: number;
  discountType: LineDiscountType;
  discountValue: number;
};

@Component({
  selector: 'app-cashier-component',
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, CurrencyPipe],
  templateUrl: './cashier-component.html',
  styleUrl: './cashier-component.css',
})
export class CashierComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly saleService = inject(SaleService);
  private readonly router = inject(Router);
  private readonly scannerRegionId = 'cashier-qr-reader';
  private scanner?: Html5QrcodeScanner;
  private statusMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;

  barcodeInput = signal('');
  isLoading = signal(false);
  statusMessage = signal('');
  scannerError = signal('');
  scannerStatus = signal('Ready to scan product barcode');
  isScannerOpen = signal(false);
  scannerMode = signal<ScannerMode>('add');
  countTargetSku = signal<string | null>(null);
  paymentMethod = signal<PaymentMethod>('cash');
  billDiscountType = signal<BillDiscountType>('NONE');
  discountInput = signal<string>('0');
  receivedCashInput = signal<string>('0');
  saleNoteInput = signal<string>('');
  cartItems = signal<CartItem[]>([]);
  quantityDrafts = signal<Record<string, string>>({});
  lastCompletedSale = signal<SaleCheckoutResponse | null>(null);

  subtotal = computed(() =>
    this.cartItems().reduce((sum, item) => sum + this.getCartItemLineTotal(item), 0)
  );

  totalItems = computed(() => this.cartItems().reduce((sum, item) => sum + item.quantity, 0));

  discountValue = computed(() => {
    const parsedValue = Number(this.discountInput());
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return 0;
    }

    if (this.billDiscountType() === 'PERCENT') {
      return Math.min(100, parsedValue);
    }

    return parsedValue;
  });

  discountAmount = computed(() => {
    const subtotal = this.subtotal();
    const discountType = this.billDiscountType();
    const discountValue = this.discountValue();

    if (discountType === 'PERCENT') {
      return Math.min(subtotal, subtotal * (discountValue / 100));
    }

    if (discountType === 'AMOUNT') {
      return Math.min(subtotal, discountValue);
    }

    return 0;
  });

  grandTotal = computed(() => Math.max(0, this.subtotal() - this.discountAmount()));

  receivedCash = computed(() => {
    const parsedValue = Number(this.receivedCashInput());
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
  });

  remainingAmount = computed(() => Math.max(0, this.grandTotal() - this.receivedCash()));
  changeAmount = computed(() => Math.max(0, this.receivedCash() - this.grandTotal()));

  canCheckout = computed(
    () =>
      this.cartItems().length > 0
      && this.paymentMethod() === 'cash'
      && this.receivedCash() >= this.grandTotal()
      && !this.isLoading()
  );

  async addProductToCartFromBarcode(rawBarcode: string): Promise<void> {
    const barcode = rawBarcode.trim();
    if (!barcode) {
      this.showTemporaryStatusMessage('Please enter or scan a product barcode.');
      return;
    }

    this.isLoading.set(true);
    this.scannerError.set('');

    try {
      const response = await firstValueFrom(
        this.productService.searchProducts(barcode, 0, 20, 'productName,asc')
      );

      const matchedProduct = (response.content ?? []).find(
        (product) => product.searchProductBarCode.trim() === barcode
      );

      if (!matchedProduct) {
        this.showTemporaryStatusMessage(`No product found for barcode ${barcode}.`);
        return;
      }

      if (matchedProduct.searchProductAmount <= 0) {
        this.showTemporaryStatusMessage(`${matchedProduct.searchProductName} is out of stock.`);
        return;
      }

      this.addMatchedProductToCart(matchedProduct);
      this.barcodeInput.set('');
      this.showTemporaryStatusMessage(`${matchedProduct.searchProductName} added to cart.`);
    } catch {
      this.showTemporaryStatusMessage('Unable to add product to cart.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async addManualBarcodeToCart(): Promise<void> {
    await this.addProductToCartFromBarcode(this.barcodeInput());
  }

  increaseQuantity(productSku: string): void {
    this.cartItems.update((items) =>
      items.map((item) => {
        if (item.productSku !== productSku) {
          return item;
        }

        const nextQuantity = Math.min(item.availableAmount, item.quantity + 1);
        if (nextQuantity === item.quantity) {
          this.showTemporaryStatusMessage(`${item.productName} reached available stock limit.`);
        }

        this.syncQuantityDraft(productSku, nextQuantity);

        return { ...item, quantity: nextQuantity };
      })
    );
  }

  decreaseQuantity(productSku: string): void {
    let nextQuantity = 0;

    this.cartItems.update((items) =>
      items
        .map((item) => {
          if (item.productSku !== productSku) {
            return item;
          }

          nextQuantity = Math.max(0, item.quantity - 1);
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    );

    if (nextQuantity > 0) {
      this.syncQuantityDraft(productSku, nextQuantity);
    } else {
      this.clearQuantityDraft(productSku);
    }
  }

  removeCartItem(productSku: string): void {
    this.cartItems.update((items) => items.filter((item) => item.productSku !== productSku));
    this.clearQuantityDraft(productSku);
  }

  clearCart(): void {
    this.cartItems.set([]);
    this.quantityDrafts.set({});
    this.billDiscountType.set('NONE');
    this.discountInput.set('0');
    this.receivedCashInput.set('0');
    this.saleNoteInput.set('');
    this.showTemporaryStatusMessage('Cart cleared.');
  }

  setPaymentMethod(method: PaymentMethod): void {
    if (method === 'transfer') {
      this.showTemporaryStatusMessage('Bank transfer is temporarily disabled.');
      return;
    }

    this.paymentMethod.set(method);
  }

  updateReceivedCash(value: string): void {
    this.receivedCashInput.set(value);
  }

  preventNumberInputWheel(event: WheelEvent): void {
    event.preventDefault();
  }

  updateSaleNote(value: string): void {
    this.saleNoteInput.set(value);
  }

  updateCartQuantityDraft(productSku: string, value: string | number): void {
    const draftValue = String(value ?? '');

    this.quantityDrafts.update((drafts) => ({
      ...drafts,
      [productSku]: draftValue,
    }));

    const parsedQuantity = this.parseCartQuantity(draftValue);
    if (parsedQuantity == null) {
      return;
    }

    this.applyCartQuantity(productSku, parsedQuantity);
  }

  commitCartQuantity(productSku: string): void {
    const rawValue = this.quantityDrafts()[productSku];
    if (rawValue == null) {
      return;
    }

    const parsedQuantity = this.parseCartQuantity(rawValue);
    if (parsedQuantity == null) {
      const existingItem = this.cartItems().find((item) => item.productSku === productSku);
      if (existingItem) {
        this.syncQuantityDraft(productSku, existingItem.quantity);
      }
      return;
    }

    this.applyCartQuantity(productSku, parsedQuantity);

    if (parsedQuantity > 0) {
      const updatedItem = this.cartItems().find((item) => item.productSku === productSku);
      if (updatedItem) {
        this.syncQuantityDraft(productSku, updatedItem.quantity);
      }
    } else {
      this.clearQuantityDraft(productSku);
    }
  }

  setCartItemDiscountType(productSku: string, discountType: LineDiscountType): void {
    this.cartItems.update((items) =>
      items.map((item) =>
        item.productSku === productSku
          ? {
              ...item,
              discountType,
              discountValue: discountType === 'NONE' ? 0 : item.discountValue,
            }
          : item
      )
    );
  }

  updateCartItemDiscountValue(productSku: string, value: string): void {
    const parsedValue = Number(value);
    const normalizedValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;

    this.cartItems.update((items) =>
      items.map((item) =>
        item.productSku === productSku
          ? {
              ...item,
              discountValue: item.discountType === 'PERCENT' ? Math.min(100, normalizedValue) : normalizedValue,
            }
          : item
      )
    );
  }

  setBillDiscountType(discountType: BillDiscountType): void {
    this.billDiscountType.set(discountType);
    if (discountType === 'NONE') {
      this.discountInput.set('0');
    }
  }

  updateDiscountInput(value: string): void {
    this.discountInput.set(value);
  }

  async checkoutCart(): Promise<void> {
    if (this.cartItems().length === 0) {
      this.showTemporaryStatusMessage('Cart is empty.');
      return;
    }

    if (this.paymentMethod() !== 'cash') {
      this.showTemporaryStatusMessage('Only cash payment is enabled right now.');
      return;
    }

    if (this.receivedCash() < this.grandTotal()) {
      this.showTemporaryStatusMessage('Received cash is less than the total amount.');
      return;
    }

    this.isLoading.set(true);

    try {
      const response = await firstValueFrom(
        this.saleService.checkoutSale({
          paymentMethod: this.toSalePaymentMethod(this.paymentMethod()),
          receivedAmount: this.receivedCash(),
          billDiscountType: this.billDiscountType(),
          billDiscountValue: this.discountValue(),
          billDiscountAmount: this.discountAmount(),
          note: this.saleNoteInput().trim(),
          items: this.cartItems().map((item) => ({
            productSpu: item.productSpu,
            productSku: item.productSku,
            quantity: item.quantity,
            discountType: item.discountType,
            discountValue: item.discountValue,
          })),
        })
      );

      this.lastCompletedSale.set(response);
      this.cartItems.set([]);
      this.quantityDrafts.set({});
      this.billDiscountType.set('NONE');
      this.discountInput.set('0');
      this.receivedCashInput.set('0');
      this.saleNoteInput.set('');
      this.showTemporaryStatusMessage(`Sale #${response.saleId} saved successfully.`, 4200);
    } catch (error: any) {
      const backendMessage = error?.error?.message;
      this.showTemporaryStatusMessage(backendMessage || 'Unable to save sale.');
    } finally {
      this.isLoading.set(false);
    }
  }

  openScanner(): void {
    this.scannerMode.set('add');
    this.countTargetSku.set(null);
    this.openScannerModal('Opening camera for barcode scan...');
  }

  openCountScanner(item: CartItem): void {
    this.scannerMode.set('count');
    this.countTargetSku.set(item.productSku);
    this.openScannerModal(`Ready to count ${item.productName}. Scan the same barcode to add quantity.`);
  }

  private openScannerModal(initialStatus: string): void {
    if (this.scanner) {
      return;
    }

    if (typeof window === 'undefined') {
      this.scannerError.set('Barcode scanning is available only in the browser.');
      return;
    }

    this.scannerError.set('');
    this.scannerStatus.set(initialStatus);
    this.isScannerOpen.set(true);

    setTimeout(() => {
      if (!this.isScannerOpen() || this.scanner) {
        return;
      }

      this.scanner = new Html5QrcodeScanner(
        this.scannerRegionId,
        {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
          ],
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
        },
        false
      );

      try {
        this.scanner.render(
          async (decodedText) => {
            const scannedBarcode = decodedText.trim();
            if (!scannedBarcode) {
              return;
            }

            if (this.scannerMode() === 'count') {
              this.handleCountScan(scannedBarcode);
              return;
            }

            this.scannerStatus.set(`Scanned: ${scannedBarcode}`);
            this.closeScanner();
            await this.addProductToCartFromBarcode(scannedBarcode);
          },
          () => {
            this.scannerStatus.set(
              this.scannerMode() === 'count'
                ? 'Point the camera at the matching product barcode to count it.'
                : 'Point the camera at a product barcode.'
            );
          }
        );
      } catch (error) {
        console.error('Cashier scanner initialization failed:', error);
        this.scannerError.set('Unable to open camera. Please try again.');
        this.closeScanner();
      }
    }, 0);
  }

  closeScanner(): void {
    this.isScannerOpen.set(false);
    this.scannerStatus.set('Scanner closed.');
    this.scannerMode.set('add');
    this.countTargetSku.set(null);
    this.destroyScanner();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.showTemporaryStatusMessage('Logout failed. Please try again.'),
    });
  }

  ngOnDestroy(): void {
    this.clearStatusMessageTimer();
    this.destroyScanner();
  }

  private addMatchedProductToCart(product: SearchProductsResponse): void {
    this.cartItems.update((items) => {
      const existingItem = items.find((item) => item.productSku === product.searchProductSku);

      if (!existingItem) {
        return [
          ...items,
          {
            productSpu: product.searchProductSpu,
            productSku: product.searchProductSku,
            productName: product.searchProductName,
            barcode: product.searchProductBarCode,
            unitOfMeasure: product.searchUnitOfMeasure,
            sellingPricePerUnit: product.searchProductSellingPricePerUnit,
            quantity: 1,
            availableAmount: product.searchProductAmount,
            discountType: 'NONE',
            discountValue: 0,
          },
        ];
      }

      return items.map((item) => {
        if (item.productSku !== product.searchProductSku) {
          return item;
        }

        const nextQuantity = Math.min(item.availableAmount, item.quantity + 1);
        this.syncQuantityDraft(item.productSku, nextQuantity);
        return {
          ...item,
          quantity: nextQuantity,
        };
      });
    });

    const addedItem = this.cartItems().find((item) => item.productSku === product.searchProductSku);
    if (addedItem) {
      this.syncQuantityDraft(addedItem.productSku, addedItem.quantity);
    }
  }

  private toSalePaymentMethod(method: PaymentMethod): SalePaymentMethod {
    return method === 'cash' ? 'CASH' : 'TRANSFER';
  }

  getCartItemGrossTotal(item: CartItem): number {
    return item.sellingPricePerUnit * item.quantity;
  }

  getCartItemDiscountAmount(item: CartItem): number {
    const grossTotal = this.getCartItemGrossTotal(item);
    if (grossTotal <= 0) {
      return 0;
    }

    if (item.discountType === 'PERCENT') {
      return Math.min(grossTotal, grossTotal * (Math.min(100, Math.max(0, item.discountValue)) / 100));
    }

    if (item.discountType === 'AMOUNT') {
      return Math.min(grossTotal, Math.max(0, item.discountValue));
    }

    return 0;
  }

  getCartItemLineTotal(item: CartItem): number {
    return Math.max(0, this.getCartItemGrossTotal(item) - this.getCartItemDiscountAmount(item));
  }

  getCartItemNetUnitPrice(item: CartItem): number {
    return item.quantity > 0 ? this.getCartItemLineTotal(item) / item.quantity : item.sellingPricePerUnit;
  }

  getCartQuantityDraft(productSku: string, quantity: number): string {
    return this.quantityDrafts()[productSku] ?? String(quantity);
  }

  getDisplayedCartQuantity(productSku: string, quantity: number, availableAmount: number): number {
    const draftValue = this.quantityDrafts()[productSku];
    if (draftValue == null) {
      return quantity;
    }

    const trimmedValue = draftValue.trim();
    if (trimmedValue === '') {
      return quantity;
    }

    const parsedValue = Number(trimmedValue);
    if (!Number.isFinite(parsedValue)) {
      return quantity;
    }

    return Math.min(availableAmount, Math.max(0, Math.floor(parsedValue)));
  }

  private handleCountScan(scannedBarcode: string): void {
    const targetSku = this.countTargetSku();
    const cartItem = this.cartItems().find((item) => item.productSku === targetSku);

    if (!targetSku || !cartItem) {
      this.scannerError.set('No cart item selected for counting.');
      return;
    }

    if (cartItem.barcode.trim() !== scannedBarcode) {
      this.scannerError.set(`Scanned barcode does not match ${cartItem.productName}.`);
      this.scannerStatus.set(`Waiting for barcode ${cartItem.barcode}`);
      return;
    }

    this.scannerError.set('');

    if (cartItem.quantity >= cartItem.availableAmount) {
      this.scannerStatus.set(`${cartItem.productName} already reached available stock limit.`);
      return;
    }

    this.increaseQuantity(cartItem.productSku);
    const updatedItem = this.cartItems().find((item) => item.productSku === cartItem.productSku);
    this.scannerStatus.set(
      `${cartItem.productName} counted. Quantity is now ${updatedItem?.quantity ?? cartItem.quantity}.`
    );
  }

  private showTemporaryStatusMessage(message: string, durationMs: number = 2800): void {
    this.clearStatusMessageTimer();
    this.statusMessage.set(message);
    this.statusMessageTimeoutId = setTimeout(() => {
      this.statusMessage.set('');
      this.statusMessageTimeoutId = null;
    }, durationMs);
  }

  private clearStatusMessageTimer(): void {
    if (this.statusMessageTimeoutId) {
      clearTimeout(this.statusMessageTimeoutId);
      this.statusMessageTimeoutId = null;
    }
  }

  private destroyScanner(): void {
    const activeScanner = this.scanner;
    this.scanner = undefined;

    if (!activeScanner) {
      return;
    }

    activeScanner.clear().catch((error) => {
      console.error('Failed to clear cashier scanner:', error);
    });
  }

  private syncQuantityDraft(productSku: string, quantity: number): void {
    this.quantityDrafts.update((drafts) => ({
      ...drafts,
      [productSku]: String(quantity),
    }));
  }

  private clearQuantityDraft(productSku: string): void {
    this.quantityDrafts.update((drafts) => {
      const { [productSku]: _removed, ...rest } = drafts;
      return rest;
    });
  }

  private parseCartQuantity(value: string): number | null {
    const trimmedValue = value.trim();
    if (trimmedValue === '') {
      return null;
    }

    const parsedValue = Number(trimmedValue);
    if (!Number.isFinite(parsedValue)) {
      return null;
    }

    return Math.max(0, Math.floor(parsedValue));
  }

  private applyCartQuantity(productSku: string, quantity: number): void {
    this.cartItems.update((items) =>
      items
        .map((item) => {
          if (item.productSku !== productSku) {
            return item;
          }

          return {
            ...item,
            quantity: Math.min(item.availableAmount, quantity),
          };
        })
        .filter((item) => item.quantity > 0)
    );
  }
}
