
import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, switchMap} from 'rxjs';
import { AuthService } from './auth-service';

export const csrfInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const isCsrfRequest = req.url.includes('/csrfApi/getCsrf');
  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (isCsrfRequest || !unsafeMethods.includes(req.method)) {
    return next(req);
  }

  return authService.getCsrfToken().pipe(
    switchMap(token => {
      const newReq = req.clone({
        setHeaders: {
          'X-CSRF-TOKEN': token
        },
        withCredentials: true
      });

      return next(newReq);
    })
  );
  
};
