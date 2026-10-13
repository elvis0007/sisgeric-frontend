import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';
import { pendingChangesGuard } from '@core/guards/pending-changes.guard';

export const auditorGeneralRoutes: Routes = [
  {
    path: 'auditor-general',
    loadComponent: () =>
      import(
        '@features/ai-seguim-auditor-general/pages/list-informes-ag/list-informes-ag.component'
      ).then((m) => m.ListInformesAgComponent),
    data: { breadcrumb: 'Auditor General - Informes', roles: [2]},
    canActivate: [AuthenticationGuard],
    children: [
      {
        path: 'hallazgos-auditor-gen/:id',
        loadComponent: () =>
          import(
            '@features/ai-seguim-auditor-general/pages/list-hallazgos-ag/list-hallazgos-ag.component'
          ).then((m) => m.ListHallazgosAgComponent),
        data: { breadcrumb: 'Hallazgos', roles: [2] },
        canActivate: [AuthenticationGuard],
        children: [
          {
            path: 'conclusiones-auditor-gen/:id',
            loadComponent: () =>
              import(
                '@features/ai-seguim-auditor-general/pages/list-conclusiones-ag/list-conclusiones-ag.component'
              ).then((m) => m.ListConclusionesAgComponent),
            data: { breadcrumb: 'Conclusiones', roles: [2] },
            canActivate: [AuthenticationGuard],
            children: [
              {
                path: 'recomendaciones-auditor-gen/:id',
                loadComponent: () =>
                  import(
                    '@features/ai-seguim-auditor-general/pages/list-recomendaciones-ag/list-recomendaciones-ag.component'
                  ).then((m) => m.ListRecomendacionesComponent),
                data: { breadcrumb: 'Recomendaciones', roles: [2] },
                canActivate: [AuthenticationGuard],
                children: [
                  {
                    path: 'riesgo/:idRec',
                    loadComponent: () =>
                      import(
                        '@features/ai-seguim-auditor-operativo/pages/view-riesgo-recomendacion/view-riesgo-recomendacion.component'
                      ).then((m) => m.ViewRiesgoRecomendacionComponent),
                    data: { breadcrumb: 'Riesgo y Evidencia', roles: [2] },
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
  {
    path: 'periodos-evaluacion',
    loadComponent: () =>
      import(
        '@features/ai-seguim-auditor-general/pages/view-periodos-evaluacion/view-periodos-evaluacion.component'
      ).then((m) => m.ViewPeriodosEvaluacionComponent),
    data: { breadcrumb: 'Periodos de Evaluación Jefatura', roles: [2] },
    canActivate: [AuthenticationGuard],
    children: [
      {
        path: ':id',
        loadComponent: () =>
          import(
            '@features/ai-seguim-auditor-general/pages/view-detalle-periodo-informes/view-detalle-periodo-informes.component'
          ).then((m) => m.ViewDetallePeriodoInformesComponent),
        data: { breadcrumb: 'Detalle de Informes por Periodo', roles: [2] },
        canActivate: [AuthenticationGuard],
        canDeactivate: [pendingChangesGuard],
      },
    ],
  },
];

