import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth-service';
import { RegisterDTO } from '../../models/register-dto';
import {form, FormField, required, submit} from '@angular/forms/signals';
import { RolesCheck } from './roles-check/roles-check';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-register-component',
  imports: [FormField, RolesCheck],
  templateUrl: './register-component.html',
  styleUrl: './register-component.css',
})
export class RegisterComponent {

  private authService = inject(AuthService); 
  selectedRolesDisable: boolean = false; 
  errorMessage = signal('');
  successMessage = signal('');
  private registerDto: RegisterDTO = {
      firstname: '',
      lastname: '',
      username: '',
      password: '',
      roles: []
  };
  private registerModel = signal(this.registerDto); 


  registerForm = form(this.registerModel, (schemaPath) => {
    required(schemaPath.firstname);
    required(schemaPath.lastname);
    required(schemaPath.username);
    required(schemaPath.password);
    required(schemaPath.roles);
  });



  async onRegisterSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');

    const success = await submit(this.registerForm, async (field) => {
      try {
        const result = await firstValueFrom(this.authService.register(field().value()));
        this.successMessage.set(`Created account for ${result.username}`);
        console.log('result: ', result);
        return;
      } catch (error: any) {
        const apiMessage =
          typeof error?.error?.error === 'string'
            ? error.error.error
            : 'Unable to create account right now';

        this.errorMessage.set(apiMessage);
        return { kind: 'serverError', message: apiMessage };
      }
    });

    if (success) {
      this.selectedRolesDisable = true;
      this.registerModel.set({ ...this.registerDto });
    }
  }
  onReceive(roles: Set<string>){
    console.log("roles",roles);
    this.registerModel.update(value => ({
      ...value,
      roles: Array.from(roles)
    }));
  }

  
  


}
