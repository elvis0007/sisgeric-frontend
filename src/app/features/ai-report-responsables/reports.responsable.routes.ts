import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const reportsRecomResponsableRoutes: Routes = [
  {
    path: 'report-recom-responsable',
    loadComponent: () =>
      import(
        '@features/ai-report-responsables/pages/view-recom-responsable/view-recom-responsable.component'
      ).then((m) => m.ViewRecomResponsableComponent),
    data: { breadcrumb: 'Reporte Recomendaciones', roles: [4]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-progreso-recom-responsable',
    loadComponent: () =>
      import(
        '@features/ai-report-responsables/pages/view-progreso-recom/view-progreso-recom.component'
      ).then((m) => m.ViewProgresoRecomComponent),
    data: { breadcrumb: 'Reporte Progreso Recomendaciones', roles: [4]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-verificables-responsable',
    loadComponent: () =>
      import(
        '@features/ai-report-responsables/pages/view-verificables/view-verificables.component'
      ).then((m) => m.ViewVerificablesComponent),
    data: { breadcrumb: 'Reporte Verificables', roles: [4]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-recomendaciones-vencidas-responsable',
    loadComponent: () =>
      import(
        '@features/ai-report-responsables/pages/view-recomendaciones-vencidas-responsable/view-recomendaciones-vencidas-responsable.component'
      ).then((m) => m.ViewRecomendacionesVencidasResponsableComponent),
    data: { breadcrumb: 'Recomendaciones Vencidas', roles: [4]},
    canActivate: [AuthenticationGuard],
  }
];
