import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { catchError, Observable, throwError } from 'rxjs';
import { Auditoria } from '@shared/models/audit';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import {
  AprobarSolicitudWrite,
  Solicitud,
} from '@features/ai-rec-solicitudes/models/solicitud';
import { ResponseWrite } from '@shared/models/response-write';

@Injectable({
  providedIn: 'root',
})
export class SolicitudesAuditorService {
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
    anio: string
  ): Observable<ResponseReadMultiple<Solicitud>> {
    const aprobParcial = 2;
    const departTodos = 0;
    const codPerResp = 0;
    return this.http.get<ResponseReadMultiple<Solicitud>>(
      `${this.apiUrl}solicitudes/director?departamento=${departTodos}&arers_codigo_per=${codPerResp}&anio=${anio}&areso_estado_aprob=${aprobParcial}`
    );
  }

  getFilteredSolicitudesAud(
    departamento: string | 0,
    anio: string
  ): Observable<ResponseReadMultiple<Solicitud>> {
    const aprobParcial = 0;
    const departTodos = 0;
    return this.http.get<ResponseReadMultiple<Solicitud>>(
      `${this.apiUrl}solicitudes/auditor?departamento=${departamento}&anio=${anio}&areso_estado_aprob=${aprobParcial}`
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

  notificarCambioFecha(codRec: number): Observable<ResponseWrite> {
    const url: string = `${this.apiUrl}email/send-date-changed?arere_codigo=${codRec}`;
    const response = this.http.get<ResponseWrite>(url);
    return response;
  }

  getDepartamentos(): Observable<ResponseReadMultiple<string>> {
    return this.http.get<ResponseReadMultiple<string>>(
      `${this.apiUrl}responsables/departamentos`
    );
  }

  getDirectorByDepartamento(departamento: string | number): Observable<any> {
    const arers_codigo_per = 0;
    const anio = '';
    const areso_estado_aprob = 0;
    return this.http.get<any>(
      `${this.apiUrl}solicitudes/director?departamento=${departamento}&arers_codigo_per=${arers_codigo_per}&anio=${anio}&areso_estado_aprob=${areso_estado_aprob}`
    );
  }

  obtenerDirectorYNumeroSolicitud(codigoPer: string, departamento?: string): Observable<any> {
    let url = `${this.apiUrl}solicitudes/obtener-director/${codigoPer}`;
    if (departamento) {
      url += `?departamento=${encodeURIComponent(departamento)}`;
    }
    return this.http.get<any>(url).pipe(
      catchError((error) => {
        const errorMessage =
          error.error?.mensaje || error.message || 'Error al obtener director y número de solicitud';
        return throwError(() => errorMessage);
      })
    );
  }

  obtenerAuditorYNumeroSolicitud(arereCodeId: string | number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}solicitudes/obtener-auditor/${arereCodeId}`
    ).pipe(
      catchError((error) => {
        const errorMessage =
          error.error?.mensaje || error.message || 'Error al obtener auditor y número de solicitud';
        return throwError(() => errorMessage);
      })
    );
  }
}
