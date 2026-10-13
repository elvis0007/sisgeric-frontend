import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  TipoInforme,
  TipoInformeWrite,
} from '@features/ai-seg-configuracion/models/Tipo-Informe';
import { Auditoria } from '@shared/models/audit';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TipoInformeService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private url: string = `${environment.url}tipoInf`;
  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };

  getTiposInformes(): Observable<ResponseReadMultiple<TipoInforme>> {
    const response = this.http.get<ResponseReadMultiple<TipoInforme>>(this.url);
    return response;
  }

  registerTipoInforme(tipoInforme: TipoInformeWrite): Observable<ResponseWrite> {
    const payload = {
      ...tipoInforme,
      auditoria: this.audit,
    };
    const response = this.http.post<ResponseWrite>(this.url, payload).pipe();
    return response;
  }

  editTipoInforme(tipoInforme: TipoInformeWrite): Observable<ResponseWrite> {
    const payload = {
      ...tipoInforme,
      auditoria: this.audit,
    };
    const response = this.http
      .put<ResponseWrite>(`${this.url}/${tipoInforme.ainti_codigo}`, payload)
      .pipe();
    return response;
  }

  deleteTipoInforme(tipoInforme: TipoInforme): Observable<ResponseWrite> {
    const payload = {
      body: {
        auditoria: this.audit,
      },
    };
    const response = this.http
      .delete<ResponseWrite>(
        `${this.url}/eliminar/${tipoInforme.ainti_codigo}`,
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
