import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth-service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated().pipe(
    map((isAuthenticated) => {
      if (!isAuthenticated) {
        return true;
      }

      console.log('User is authenticated, redirecting to home page.');
      return router.createUrlTree(['/home'], {
        queryParams: { returnUrl: state.url },
      });
    })
  );
};
