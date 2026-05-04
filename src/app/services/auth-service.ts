import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RegisterDTO } from '../models/register-dto';
import { catchError, map, Observable, of } from 'rxjs';
import { RegisterResponse } from '../models/register-response';
import { UserLogin } from '../models/user-login';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private http = inject(HttpClient);

  private baseUrl = `http://tonggaw.onrender.com/auth`;
  private csrfUrl = `http://tonggaw.onrender.com/csrfApi`;

  

  

  register(registerDto: RegisterDTO) : Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.baseUrl}/register`, registerDto,{ 
      withCredentials: true });
  }

  login(userLogin: UserLogin): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, userLogin, { withCredentials: true });
  }
  
  getCsrfToken(): Observable<string> {
    return this.http.get(`${this.csrfUrl}/getCsrf`, { responseType: 'text', withCredentials: true });
  }

  getCurrentUser(): Observable<any> {
    return this.http.get(`${this.baseUrl}/me`, { withCredentials: true });
  }

  isAuthenticated(): Observable<boolean> {
    return this.getCurrentUser().pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  logout():  Observable<any>{
    return this.http.post(`${this.baseUrl}/logout`,  {},{ responseType: 'text', withCredentials: true });
  }
}
