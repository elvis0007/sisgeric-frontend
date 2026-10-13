import { Routes } from '@angular/router';
import { AuthenticationGuard } from '@core/auth/guards/authentication.guard';
import { roleUserRoutes } from '@features/ai-seg-role-user/role-user.routes';

export const rolesRoutes: Routes = [
  {
    path: 'roles',
    loadComponent: () =>
      import(
        '@features/ai-seg-role/pages/list-roles/list-roles.component'
      ).then((m) => m.ListRolesComponent),
    data: { breadcrumb: 'Roles', roles: [1] },
    children: [...roleUserRoutes],
    canActivate: [AuthenticationGuard],
  },
];
