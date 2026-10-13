import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const recomendacionesRoutes: Routes = [
  {
    path: 'recomendaciones',
    loadComponent: () =>
      import(
        '@features/ai-seguim-recomendaciones/pages/list-recomendaciones/list-recomendaciones.component'
      ).then((m) => m.ListRecomendacionesComponent),
    data: { breadcrumb: 'Recomendaciones', roles: [2,3] },
    canActivate: [AuthenticationGuard],
    children: [],
  },
];
