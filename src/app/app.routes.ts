import { Routes } from '@angular/router';
import { LoginComponent } from './components/login-component/login-component';
import { RegisterComponent } from './components/register-component/register-component';
import { HomeComponent } from './components/home-component/home-component';
import { AddProductComponent } from './components/add-product-component/add-product-component';
import { authGuard } from './guards/auth-guard';
import { ceoGuard } from './guards/ceo-guard';
import { guestGuard } from './guards/guest-guard';
import { FindProductComponent } from './components/find-product-component/find-product-component';
import { CashierComponent } from './components/cashier-component/cashier-component';
import { SalesReportComponent } from './components/sales-report-component/sales-report-component';

export const routes: Routes = [
    {
        path: "login",
        component: LoginComponent,
        canActivate: [guestGuard]
    },
    {
        path: "register",
        component: RegisterComponent,
        canActivate: [guestGuard]
    },
    {
        path    : "home",
        component: HomeComponent,
        canActivate: [authGuard]
    },
    {
        path: "add-product",
        component: AddProductComponent,
        canActivate: [authGuard]
    },
    {
       path: "find-product",
       component: FindProductComponent,
       canActivate: [authGuard]  
    },
    {
        path: "cashier",
        component: CashierComponent,
        canActivate: [authGuard]
    },
    {
        path: "sales-report",
        component: SalesReportComponent,
        canActivate: [authGuard, ceoGuard]
    },
    { path: '', redirectTo: '/login', pathMatch: 'full' }

];
