import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const reportsAuditorOperativoRoutes: Routes = [
  {
    path: 'report-planes-evidencias-operativo',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-operativo/pages/view-report-plan-evidencias-operativo/view-report-plan-evidencias-operativo.component'
      ).then((m) => m.ViewReportPlanEvidenciasOperativoComponent),
    data: { breadcrumb: 'Planes de Acción y Evidencias por Responsable', roles: [1, 2, 3] },
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-est-seg-oper',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-operativo/pages/view-report-est-seg-oper/view-report-est-seg-oper.component'
      ).then((m) => m.ViewReportEstSegOperComponent),
    data: { breadcrumb: 'Estado Seguimiento por Recomendación', roles: [1, 2, 3]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-est-seg-responsable',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-operativo/pages/view-report-est-seg-resp/view-report-est-seg-resp.component'
      ).then((m) => m.ViewReportEstSegRespComponent),
    data: { breadcrumb: 'Estado Seguimiento por Responsable', roles: [3]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-detalle-est-seg',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-operativo/pages/view-report-detalle-estseg/view-report-detalle-estseg.component'
      ).then((m) => m.ViewReportDetalleEstsegComponent),
    data: { breadcrumb: 'Reporte detalle de recomendaciones', roles: [1, 2, 3]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-recomendaciones-vencidas-operativo',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-operativo/pages/view-recomendaciones-vencidas-operativo/view-recomendaciones-vencidas-operativo.component'
      ).then((m) => m.ViewRecomendacionesVencidasOperativoComponent),
    data: { breadcrumb: 'Recomendaciones Vencidas', roles: [1, 2, 3]},
    canActivate: [AuthenticationGuard],
  }
];
