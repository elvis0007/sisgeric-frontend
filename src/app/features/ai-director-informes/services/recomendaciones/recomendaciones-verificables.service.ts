import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { ResponsableView } from '@features/ai-seguim-auditor-operativo/models/recomendacion';
import {
  DetalleRecomendacion,
  InformeRecomendacion,
  RecomendacionFechaWrite,
} from '@features/ai-rec-verificables/models/Recomendacion';
import { Auditoria } from '@shared/models/audit';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RecomendacionesVerificablesService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly host: string = this.auxiliarySrv.getHost();
  private readonly usuario: string = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.usuario,
  };
  private url: string = `${environment.url}`;

  getRecomendaciones(
    id: number,
    dpto: string
  ): Observable<ResponseReadSimple<InformeRecomendacion>> {
    const urlAll: string = `${this.url}recomendaciones/informe?ainin_codigo=${id}&departamento=${dpto}`;
    const response =
      this.http.get<ResponseReadSimple<InformeRecomendacion>>(urlAll);
    return response;
  }


  getResponsables(
    id: number
  ): Observable<ResponseReadMultiple<ResponsableView>> {
    const urlAll: string = `${this.url}responsables/recomendacion/${id}`;
    const response =
      this.http.get<ResponseReadMultiple<ResponsableView>>(urlAll);
    return response;
  }

  updateFechaMaxRec(
    arere_codigo: number,
    recomendacionWrite: RecomendacionFechaWrite
  ): Observable<ResponseWrite> {
    const payload = {
      ...recomendacionWrite,
      auditoria: this.audit,
    };

    const urlAll = `${this.url}recomendaciones/fecha-maxima/${arere_codigo}`;
    const response = this.http.put<ResponseWrite>(urlAll, payload).pipe(
      catchError((error) => {
        console.error('Error al validar verificable:', error);
        throw error;
      })
    );
    return response;
  }

  getDetalleRecomendacion(
    arere_codigo: number
  ): Observable<ResponseReadSimple<DetalleRecomendacion>> {
    const urlAll = `${this.url}recomendaciones/detalle/${arere_codigo}`;
    const response =
      this.http.get<ResponseReadSimple<DetalleRecomendacion>>(urlAll);
    return response;
  }
}
