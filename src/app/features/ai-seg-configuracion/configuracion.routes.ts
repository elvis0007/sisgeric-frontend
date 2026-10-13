import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const configuracionRoutes: Routes = [
  {
    path: 'nas',
    loadComponent: () =>
      import(
        '@features/ai-seg-configuracion/pages/list-nas/list-nas.component'
      ).then((m) => m.ListNasComponent),
    data: { breadcrumb: 'NAS', roles: [1] },
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'configuracion',
    loadComponent: () =>
      import(
        '@features/ai-seg-configuracion/pages/list-tablas-satelistes/list-tablas-satelistes.component'
      ).then((m) => m.ListTablasSatelistesComponent),
    data: { breadcrumb: 'Configuración', roles: [1] },
    canActivate: [AuthenticationGuard],
  },
];
