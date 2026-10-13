import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { Responsable } from '@features/ai-seguim-auditor-operativo/models/conclusion';
import {
  ConclusionRecomendaciones,
  Recomendacion,
  RecomendacionWrite,
  ResponsableView,
} from '@features/ai-seguim-auditor-operativo/models/recomendacion';
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
export class RecomendacionesService {
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
    id: number
  ): Observable<ResponseReadSimple<ConclusionRecomendaciones>> {
    const url: string = `${this.url}recomendaciones/conclusion/${id}`;
    const response =
      this.http.get<ResponseReadSimple<ConclusionRecomendaciones>>(url);
    return response;
  }

  getResponsables(
    id: number
  ): Observable<ResponseReadMultiple<ResponsableView>> {
    const url: string = `${this.url}responsables/recomendacion/${id}`;
    const response = this.http.get<ResponseReadMultiple<ResponsableView>>(url);
    return response;
  }

  actualizarRiesgo(id: number, riesgo: string | null, evidencia: string | null, evidencias?: { arer_codigo?: number | null; arer_descripcion: string }[]): Observable<ResponseWrite> {
    return this.http.put<ResponseWrite>(`${this.url}recomendaciones/${id}/riesgo`, {
      arere_riesgo_verificado: riesgo,
      arere_evidencia_requerida: evidencia,
      arere_evidencias_requeridas: evidencias,
      auditoria: this.audit,
    });
  }

  deleteRecomendacion(recomendacion: Recomendacion): Observable<ResponseWrite> {
    const urlAll: string = `${this.url}recomendaciones/${recomendacion.arere_codigo}`;
    const payload = {
      body: {
        auditoria: this.audit,
      },
    };
    const response = this.http.delete<ResponseWrite>(urlAll, payload).pipe(
      catchError((error) => {
        console.error('Error al registrar la conclusión', error);
        throw error;
      })
    );
    return response;
  }

  registerRecomendacion(
    recomendacion: RecomendacionWrite,
    areco_codigo: Number
  ): Observable<ResponseWrite> {
    const payload = {
      ...recomendacion,
      areco_codigo: areco_codigo,
      auditoria: this.audit,
    };
    const response = this.http
      .post<ResponseWrite>(`${this.url}recomendaciones`, payload)
      .pipe(
        catchError((error) => {
          throw error;
        })
      );
    return response;
  }

  editRecomendacion(
    recomendacion: RecomendacionWrite
  ): Observable<ResponseWrite> {
    const url: string = `${this.url}recomendaciones/${recomendacion.arere_codigo}`;
    const payload = {
      ...recomendacion,
      auditoria: this.audit,
    };
    const response = this.http.put<ResponseWrite>(url, payload).pipe(
      catchError((error) => {
        throw error;
      })
    );
    return response;
  }

  assignResponsables(
    responsables: Responsable[],
    numRec: string
  ): Observable<ResponseWrite> {
    const url: string = `${this.url}recomendaciones/asignar/responsables/${numRec}`;
    const payload = {
      responsables: Array.isArray(responsables) ? responsables : [responsables],
      auditoria: this.audit,
    };
    const response = this.http.put<ResponseWrite>(url, payload).pipe(
      catchError((error) => {
        throw error;
      })
    );
    return response;
  }

  replaceResponsable(
    codRec: number,
    codRespOld: number,
    responsable: Responsable
  ): Observable<ResponseWrite> {
    const url: string = `${this.url}recomendaciones/actualizar/responsable/detalle`;
    const payload = {
      arere_codigo: codRec,
      arers_codigo: codRespOld,
      responsable: responsable,
      auditoria: this.audit,
    };
    const response = this.http.put<ResponseWrite>(url, payload).pipe(
      catchError((error) => {
        throw error;
      })
    );
    return response;
  }

  deleteResponsable(codRec: number,codResp: number): Observable<ResponseWrite> {
    const url: string = `${this.url}recomendaciones/eliminar/responsable/detalle/${codRec}/${codResp}`;
    const payload = {
      auditoria: this.audit,
    };
    const response = this.http.delete<ResponseWrite>(url, {
      body: payload,
    }).pipe(
      catchError((error) => {
        throw error;
      })
    );
    return response;
  }

  notificarCambioFecha(codRec: number, codResp?: number | null): Observable<ResponseWrite> {
    let url: string = `${this.url}email/send-date-changed?arere_codigo=${codRec}`;
    if (codResp) {
      url += `&arers_codigo=${codResp}`;
    }
    const response = this.http.get<ResponseWrite>(url);
    return response;
  }
}
