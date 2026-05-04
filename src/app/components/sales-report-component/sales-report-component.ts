import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SearchProductsResponse } from '../../models/search-products-response';
import { SaleCheckoutResponse } from '../../models/sale-checkout-response';
import { ProductService } from '../../services/product-service';
import { SaleService } from '../../services/sale-service';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-sales-report-component',
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, CurrencyPipe, DatePipe],
  templateUrl: './sales-report-component.html',
  styleUrl: './sales-report-component.css',
})
export class SalesReportComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly saleService = inject(SaleService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  reportDate = signal(this.toDateInputValue(new Date()));
  productKeyword = signal('');
  saleKeyword = signal('');
  isLoadingProducts = signal(false);
  isLoadingSales = signal(false);
  productError = signal('');
  salesError = signal('');
  products = signal<SearchProductsResponse[]>([]);
  productPage = signal(0);
  productSize = signal(10);
  productTotalPages = signal(0);
  productTotalElements = signal(0);
  allProductsForCost = signal<SearchProductsResponse[]>([]);
  sales = signal<SaleCheckoutResponse[]>([]);
  salesPage = signal(0);
  salesSize = signal(5);
  expandedSaleId = signal<number | null>(null);

  filteredSales = computed(() => {
    const keyword = this.saleKeyword().trim().toLowerCase();
    const sales = this.sales();

    if (!keyword) {
      return sales;
    }

    return sales.filter((sale) => {
      const billText = [
        sale.saleId,
        sale.cashierUsername,
        sale.cashierFirstName,
        sale.cashierLastName,
        sale.paymentMethod,
        sale.note,
      ].join(' ').toLowerCase();

      const itemText = sale.items
        .map((item) =>
          [
            item.itemName,
            item.saleItemSku,
            item.saleItemSpu,
            item.saleItemBarCode,
          ].join(' ')
        )
        .join(' ')
        .toLowerCase();

      return billText.includes(keyword) || itemText.includes(keyword);
    });
  });

  totalRevenue = computed(() =>
    this.filteredSales().reduce((sum, sale) => sum + sale.grandTotal, 0)
  );

  dailySales = computed(() =>
    this.sales().filter((sale) => this.toDateInputValue(sale.saleDate) === this.reportDate())
  );

  dailyRevenue = computed(() =>
    this.dailySales().reduce((sum, sale) => sum + sale.grandTotal, 0)
  );

  dailyQuantitySold = computed(() =>
    this.dailySales().reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    )
  );

  dailyEstimatedCost = computed(() =>
    this.dailySales().reduce((sum, sale) => sum + this.getSaleEstimatedCost(sale), 0)
  );

  salesTotalPages = computed(() =>
    Math.ceil(this.filteredSales().length / this.salesSize())
  );

  pagedSales = computed(() => {
    const startIndex = this.salesPage() * this.salesSize();
    return this.filteredSales().slice(startIndex, startIndex + this.salesSize());
  });

  totalQuantitySold = computed(() =>
    this.filteredSales().reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    )
  );

  totalProductCost = computed(() =>
    this.products().reduce((sum, product) => {
      const cost = product.searchProductCostPricePerUnit ?? 0;
      return sum + cost * product.searchProductAmount;
    }, 0)
  );

  lowStockCount = computed(() =>
    this.products().filter((product) => product.searchProductAmount <= 5).length
  );

  ngOnInit(): void {
    this.loadProductsForCost();
    this.searchProducts();
    this.loadSales();
  }

  searchProducts(): void {
    this.isLoadingProducts.set(true);
    this.productError.set('');

    this.productService
      .searchProducts(this.productKeyword(), this.productPage(), this.productSize(), 'productName,asc')
      .subscribe({
      next: (response) => {
        this.products.set(response.content ?? []);
        this.productPage.set(response.number ?? 0);
        this.productTotalPages.set(response.totalPages ?? 0);
        this.productTotalElements.set(response.totalElements ?? 0);
      },
      error: () => {
        this.products.set([]);
        this.productTotalPages.set(0);
        this.productTotalElements.set(0);
        this.productError.set('Unable to load product inventory.');
      },
      complete: () => this.isLoadingProducts.set(false),
    });
  }

  searchProductsFromFirstPage(): void {
    this.productPage.set(0);
    this.searchProducts();
  }

  goToProductPage(targetPage: number): void {
    if (
      targetPage < 0
      || targetPage >= this.productTotalPages()
      || targetPage === this.productPage()
      || this.isLoadingProducts()
    ) {
      return;
    }

    this.productPage.set(targetPage);
    this.searchProducts();
  }

  clearProductSearch(): void {
    this.productKeyword.set('');
    this.searchProductsFromFirstPage();
  }

  loadSales(): void {
    this.isLoadingSales.set(true);
    this.salesError.set('');

    this.saleService.getAllSales().subscribe({
      next: (sales) => {
        this.sales.set(
          [...sales].sort(
            (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
          )
        );
        this.salesPage.set(0);
        this.expandedSaleId.set(null);
      },
      error: () => {
        this.sales.set([]);
        this.salesError.set('Unable to load sales report.');
      },
      complete: () => this.isLoadingSales.set(false),
    });
  }

  updateSaleKeyword(value: string): void {
    this.saleKeyword.set(value);
    this.salesPage.set(0);
    this.expandedSaleId.set(null);
  }

  goToSalesPage(targetPage: number): void {
    if (
      targetPage < 0
      || targetPage >= this.salesTotalPages()
      || targetPage === this.salesPage()
      || this.isLoadingSales()
    ) {
      return;
    }

    this.salesPage.set(targetPage);
    this.expandedSaleId.set(null);
  }

  toggleSale(saleId: number): void {
    this.expandedSaleId.set(this.expandedSaleId() === saleId ? null : saleId);
  }

  getProductCost(product: SearchProductsResponse): number {
    return product.searchProductCostPricePerUnit ?? 0;
  }

  getProductInventoryValue(product: SearchProductsResponse): number {
    return this.getProductCost(product) * product.searchProductAmount;
  }

  getSaleEstimatedCost(sale: SaleCheckoutResponse): number {
    return sale.items.reduce((sum, item) => {
      const product = this.findProductByItem(item.saleItemSpu, item.saleItemSku);
      const cost = product?.searchProductCostPricePerUnit ?? 0;
      return sum + cost * item.quantity;
    }, 0);
  }

  getSaleEstimatedProfit(sale: SaleCheckoutResponse): number {
    return sale.grandTotal - this.getSaleEstimatedCost(sale);
  }

  downloadDailySalesCsv(): void {
    const csv = this.toCsv(this.getDailySalesExportRows());
    this.downloadFile(csv, `daily-sales-${this.reportDate()}.csv`, 'text/csv;charset=utf-8');
  }

  downloadDailySalesExcel(): void {
    const rows = this.getDailySalesExportRows();
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table>
            <thead>
              <tr>${Object.keys(rows[0] ?? this.getEmptyExportRow()).map((key) => `<th>${this.escapeHtml(key)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>${Object.values(row).map((value) => `<td>${this.escapeHtml(String(value))}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    this.downloadFile(
      html,
      `daily-sales-${this.reportDate()}.xls`,
      'application/vnd.ms-excel;charset=utf-8'
    );
  }

  downloadDailySalesPdf(): void {
    const lines = [
      'TongGaw Daily Sales Report',
      `Date: ${this.reportDate()}`,
      `Bills: ${this.dailySales().length}`,
      `Quantity Sold: ${this.dailyQuantitySold()}`,
      `Revenue: ${this.formatNumber(this.dailyRevenue())} THB`,
      `Estimated Cost: ${this.formatNumber(this.dailyEstimatedCost())} THB`,
      `Estimated Profit: ${this.formatNumber(this.dailyRevenue() - this.dailyEstimatedCost())} THB`,
      '',
      ...this.getDailySalesExportRows().map((row) =>
        [
          `Sale #${row['saleId']}`,
          row['saleDate'],
          row['cashier'],
          row['itemName'],
          `Qty ${row['quantity']}`,
          `Total ${row['lineTotal']}`,
        ].join(' | ')
      ),
    ];

    this.downloadFile(
      this.createSimplePdf(lines),
      `daily-sales-${this.reportDate()}.pdf`,
      'application/pdf'
    );
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.salesError.set('Logout failed. Please try again.'),
    });
  }

  private findProductByItem(productSpu: string, productSku: string): SearchProductsResponse | undefined {
    return this.allProductsForCost().find(
      (product) =>
        product.searchProductSpu === productSpu && product.searchProductSku === productSku
    );
  }

  private loadProductsForCost(): void {
    this.productService.searchProducts('', 0, 1000, 'productName,asc').subscribe({
      next: (response) => this.allProductsForCost.set(response.content ?? []),
      error: () => this.allProductsForCost.set([]),
    });
  }

  private getDailySalesExportRows(): Record<string, string | number>[] {
    const rows = this.dailySales().flatMap((sale) =>
      sale.items.map((item) => {
        const product = this.findProductByItem(item.saleItemSpu, item.saleItemSku);
        const unitCost = product?.searchProductCostPricePerUnit ?? 0;
        const estimatedCost = unitCost * item.quantity;

        return {
          saleId: sale.saleId,
          saleDate: new Date(sale.saleDate).toLocaleString(),
          cashier: `${sale.cashierFirstName} ${sale.cashierLastName}`.trim() || sale.cashierUsername,
          paymentMethod: sale.paymentMethod,
          itemName: item.itemName,
          sku: item.saleItemSku,
          spu: item.saleItemSpu,
          barcode: item.saleItemBarCode,
          quantity: item.quantity,
          unitOfMeasure: item.unitOfMeasure || 'pcs',
          unitPrice: this.formatNumber(item.unitPrice),
          unitCost: this.formatNumber(unitCost),
          discountAmount: this.formatNumber(item.discountAmount),
          lineTotal: this.formatNumber(item.lineTotal),
          estimatedCost: this.formatNumber(estimatedCost),
          estimatedProfit: this.formatNumber(item.lineTotal - estimatedCost),
          saleNote: sale.note || '',
        };
      })
    );

    return rows.length > 0 ? rows : [this.getEmptyExportRow()];
  }

  private getEmptyExportRow(): Record<string, string | number> {
    return {
      saleId: '',
      saleDate: this.reportDate(),
      cashier: '',
      paymentMethod: '',
      itemName: 'No sales found',
      sku: '',
      spu: '',
      barcode: '',
      quantity: 0,
      unitOfMeasure: '',
      unitPrice: '0.00',
      unitCost: '0.00',
      discountAmount: '0.00',
      lineTotal: '0.00',
      estimatedCost: '0.00',
      estimatedProfit: '0.00',
      saleNote: '',
    };
  }

  private toCsv(rows: Record<string, string | number>[]): string {
    const headers = Object.keys(rows[0] ?? this.getEmptyExportRow());
    const csvRows = [
      headers,
      ...rows.map((row) => headers.map((header) => row[header] ?? '')),
    ];

    return `\uFEFF${csvRows
      .map((row) => row.map((value) => this.escapeCsvValue(String(value))).join(','))
      .join('\r\n')}`;
  }

  private escapeCsvValue(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    if (typeof document === 'undefined') {
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private createSimplePdf(lines: string): string;
  private createSimplePdf(lines: string[]): string;
  private createSimplePdf(lines: string | string[]): string {
    const allLines = Array.isArray(lines) ? lines : lines.split('\n');
    const pageLines = 42;
    const pages = [];

    for (let index = 0; index < allLines.length; index += pageLines) {
      pages.push(allLines.slice(index, index + pageLines));
    }

    const objects: string[] = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);

    pages.forEach((page, index) => {
      const pageObjectNumber = 3 + index * 2;
      const contentObjectNumber = pageObjectNumber + 1;
      const content = [
        'BT',
        '/F1 10 Tf',
        '40 800 Td',
        ...page.map((line, lineIndex) =>
          `${lineIndex === 0 ? '' : '0 -18 Td '}${this.escapePdfText(this.toPdfSafeText(line))} Tj`
        ),
        'ET',
      ].join('\n');

      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObjectNumber} 0 R >>`);
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return pdf;
  }

  private escapePdfText(value: string): string {
    return `(${value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
  }

  private toPdfSafeText(value: string): string {
    return value.replace(/[^\x20-\x7E]/g, '?');
  }

  private formatNumber(value: number): string {
    return value.toFixed(2);
  }

  private toDateInputValue(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
