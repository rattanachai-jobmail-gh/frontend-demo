import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth-service';

type CurrentUser = {
  authorities?: string[];
};

export const ceoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getCurrentUser().pipe(
    map((user: CurrentUser) =>
      user.authorities?.includes('CEO') ? true : router.createUrlTree(['/home'])
    ),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};
