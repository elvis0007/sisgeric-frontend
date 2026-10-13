import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const verificablesRoutes: Routes = [
  {
    path: 'informes-verificables',
    loadComponent: () =>
      import(
        '@features/ai-rec-verificables/pages/list-informes/list-informes.component'
      ).then((m) => m.ListInformesComponent),
    data: { breadcrumb: 'Evidencias - Informes', roles: [2, 3] },
    canActivate: [AuthenticationGuard],
    children: [
      {
        path: 'recomendaciones-verificables/:id',
        loadComponent: () =>
          import(
            '@features/ai-rec-verificables/pages/list-recomendaciones/list-recomendaciones.component'
          ).then((m) => m.ListRecomendacionesComponent),
        data: { breadcrumb: 'Recomendaciones', roles: [2, 3] },
        canActivate: [AuthenticationGuard],
        children: [
          {
            path: 'verificables/:id',
            loadComponent: () =>
              import(
                '@features/ai-rec-verificables/pages/list-verificables/list-verificables.component'
              ).then((m) => m.ListVerificablesComponent),
            data: { breadcrumb: 'Evidencia', roles: [2, 3] },
            canActivate: [AuthenticationGuard],
            children: [],
          },
        ],
      },
    ],
  },
];
