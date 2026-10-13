import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { Auditoria } from '@shared/models/audit';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import {
  AprobarSolicitudWrite,
  ListResponsable,
  Solicitud,
} from '@features/ai-director-departamental/models/solicitud';
import { UserRole } from '@features/ai-director-departamental/models/solicitud';
import { ResponseWrite } from '@shared/models/response-write';

@Injectable({
  providedIn: 'root',
})
export class SolicitudesDirectorService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private apiUrl: string = `${environment.url}`;
  private urlFtp: string = `${environment.url}archivo`;
  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };

  getFilteredSolicitudes(
    departDirect: string,
    codPerResp: string,
    anio: string
  ): Observable<ResponseReadMultiple<Solicitud>> {
    const estadoSolic = 0;
    return this.http.get<ResponseReadMultiple<Solicitud>>(
      `${this.apiUrl}solicitudes/director?departamento=${departDirect}&arers_codigo_per=${codPerResp}&anio=${anio}&areso_estado_aprob=${estadoSolic}`
    );
  }

  getFile(rutaArchivo: string): Observable<ResponseReadSimple<any>> {
    try {
      const response = this.http.get<ResponseReadSimple<any>>(this.urlFtp, {
        params: { ruta: rutaArchivo },
      });

      return response;
    } catch (error) {
      return new Observable();
    }
  }

  getResponsables(): Observable<ResponseReadSimple<ListResponsable>> {
    try {
      const role: UserRole = UserRole.RESPONSABLE;
      const response = this.http.get<ResponseReadSimple<ListResponsable>>(
        `${this.apiUrl}roles/usuario/${role}`
      );
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  aprobarSolicitud(
    solicitud: AprobarSolicitudWrite,
    areso_codigo: number
  ): Observable<ResponseWrite> {
    const urlAll = `${this.apiUrl}solicitudes/aprobar/${areso_codigo}`;
    const payload = {
      ...solicitud,
      auditoria: this.audit,
    };
    const response = this.http.put<ResponseWrite>(urlAll, payload).pipe(
      catchError((error) => {
        const errorMessage =
          error.error?.mensaje || error.message || 'Error desconocido';
        return throwError(() => errorMessage);
      })
    );
    return response;
  }
}
