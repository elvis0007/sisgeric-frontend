import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';
import { bitacoraRoutes } from '@features/ai-seg-bitacora/bitacora.routes';
import { configuracionRoutes } from '@features/ai-seg-configuracion/configuracion.routes';
import { rolesRoutes } from '@features/ai-seg-role/roles.routes';
import { auditorOperativoRoutes } from '@features/ai-seguim-auditor-operativo/auditor-operativo.routes';
import { recomendacionesRoutes } from '@features/ai-seguim-recomendaciones/recomendaciones.routes';
import { verificablesRoutes } from '@features/ai-rec-verificables/verificables.routes';
import { verificablesRespRoutes } from '@features/ai-verificables-respon/verificables-respon.routes';
import { auditorGeneralRoutes } from '@features/ai-seguim-auditor-general/auditor-general.routes';
import { directorDepartamentalRoutes } from '@features/ai-director-departamental/director-depart.routes';
import { directorInformesRoutes } from '@features/ai-director-informes/director.informes.routes';
import { solicitudesRoutes } from '@features/ai-rec-solicitudes/solicitudes.routes';
import { reportsAuditorGeneralRoutes } from '@features/ai-report-auditor-general/report-auditor-gen.routes';
import { reportsAuditorOperativoRoutes } from '@features/ai-report-auditor-operativo/reports-auditor-ope.routes';
import { reportsRecomResponsableRoutes } from '@features/ai-report-responsables/reports.responsable.routes';
import { reportsDirectorRoutes } from '@features/ai-report-director/reports-director.routes';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'inicio',
  },
  {
    path: 'inicio',
    loadComponent: () =>
      import('@core/main-page/pages/home/home.component').then(
        (m) => m.HomeComponent
      ),
    data: { breadcrumb: 'Inicio', roles: [1,2,3,4,5] },
    children: [
      ...rolesRoutes,
      ...bitacoraRoutes,
      ...configuracionRoutes,
      ...auditorOperativoRoutes,
      ...auditorGeneralRoutes,
      ...recomendacionesRoutes,
      ...verificablesRoutes,
      ...verificablesRespRoutes,
      ...directorDepartamentalRoutes,
      ...directorInformesRoutes,
      ...solicitudesRoutes,
      ...reportsAuditorGeneralRoutes,
      ...reportsAuditorOperativoRoutes,
      ...reportsRecomResponsableRoutes,
      ...reportsDirectorRoutes
    ],
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'intranet',
    loadComponent: () =>
      import('@core/auth/components/redirection.component').then(
        (m) => m.RedirectionComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'inicio',
  },
];
