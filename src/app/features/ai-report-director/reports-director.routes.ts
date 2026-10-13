import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const reportsDirectorRoutes: Routes = [
  {
    path: 'reporte-director-rec',
    loadComponent: () =>
      import(
        '@features/ai-report-director/pages/view-report-director-rec/view-report-director-rec.component'
      ).then((m) => m.ViewReportDirectorRecComponent),
    data: { breadcrumb: 'Reporte de Recomendaciones', roles: [5]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-departamento-fechas-vencidas',
    loadComponent: () =>
      import(
        '@features/ai-report-director/pages/view-departamento-fechas-vencidas/view-departamento-fechas-vencidas.component'
      ).then((m) => m.ViewDepartamentoFechasVencidasComponent),
    data: { breadcrumb: 'Departamento fechas vencidas', roles: [5]},
    canActivate: [AuthenticationGuard],
  }
];
