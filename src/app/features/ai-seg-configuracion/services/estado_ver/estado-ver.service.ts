import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  EstadoVerificable,
  EstadoVerificableWrite,
} from '@features/ai-seg-configuracion/models/Estado-Ver';
import { Auditoria } from '@shared/models/audit';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EstadoVerService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private url: string = `${environment.url}estado-verificable`;
  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };

  getEstadoSeguimiento(): Observable<ResponseReadMultiple<EstadoVerificable>> {
    const response = this.http.get<ResponseReadMultiple<EstadoVerificable>>(
      this.url
    );
    return response;
  }

  registerEstadoSeguimiento(
    estadoSeg: EstadoVerificableWrite
  ): Observable<ResponseWrite> {
    const payload = {
      ...estadoSeg,
      auditoria: this.audit,
    };
    const response = this.http.post<ResponseWrite>(this.url, payload).pipe();
    return response;
  }

  editEstadoSeguimiento(
    estadosSeg: EstadoVerificableWrite
  ): Observable<ResponseWrite> {
    const payload = {
      ...estadosSeg,
      auditoria: this.audit,
    };
    const response = this.http
      .put<ResponseWrite>(`${this.url}/${estadosSeg.areev_codigo}`, payload)
      .pipe();
    return response;
  }

  deleteEstadoSeguimiento(
    estadoSeg: EstadoVerificable
  ): Observable<ResponseWrite> {
    const payload = {
      body: {
        auditoria: this.audit,
      },
    };
    const response = this.http
      .delete<ResponseWrite>(
        `${this.url}/eliminar/${estadoSeg.areev_codigo}`,
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
