import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const directorInformesRoutes: Routes = [
  {
    path: 'director-informes',
    loadComponent: () =>
      import(
        '@features/ai-director-informes/pages/list-informes/list-informes.component'
      ).then((m) => m.ListInformesComponent),
    data: { breadcrumb: 'Director - Informes', roles: [5] },
    canActivate: [AuthenticationGuard],
    children: [
      {
        path: 'recomendaciones-director/:id',
        loadComponent: () =>
          import(
            '@features/ai-director-informes/pages/list-recomendaciones/list-recomendaciones.component'
          ).then((m) => m.ListRecomendacionesComponent),
        data: { breadcrumb: 'Recomendaciones', roles: [5] },
        canActivate: [AuthenticationGuard],
        children: [
        ],
      },
    ],
  },
];
