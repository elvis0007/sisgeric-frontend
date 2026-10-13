import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const planAccionRespRoutes: Routes = [
  {
    path: 'plan-accion-responsables',
    loadComponent: () =>
      import(
        './pages/list-plan-accion-resp/list-plan-accion-resp.component'
      ).then((m) => m.ListPlanAccionRespComponent),
    data: { breadcrumb: 'Plan de Acción', roles: [4] },
    canActivate: [AuthenticationGuard],
  },
];
