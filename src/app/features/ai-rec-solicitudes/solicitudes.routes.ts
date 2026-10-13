import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const solicitudesRoutes: Routes = [
  {
    path: 'auditor-solicitudes',
    loadComponent: () =>
      import(
        '@features/ai-rec-solicitudes/pages/list-solicitudes/list-solicitudes.component'
      ).then((m) => m.ListSolicitudesDirectorComponent),
    data: { breadcrumb: 'Solicitudes Auditados', roles: [3]},
    canActivate: [AuthenticationGuard],
  },
];
