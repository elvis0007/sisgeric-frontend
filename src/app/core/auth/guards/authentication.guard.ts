import {
  CanActivate,
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot
} from '@angular/router';
import { Injectable } from '@angular/core';
import { AuthenticationService } from '@core/auth/authentication.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationGuard implements CanActivate {
  constructor(
    private authenticationSrv: AuthenticationService,
    private router: Router,
    private auxiliarySrv: AuxiliaryService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const user = this.authenticationSrv.getUser;
    if (user) {
      // Verificar si la ruta tiene roles permitidos definidos
      const rolesPermitidos = route.data['roles'] as number[] | undefined;
      
      if (rolesPermitidos && rolesPermitidos.length > 0) {
        // Verificar si el usuario tiene al menos uno de los roles permitidos
        const tieneRolPermitido = this.auxiliarySrv.hasRole(rolesPermitidos);
        
        if (!tieneRolPermitido) {
          // Si no tiene el rol permitido, redirigir a la página de inicio
          this.router.navigate(['/inicio']);
          return false;
        }
      }
      
      return true;
    } else {
      return true;
    }
  }
}
