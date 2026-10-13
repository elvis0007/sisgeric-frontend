import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const reportsAuditorGeneralRoutes: Routes = [
  {
    path: 'report-estado-seg',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-est-seg/view-report-est-seg.component'
      ).then((m) => m.ViewReportEstSegComponent),
    data: { breadcrumb: 'Reporte por Estado de Seguimiento Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-directorio',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-directorio/view-report-directorio.component'
      ).then((m) => m.ViewReportDirectorioComponent),
    data: { breadcrumb: 'Reporte Directorio', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-conteo-orgctrl',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-orgctrl-conteo/view-report-orgctrl-conteo.component'
      ).then((m) => m.ViewReportOrgctrlConteoComponent),
    data: { breadcrumb: 'Reporte de Conteo de Recomendaciones por Ente de Control Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-conteo-dpto',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-dpto-conteo/view-report-dpto-conteo.component'
      ).then((m) => m.ViewReportDptoConteoComponent),
    data: { breadcrumb: 'Reporte de Conteo de Recomendaciones por Departamento Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-informes-recomendaciones',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-informes-recomendaciones/view-report-informes-recomendaciones.component'
      ).then((m) => m.ViewReportInformesRecomendacionesComponent),
    data: { breadcrumb: 'Informes Recomendaciones', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-tipo-informe',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-tipoinf/view-report-tipoinf.component'
      ).then((m) => m.ViewReportTipoinfComponent),
    data: { breadcrumb: 'Reporte de Conteo de Recomendaciones por Tipo de Informe Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-departamento',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-departamento/view-report-departamento.component'
      ).then((m) => m.ViewReportDepartamentoComponent),
    data: { breadcrumb: 'Reporte por Departamentos', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-hallazgos',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-hallazgos/view-report-hallazgos.component'
      ).then((m) => m.ViewReportHallazgosComponent),
    data: { breadcrumb: 'Reporte de Hallazgos Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-fecha-corte',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-fecha-corte/view-report-fecha-corte.component'
      ).then((m) => m.ViewReportFechaCorteComponent),
    data: { breadcrumb: 'Reporte por Fecha de Corte Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-recomendaciones-vencidas-aij',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-recomendaciones-vencidas-aij/view-recomendaciones-vencidas-aij.component'
      ).then((m) => m.ViewRecomendacionesVencidasAijComponent),
    data: { breadcrumb: 'Recomendaciones Vencidas y en Proceso Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report7-auditores',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report7-auditores/view-report7-auditores.component'
      ).then((m) => m.ViewReport7AuditoresComponent),
    data: { breadcrumb: 'Reporte por Auditor Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-general-aij',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-general-aij/view-report-general-aij.component'
      ).then((m) => m.ViewReportGeneralAijComponent),
    data: { breadcrumb: 'Reporte General Jefatura', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-prorrogas-aij',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-prorrogas-aij/view-report-prorrogas-aij.component'
      ).then((m) => m.ViewReportProrrogasAijComponent),
    data: { breadcrumb: 'Reporte de Recomendaciones con Prórrogas Solicitadas', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'reporte-prorrogas-realizadas',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-prorrogas-realizadas-aij/view-report-prorrogas-realizadas-aij.component'
      ).then((m) => m.ViewReportProrrogasRealizadasAijComponent),
    data: { breadcrumb: 'Reporte de Prórrogas Realizadas por auditor', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-pendientes-demo',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-pendientes-demo/view-report-pendientes-demo.component'
      ).then((m) => m.ViewReportPendientesDemoComponent),
    data: { breadcrumb: 'Reporte de Pendientes (Jerárquico Demo)', roles: [2]},
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'report-planes-evidencias',
    loadComponent: () =>
      import(
        '@features/ai-report-auditor-general/pages/view-report-plan-evidencias/view-report-plan-evidencias.component'
      ).then((m) => m.ViewReportPlanEvidenciasComponent),
    data: { breadcrumb: 'Planes de Acción y Evidencias por Responsable', roles: [2, 3] },
    canActivate: [AuthenticationGuard],
  }
];
