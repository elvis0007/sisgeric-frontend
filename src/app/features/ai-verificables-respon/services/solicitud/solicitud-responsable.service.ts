import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { Solicitud, SolicitudDetalle } from '@features/ai-verificables-respon/models/solicitud_rec';
import { Auditoria } from '@shared/models/audit';
import { ResponseReadMultiple, ResponseReadSimple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable, throwError } from 'rxjs';

interface AltaSolicitudResponse {
  codigo: number;
  mensaje: string;
  datos?: {
    numeroSolicitud?: string | number;
    aresoCodigo?: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SolicitudResponsableService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly host: string = this.auxiliarySrv.getHost();
  private readonly usuario: string = this.auxiliarySrv.getUserCuenta();
  private urlFtp: string = `${environment.url}archivo`;
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.usuario,
  };
  private url: string = `${environment.url}`;

  updateFechaMax(solicitud: FormData): Observable<AltaSolicitudResponse> {
    solicitud.append('auditoria', JSON.stringify(this.audit));
    const urlAll = `${this.url}solicitudes`;
    const response = this.http.post<AltaSolicitudResponse>(urlAll, solicitud).pipe(
      catchError((error: any) => {
        const errorMessage =
          error.error?.mensaje || error.message || 'Error desconocido';
        return throwError(() => errorMessage);
      })
    );
    return response;
  }

  getSolicitudes(
    arere_codigo: number,
    codigo_per: string
  ): Observable<ResponseReadMultiple<Solicitud>> {
    const urlAll = `${this.url}solicitudes/responsable/${arere_codigo}/${codigo_per}`;
    const response = this.http
      .get<ResponseReadMultiple<Solicitud>>(urlAll)
      .pipe(
        catchError((error) => {
          const errorMessage =
            error.error?.mensaje || error.message || 'Error desconocido';
          return throwError(() => errorMessage);
        })
      );
    return response;
  }

  deleteSolicitud(areso_codigo: number): Observable<ResponseWrite> {
    const urlAll = `${this.url}solicitudes/${areso_codigo}`;
    return this.http.delete<ResponseWrite>(urlAll).pipe(
      catchError((error: any) => {
        const errorMessage =
          error.error?.mensaje || error.message || 'Error desconocido';
        return throwError(() => errorMessage);
      })
    );
  }

  getSolicitudDetalle(areso_codigo: number): Observable<ResponseReadSimple<SolicitudDetalle>> {
    const urlAll = `${this.url}solicitudes/detalle/${areso_codigo}`;
    return this.http.get<ResponseReadSimple<SolicitudDetalle>>(urlAll).pipe(
      catchError((error) => {
        const errorMessage =
          error.error?.mensaje || error.message || 'Error desconocido';
        return throwError(() => errorMessage);
      })
    );
  }
}
