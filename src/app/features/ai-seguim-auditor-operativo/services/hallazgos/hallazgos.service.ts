import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import { inject, Injectable } from '@angular/core';
import { Auditoria } from '@shared/models/audit';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable } from 'rxjs';
import { ResponseReadSimple } from '@shared/models/response-read';
import { HallazgoEscritura, InformeHallazgos } from '@features/ai-seguim-auditor-operativo/models/hallazgo';
import { ResponseWrite } from '@shared/models/response-write';

@Injectable({
  providedIn: 'root',
})
export class HallazgosService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly host: string = this.auxiliarySrv.getHost();
  private readonly usuario: string = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.usuario,
  };
  private apiUrl: string = `${environment.url}`;

  constructor() {}

  getHallazgos(id: number, termino?: string): Observable<ResponseReadSimple<InformeHallazgos>> {
    let url: string = `${this.apiUrl}hallazgos/informe/${id}`;
    if (termino && termino.trim()) {
      url += `?termino=${encodeURIComponent(termino)}`;
    }
    const response = this.http.get<ResponseReadSimple<InformeHallazgos>>(url);
    return response;
  }

  createHallazgo(hallazgo: HallazgoEscritura): Observable<ResponseWrite> {
    const payload = {
      ...hallazgo,
      auditoria: this.audit,
    };

    return this.http
      .post<ResponseWrite>(`${this.apiUrl}hallazgos`, payload)
      .pipe(
        catchError((error) => {
          console.error('Error al crear hallazgo:', error);
          throw error;
        })
      );
  }

  editHallazgo(hallazgo: HallazgoEscritura): Observable<ResponseWrite> {
    const payload = {
      ...hallazgo,
      auditoria: this.audit,
    };
    const urlAll = `${this.apiUrl}hallazgos/${hallazgo.areha_codigo}`;
    const response = this.http.put<ResponseWrite>(urlAll, payload).pipe(
      catchError((error) => {
        console.error('Error al editar hallazgo:', error);
        throw error;
      })
    );
    return response;
  }

  deleteHallazgo(hallazgo: HallazgoEscritura): Observable<ResponseWrite> {
    const payload = {
      body: {
        auditoria: this.audit,
      },
    };
    const urlAll: string = `${this.apiUrl}hallazgos/${hallazgo.areha_codigo}`;
    const response = this.http.delete<ResponseWrite>(urlAll, payload).pipe(
      catchError((error) => {
        console.error('Error al eliminar el hallazgo : ', error);
        throw error;
      })
    );
    return response;
  }
}
