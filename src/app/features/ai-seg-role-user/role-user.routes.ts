import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';

export const roleUserRoutes: Routes = [
  {
    path: 'rol-usuario/:id',
    loadComponent: () =>
      import(
        '@features/ai-seg-role-user/pages/list-role-user/list-role-user.component'
      ).then((m) => m.ListRoleUserComponent),
    data: { breadcrumb: 'Roles - Usuario', roles: [1] },
    canActivate: [AuthenticationGuard],
  },
];
