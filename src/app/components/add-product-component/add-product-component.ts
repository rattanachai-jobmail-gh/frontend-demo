import { Component, inject, OnDestroy, signal } from '@angular/core';
import { Product } from '../../models/product';
import { HttpErrorResponse } from '@angular/common/http';
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { AuthService } from '../../services/auth-service';
import { ProductService } from '../../services/product-service';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { playScannerBeep } from '../../services/scanner-beep';
@Component({
  selector: 'app-add-product-component',
  imports: [FormField, FormRoot, RouterLink, RouterLinkActive],
  templateUrl: './add-product-component.html',
  styleUrl: './add-product-component.css',
})
export class AddProductComponent implements OnDestroy{

  private scanner?: Html5QrcodeScanner;
  private readonly scannerRegionId = 'qr-reader';
  scannerError = signal<string>('');
  isScannerOpen = signal<boolean>(false);
  scannerStatus = signal<string>('พร้อมสแกนบาร์โค้ด');
  lastScannedCode = signal<string>('');
  errorMessage = signal<string>('');


  private authService = inject(AuthService);
  private productService = inject(ProductService)
  private router = inject(Router);
  private newProduct: Product = {
    productSpu: '',
    productSku: '',
    productName: '',
    unitOfMeasure: '',
    productAmount: 0,
    productSellingPricePerUnit: 0,
    productCostPricePerUnit: 0,
    receivedDateExisted: true,
    expiredDateExisted: true,
    receivedDate:  null,
    expiredDate: null,
    productBarCode: '',
  };

  emptyProduct(){
    this.productModel.set(this.newProduct);
  }

  noReceivedDate = signal(false);
  noExpiredDate = signal(false);
  productModel = signal<Product>(this.newProduct);
  
  productForm = form(
    this.productModel,
    (schemaPath) => {
      required(schemaPath.productSpu);
      required(schemaPath.productSku);
      required(schemaPath.productName);
      required(schemaPath.unitOfMeasure);
      required(schemaPath.productSellingPricePerUnit);
      required(schemaPath.productBarCode);
    },
    {
      submission: {
        action: async (field) => {

          console.log("Form value:", field().value());


          const result = await firstValueFrom(this.productService.addNewProduct(field().value()));
          if (result) {
            this.emptyProduct();
            return;
          }
            
          return {kind: 'serverError', message: 'Failed to submit form'};
        },
        
      },
    },
  );
  toggleNoExpiredDate() {
    const noDate = !this.noExpiredDate();
    this.noExpiredDate.set(noDate);
    this.productModel.update(product => ({
      ...product,
      expiredDateExisted: !noDate,
      expiredDate: noDate ? null : product.expiredDate,
    }));
  }

  toggleNoReceivedDate() {
    const noDate = !this.noReceivedDate();
    this.noReceivedDate.set(noDate);

    this.productModel.update(product => ({
      ...product,
      receivedDateExisted: !noDate,
      receivedDate: noDate ? null : product.receivedDate,
    }));
  }

  openScanner(): void {
    if (this.scanner) { 
      return;
    }
    if (typeof window === 'undefined') {
      this.scannerError.set('การสแกนบาร์โค้ดใช้งานได้เฉพาะบนเบราว์เซอร์เท่านั้น');
      return;
    }

    this.isScannerOpen.set(true);

    this.scannerStatus.set('กำลังขอสิทธิ์ใช้งานกล้อง...');

    setTimeout(() => {
        if (!this.isScannerOpen || this.scanner) {
          return;
        }
        this.scanner = new Html5QrcodeScanner(
          this.scannerRegionId,{
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
            (decodedText) => {

              const cleanCode = decodedText.trim();

              if (!cleanCode) {
                return;
              }
              void playScannerBeep();
              this.lastScannedCode.set(cleanCode);
              this.scannerStatus.set('สแกนบาร์โค้ดสำเร็จ');
              this.productModel.update(product => ({
                ...product,
                productBarCode: cleanCode,
              }));
              this.closeScanner();
            },
            () =>{
              this.scannerStatus.set('กรุณาหันกล้องไปที่บาร์โค้ดหรือ QR code');
            }
          );
        }
        catch (error) {
          console.error('Scanner initialization failed:', error);
          this.scannerError.set('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งานกล้องแล้วลองใหม่อีกครั้ง');
          this.closeScanner();
        }

      }
    , 0)
  }

  closeScanner(): void {
    this.isScannerOpen.set(false);
    this.scannerStatus.set(this.lastScannedCode()
      ? 'ปิดหน้าสแกนแล้ว คุณสามารถตรวจสอบหรือสแกนใหม่ได้'
      : 'ปิดหน้าสแกนแล้ว');
    this.destroyScanner();
  }

  ngOnDestroy(): void {
    this.destroyScanner();
  }

  get hasBarcodeValue(): boolean {
    return !!this.newProduct.productBarCode?.trim();
  }

  get hasErrorMessage(): boolean {
    return (this.errorMessage() ?? '').trim().length > 0;
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

  clearBarcode(): void {
    this.newProduct.productBarCode = '';
    this.lastScannedCode.set('');
    this.scannerError.set('');
    this.scannerStatus.set('พร้อมสแกนบาร์โค้ด');
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: (res) => {
        console.log('Logout successful:', res);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout failed:', error);
      }
    });
  }

}

