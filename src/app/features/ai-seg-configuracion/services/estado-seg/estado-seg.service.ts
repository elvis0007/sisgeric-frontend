import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  EstadoSeguimiento,
  EstadoSegumientoWrite,
} from '@features/ai-seg-configuracion/models/Estado-Seg';
import { Auditoria } from '@shared/models/audit';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EstadoSegService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private url: string = `${environment.url}estado-seguimiento`;
  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };

  getEstadoSeguimiento(): Observable<ResponseReadMultiple<EstadoSeguimiento>> {
    const response = this.http.get<ResponseReadMultiple<EstadoSeguimiento>>(
      this.url
    );
    return response;
  }

  registerEstadoSeguimiento(
    estadoSeg: EstadoSegumientoWrite
  ): Observable<ResponseWrite> {
    const payload = {
      ...estadoSeg,
      auditoria: this.audit,
    };
    const response = this.http.post<ResponseWrite>(this.url, payload).pipe();
    return response;
  }

  editEstadoSeguimiento(
    estadosSeg: EstadoSegumientoWrite
  ): Observable<ResponseWrite> {
    const payload = {
      ...estadosSeg,
      auditoria: this.audit,
    };
    const response = this.http
      .put<ResponseWrite>(`${this.url}/${estadosSeg.arees_codigo}`, payload)
      .pipe();
    return response;
  }

  deleteEstadoSeguimiento(
    estadoSeg: EstadoSeguimiento
  ): Observable<ResponseWrite> {
    const payload = {
      body: {
        auditoria: this.audit,
      },
    };
    const response = this.http
      .delete<ResponseWrite>(
        `${this.url}/eliminar/${estadoSeg.arees_codigo}`,
        payload
      )
      .pipe(
        catchError((error) => {
          throw error;
        })
      );
    return response;
  }
}
