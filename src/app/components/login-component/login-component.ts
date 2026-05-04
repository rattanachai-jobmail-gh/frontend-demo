import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth-service';
import { ActivatedRoute, Router } from '@angular/router';
import { UserLogin } from '../../models/user-login';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login-component',
  imports: [FormField],
  templateUrl: './login-component.html',
  styleUrl: './login-component.css',
})
export class LoginComponent {
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


  async onLoginSubmit() {
    const success = await submit(this.loginForm, async (field) => {
      try {
        const result = await firstValueFrom(this.authService.login(field().value()));
        console.log('Login successful:', result);
        return;
      } catch (error: any) {
        console.log('Login failed:', error);

        if (error.status === 401 || error.status === 403) {
          console.log('Unauthorized or Forbidden:', error);
          this.loginModel.set(this.credentials);
          this.errorMessage.set('Invalid username or password');
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

}
