import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  EstadoSeg,
  RecomendacionInforme,
} from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { ListaAuditorOp } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { Observable, tap } from 'rxjs';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';

@Injectable({
  providedIn: 'root',
})
export class RecomendacionesService {
  private readonly http: HttpClient = inject(HttpClient);

  private url: string = `${environment.url}`;
  private currentData: RecomendacionInforme[] | null = null;

  getCurrentData(): RecomendacionInforme[] | null {
    return this.currentData;
  }

  getFilteredRecomendaciones(
    arees_estado_seg: number,
    arers_departamento: string,
    currentYear: number,
    auditor: string
  ): Observable<ResponseReadMultiple<RecomendacionInforme>> {
    const urlAll = `${this.url}recomendaciones/auditor?arees_estado_seg=${arees_estado_seg}&current_year=${currentYear}&arers_departamento=${arers_departamento}&auditor=${auditor}`;
    const response = this.http
      .get<ResponseReadMultiple<RecomendacionInforme>>(urlAll)
      .pipe(
        tap((response) => {
          this.currentData = response.datos;
        })
      );
    return response;
  }

  getAuditores(): Observable<ResponseReadSimple<ListaAuditorOp>> {
    const roleAuditorOp = 3;
    const response = this.http.get<ResponseReadSimple<ListaAuditorOp>>(
      `${this.url}roles/usuario/${roleAuditorOp}`
    );
    return response;
  }

  getAuditoresJefe(): Observable<ResponseReadSimple<ListaAuditorOp>> {
    const roleAuditorJefe = 2;
    const response = this.http.get<ResponseReadSimple<ListaAuditorOp>>(
      `${this.url}roles/usuario/${roleAuditorJefe}`
    );
    return response;
  }

  getEstadoSeg(): Observable<ResponseReadMultiple<EstadoSeg>> {
    const response = this.http.get<ResponseReadMultiple<EstadoSeg>>(
      `${this.url}estado-seguimiento`
    );
    return response;
  }

  getDepartamentos(): Observable<ResponseReadMultiple<string>> {
    return this.http.get<ResponseReadMultiple<string>>(
      `${this.url}responsables/departamentos`
    );
  }

  getOrganismos(): Observable<any> {
    return this.http.get<any>(
      `${this.url}organismos`
    );
  }

  getHistorialRecomendacion(id: number): Observable<any> {
    return this.http.get<any>(`${this.url}recomendaciones/${id}/historial`);
  }

  getRecomendacionDetail(id: number): Observable<any> {
    return this.http.get<any>(`${this.url}recomendaciones/detalle/${id}`);
  }

  getResponsables(id: number): Observable<ResponseReadMultiple<any>> {
    return this.http.get<ResponseReadMultiple<any>>(
      `${this.url}responsables/recomendacion/${id}`
    );
  }
}
