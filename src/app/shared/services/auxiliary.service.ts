import { inject, Injectable } from '@angular/core';
import { ObjectEncryptor } from '@shared/utils/object-encryptor';
import { User } from '@core/auth/models/authentication';

@Injectable({
  providedIn: 'root',
})
export class AuxiliaryService {
  private readonly encryptor: ObjectEncryptor = inject(ObjectEncryptor);

  private user: User | null = null;

  constructor() {
    this.initUser();
  }

  private initUser(): void {
    try {
      this.user = this.getUserInfo();
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
      this.user = null;
    }
  }

  getHost(): string {
    const host: any = window.location.host;

    return host;
  }

  getUserCuenta(): string {
    if (!this.user) {
      this.initUser();
    }
    return this.user?.dsgus_cuenta || '';
  }

  getUserInfo(): User { 
    const objectEncrypted: any = localStorage.getItem('SEG_SE_USUARIO_AUDITORIA');
    if (!objectEncrypted) {
      return null as any;
    }
    
    try {
      const objectDecrypted = JSON.parse(
        this.encryptor.decryptObject(objectEncrypted)
      );
      return objectDecrypted;
    } catch (error) {
      console.error('Error al desencriptar información del usuario:', error);
      return null as any;
    }
  }

  saveUrlParameter(parameterUrl: string, nameParam: string): void {
    localStorage.removeItem(nameParam);
    localStorage.setItem(nameParam, parameterUrl);
  }

  getUrlParameter(nameParam: string): number {
    const parameterUrl: number = +atob(localStorage.getItem(nameParam)!);

    return parameterUrl;
  }

  hasRole(roleIds: number[]): boolean {
    if (!this.user) {
      this.initUser();
    }
    
    // Si después de intentar inicializar, el usuario sigue siendo nulo o no tiene roles
    if (!this.user || !this.user.roles || !Array.isArray(this.user.roles)) {
      return false;
    }
    
    // Verifica si el usuario tiene al menos uno de los roles especificados
    return this.user.roles.some((role: any) => {
      const roleCode = this.getRoleCode(role);
      if (roleCode !== null && roleIds.includes(roleCode)) {
        return true;
      }

      // Extraer descripción textual si role es string o un objeto
      let desc = '';
      if (typeof role === 'string') {
        desc = role.toUpperCase();
      } else if (role && typeof role === 'object') {
        desc = String(
          role.asero_descripcion || role.dsgrol_descripcion || role.nombre || role.descripcion || ''
        ).toUpperCase();
      }

      if (desc) {
        if (roleIds.includes(1) && (desc.includes('ADMIN') || desc.includes('ADMINISTRADOR'))) return true;
        if (roleIds.includes(2) && (desc.includes('AUDITOR INTERNO JEFE') || desc.includes('AUDITOR JEFE') || desc.includes('JEFE'))) return true;
        if (roleIds.includes(5) && (desc.includes('DIRECTOR DEPARTAMENTAL') || desc.includes('DIRECTOR'))) return true;
        if (roleIds.includes(4) && desc.includes('RESPONSABLE')) return true;
        if (roleIds.includes(3) && desc.includes('AUDITOR OPERATIVO')) return true;
      }

      return false;
    });
  }

  private getRoleCode(role: unknown): number | null {
    if (role === null || role === undefined) {
      return null;
    }

    if (typeof role === 'number') {
      return Number.isNaN(role) ? null : role;
    }

    if (typeof role === 'string') {
      const parsedRole = Number(role);
      return Number.isNaN(parsedRole) ? null : parsedRole;
    }

    if (typeof role === 'object') {
      const roleObject = role as { asero_codigo?: unknown; codigo?: unknown };
      const rawCode = roleObject.asero_codigo ?? roleObject.codigo;

      if (typeof rawCode === 'number') {
        return Number.isNaN(rawCode) ? null : rawCode;
      }

      if (typeof rawCode === 'string') {
        const parsedRole = Number(rawCode);
        return Number.isNaN(parsedRole) ? null : parsedRole;
      }
    }

    return null;
  }
}
