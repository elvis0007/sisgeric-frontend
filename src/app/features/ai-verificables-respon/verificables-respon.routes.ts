import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const verificablesRespRoutes: Routes = [
  {
    path: 'evidencias-responsables',
    loadComponent: () =>
      import(
        '@features/ai-verificables-respon/pages/list-verificables-resp/list-verificables-resp.component'
      ).then((m) => m.ListVerificablesRespComponent),
    data: { breadcrumb: 'Evidencias', roles: [4] },
    canActivate: [AuthenticationGuard],
    children: [],
  },
  {
    path: 'verificables-responsables',
    redirectTo: 'evidencias-responsables',
    pathMatch: 'full'
  },
  {
    path: 'plan-accion-responsables',
    redirectTo: 'evidencias-responsables',
    pathMatch: 'full'
  }
];
