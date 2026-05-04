import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth-service';
import { RegisterDTO } from '../../models/register-dto';
import {form, FormField, required, submit} from '@angular/forms/signals';
import { RolesCheck } from './roles-check/roles-check';
import { compileHmrUpdateCallback } from '@angular/compiler';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-register-component',
  imports: [FormField, RolesCheck],
  templateUrl: './register-component.html',
  styleUrl: './register-component.css',
})
export class RegisterComponent {

  private authService = inject(AuthService); 
  private roles_set = new Set<string>();
  selectedRolesDisable: boolean = false; 
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
    
    console.log("submit clicked");
    console.log("model before submit:", this.registerModel());

    const success = await submit(this.registerForm, async (field) => {
      const result = await firstValueFrom(this.authService.register(field().value()));
        console.log("result: ",result);
    });
    if (success) {
      this.selectedRolesDisable = true;
      this.registerModel.set(this.registerDto);
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
