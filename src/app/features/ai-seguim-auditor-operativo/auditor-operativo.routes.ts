import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const auditorOperativoRoutes: Routes = [
  {
    path: 'auditor-operativo',
    loadComponent: () =>
      import(
        '@features/ai-seguim-auditor-operativo/pages/list-informes/list-informes.component'
      ).then((m) => m.ListInformesComponent),
    data: { breadcrumb: 'Auditor Operativo - Informes', roles: [3] },
    canActivate: [AuthenticationGuard],
    children: [
      {
        path: 'hallazgos/:id',
        loadComponent: () =>
          import(
            '@features/ai-seguim-auditor-operativo/pages/list-hallazgos/list-hallazgos.component'
          ).then((m) => m.ListHallazgosComponent),
        data: { breadcrumb: 'Hallazgos', roles: [3] },
        canActivate: [AuthenticationGuard],
        children: [
          {
            path: 'conclusiones/:id',
            loadComponent: () =>
              import(
                '@features/ai-seguim-auditor-operativo/pages/list-conclusiones/list-conclusiones.component'
              ).then((m) => m.ListConclusionesComponent),
            data: { breadcrumb: 'Conclusiones', roles: [3] },
            canActivate: [AuthenticationGuard],
            children: [
              {
                path: 'crear-conclusion',
                loadComponent: () =>
                  import(
                    '@features/ai-seguim-auditor-operativo/pages/register-conclusiones/register-conclusiones.component'
                  ).then((m) => m.RegisterConclusionesComponent),
                data: { breadcrumb: 'Registrar Conclusión', roles: [3] },
                canActivate: [AuthenticationGuard],
              },
              {
                path: 'recomendaciones/:id',
                loadComponent: () =>
                  import(
                    '@features/ai-seguim-auditor-operativo/pages/list-recomendaciones/list-recomendaciones.component'
                  ).then((m) => m.ListRecomendacionesComponent),
                data: { breadcrumb: 'Recomendaciones', roles: [3] },
                canActivate: [AuthenticationGuard],
                children: [
                  {
                    path: 'riesgo/:idRec',
                    loadComponent: () =>
                      import(
                        './pages/view-riesgo-recomendacion/view-riesgo-recomendacion.component'
                      ).then((m) => m.ViewRiesgoRecomendacionComponent),
                    data: { breadcrumb: 'Riesgo y Evidencia', roles: [3] },
                    canActivate: [AuthenticationGuard],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
