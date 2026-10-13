import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import { Rol, RolEscritura } from '@features/ai-seg-role/models/role';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Auditoria } from '@shared/models/audit';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private url: string = `${environment.url}roles`;
  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };

  private updateDataSubject = new BehaviorSubject<void>(undefined);
  updateData = this.updateDataSubject.asObservable();

  constructor() {}

  getRoles(): Observable<ResponseReadMultiple<Rol>> {
    const response = this.http.get<ResponseReadMultiple<Rol>>(this.url);
    return response;
  }

  createRole(role: Rol): Observable<ResponseWrite> {
    const roleWriting: RolEscritura = {
      asero_descripcion: role.asero_descripcion,
      auditoria: this.audit,
    };

    const response = this.http.post<ResponseWrite>(this.url, roleWriting).pipe(
      tap(() => {
        this.updateDataSubject.next();
      })
    );
    return response;
  }

  editRole(role: Rol): Observable<ResponseWrite> {
    const roleWriting: RolEscritura = {
      asero_descripcion: role.asero_descripcion,
      auditoria: this.audit,
    };

    const response = this.http
      .put<ResponseWrite>(`${this.url}/${role.asero_codigo}`, roleWriting)
      .pipe(
        tap(() => {
          this.updateDataSubject.next();
        })
      );

    return response;
  }
}
