import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import { ResponseReadSimple } from '@shared/models/response-read';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { RolUsuario, RolUsuarioEscritura, RolUsuarioActualizacion } from '@features/ai-seg-role-user/models/role-user';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Auditoria } from '@shared/models/audit';
import { UsuarioAsignadoRol } from '@features/ai-seg-role-user/models/user';

@Injectable({
  providedIn: 'root',
})
export class RoleUserService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private url: string = `${environment.url}roles/usuario/`;
  private readonly host: string = this.auxiliarySrv.getHost();
  private readonly usuario: string = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.usuario,
  };

  private updateDataSubject = new BehaviorSubject<void>(undefined);
  updateData = this.updateDataSubject.asObservable();

  constructor() {}

  getRolesUsers(id: number): Observable<ResponseReadSimple<RolUsuario>> {
    const urlGet: string = `${this.url}${id}`;
    const response = this.http.get<ResponseReadSimple<RolUsuario>>(urlGet);
    return response;
  }

  assignRoleUser(codeRole: number, codPer: string, user: string, email: string): Observable<ResponseWrite> {
    const roleUser: RolUsuarioEscritura = {
      codigo_per: codPer,
      rol: codeRole,
      aseru_cuenta: user,
      email: email,
      auditoria: this.audit,
    };

    const response = this.http.post<ResponseWrite>(this.url, roleUser).pipe(
      tap(() => {
        this.updateDataSubject.next();
      })
    );
    return response;
  }

  deleteRoleUser(user: UsuarioAsignadoRol): Observable<ResponseWrite> {
    const urlDelete: string = `${this.url}eliminar/${user.aseru_codigo}`;
    const options = {
      body: {
        auditoria: this.audit,
      },
    };

    const response = this.http.delete<ResponseWrite>(urlDelete, options).pipe(
      tap(() => {
        this.updateDataSubject.next();
      })
    );

    return response;
  }
  verifyRoleUser(dsgus_cuenta: string, aseru_num_rol: string): Observable<any> {
    const params = new HttpParams()
      .set('dsgus_cuenta', dsgus_cuenta)
      .set('aseru_num_rol', aseru_num_rol);
    const urlVerify: string = `${this.url}verificar-rol`;
    const response = this.http.get<any>(urlVerify, { params });
    return response;
  }

  actualizarUsuario(aseru_codigo: number, roleUser: Omit<RolUsuarioActualizacion, 'aseru_codigo'>): Observable<ResponseWrite> {
    const urlUpdate: string = `${this.url}${aseru_codigo}`;
    const response = this.http.put<ResponseWrite>(urlUpdate, roleUser).pipe(
      tap(() => {
        this.updateDataSubject.next();
      })
    );
    return response;
  }

  obtenerUsuarioPorId(aseru_codigo: number): Observable<ResponseReadSimple<UsuarioAsignadoRol>> {
    const urlGet: string = `${this.url}usuario/${aseru_codigo}`;
    const response = this.http.get<ResponseReadSimple<UsuarioAsignadoRol>>(urlGet);
    return response;
  }
}
