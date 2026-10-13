import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const directorDepartamentalRoutes: Routes = [
  {
    path: 'director-solicitudes',
    loadComponent: () =>
      import(
        '@features/ai-director-departamental/pages/list-director-depart/list-director-depart.component'
      ).then((m) => m.ListDirectorDepartComponent),
    data: { breadcrumb: 'Director - Solicitudes', roles: [5]},
    canActivate: [AuthenticationGuard],
    children: [],
  },
];
