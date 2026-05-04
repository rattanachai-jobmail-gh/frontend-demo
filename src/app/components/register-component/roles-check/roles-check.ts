import { Component, EventEmitter, Input, model, Output } from '@angular/core';
import { FormCheckboxControl } from '@angular/forms/signals';
import { RegisterComponent } from '../register-component';

@Component({
  selector: 'app-roles-check',
  imports: [],
  standalone: true,
  templateUrl: './roles-check.html',
  styleUrl: './roles-check.css',
})
export class RolesCheck{
  @Input() selectedRolesInput: boolean = false;
  private selectedRoles: Set<string> = new Set<string>();
  protected roleOptions = ["CEO", "Cashier"] ;
  
  @Output() rolesCheckEvent = new EventEmitter<Set<string>>();

  onCheck(roleName: string, checked: boolean){
    if (checked) {
      this.selectedRoles.add(roleName);
    }
    else if (!checked) {
      this.selectedRoles.delete(roleName);
    }
    this.rolesCheckEvent.emit(this.selectedRoles);
  }

}
