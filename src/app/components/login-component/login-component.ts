import { Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../services/auth-service';
import { Router } from '@angular/router';
import { UserLogin } from '../../models/user-login';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login-component',
  imports: [FormField],
  templateUrl: './login-component.html',
  styleUrl: './login-component.css',
})
export class LoginComponent implements OnInit {
  isLoggedIn = signal(false);
  private credentials: UserLogin = {
    username: '',
    password: '',
  };

  private authService = inject(AuthService);
  private router = inject(Router);
  errorMessage = signal('');


  private loginModel = signal(this.credentials); 
 
  loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.username);
    required(schemaPath.password);
  });

  ngOnInit(): void {
    // Warm the CSRF/session handshake before the first submit, which helps Safari/iPad.
    void this.refreshCsrfToken();
  }

  async onLoginSubmit() {
    this.errorMessage.set('');

    const success = await submit(this.loginForm, async (field) => {
      const credentials = field().value();

      try {
        const result = await this.loginWithCsrfRetry(credentials);
        console.log('Login successful:', result);
        return;
      } catch (error: any) {
        console.log('Login failed:', error);

        if (error.status === 401) {
          this.loginModel.set(this.credentials);
          this.errorMessage.set('Invalid username or password');
        } else if (error.status === 403) {
          this.errorMessage.set('Secure session expired. Please try again.');
        } else {
          this.errorMessage.set('Unable to connect to server');
        }

        return { kind: 'serverError', message: this.errorMessage() };
      }
    });

    if (success) {
      this.isLoggedIn.set(true);
      this.router.navigate(['/home']);
    }
  }

  private async loginWithCsrfRetry(credentials: UserLogin) {
    try {
      return await firstValueFrom(this.authService.login(credentials));
    } catch (error: any) {
      if (error.status !== 403) {
        throw error;
      }

      await this.refreshCsrfToken();
      return firstValueFrom(this.authService.login(credentials));
    }
  }

  private async refreshCsrfToken() {
    try {
      await firstValueFrom(this.authService.getCsrfToken());
    } catch (error) {
      console.log('Failed to refresh CSRF token:', error);
    }
  }

}
