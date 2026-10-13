import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const bitacoraRoutes: Routes = [
  {
    path: 'bitacora',
    loadComponent: () =>
      import(
        '@features/ai-seg-bitacora/pages/list-bitacora/list-bitacora.component'
      ).then((m) => m.ListBitacoraComponent),
    data: { breadcrumb: 'Bitácora', roles: [1] },
    canActivate: [AuthenticationGuard],
  },
];
