import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth-service';

type CurrentUser = {
  username?: string;
  firstName?: string;
  authorities?: string[];
};

@Component({
  selector: 'app-home-component',
  imports: [],
  templateUrl: './home-component.html',
  styleUrl: './home-component.css',
})
export class HomeComponent implements OnInit {
  username = '';
  isLoading = true;
  isLoggingOut = false;
  errorMessage = '';
  canViewSalesReport=signal<boolean>(false);

  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user: CurrentUser) => {
        this.username = user.firstName || user.username || '';
        this.canViewSalesReport.set(user.authorities?.includes('CEO') ?? false);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Unable to load your session.';
      },
    });
  }

  goToAddProductPage(): void {
    this.router.navigate(['/add-product']);
  }

  goToCashier(): void {
    this.router.navigate(['/cashier']);
  }

  goToSalesReport(): void {
    this.router.navigate(['/sales-report']);
  }



  goToCountProduct(): void {
    this.router.navigate(['/find-product']);
  }



  logout(): void {
    this.authService.logout().subscribe({
      next: (res) => {
        console.log('Logout successful:', res);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout failed:', error);
        this.errorMessage = 'Logout failed. Please try again.';
      }
    });
  }

}
