import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  OrganismoControl,
  OrganismoControlWrite,
} from '@features/ai-seg-configuracion/models/Organismo-Control';
import { Auditoria } from '@shared/models/audit';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OrganismoControlService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private url: string = `${environment.url}organismos`;
  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };

  getOrganismos(): Observable<ResponseReadMultiple<OrganismoControl>> {
    const response = this.http.get<ResponseReadMultiple<OrganismoControl>>(
      this.url
    );
    return response;
  }

  registerOrganismo(
    organismo: OrganismoControlWrite
  ): Observable<ResponseWrite> {
    const payload = {
      ...organismo,
      auditoria: this.audit,
    };
    const response = this.http.post<ResponseWrite>(this.url, payload).pipe();
    return response;
  }

  editOrganismo(organismo: OrganismoControlWrite): Observable<ResponseWrite> {
    const payload = {
      ...organismo,
      auditoria: this.audit,
    };
    const response = this.http
      .put<ResponseWrite>(`${this.url}/${organismo.ainoc_codigo}`, payload)
      .pipe();
    return response;
  }

  deleteOrganismo(organismo: OrganismoControl): Observable<ResponseWrite> {
    const payload = {
      body: {
        auditoria: this.audit,
      },
    };
    const response = this.http
      .delete<ResponseWrite>(`${this.url}/eliminar/${organismo.ainoc_codigo}`, payload)
      .pipe(
        catchError((error) => {
          console.error('Error al editar hallazgo:', error);
          throw error;
        })
      );
    return response;
  }
}
