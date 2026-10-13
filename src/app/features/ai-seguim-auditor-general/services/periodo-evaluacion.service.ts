import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import { Observable } from 'rxjs';
import { ResponseReadMultiple, ResponseReadSimple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { PeriodoEvaluacion, PeriodoInformeDetalle, CrearPeriodoDTO } from '../models/periodo-evaluacion.model';

@Injectable({
  providedIn: 'root',
})
export class PeriodoEvaluacionService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.url}periodos-evaluacion`;

  /**
   * Obtiene la lista de todos los periodos de evaluación (predeterminados y creados)
   */
  getPeriodos(anio?: number): Observable<ResponseReadMultiple<PeriodoEvaluacion>> {
    const params: { [param: string]: string } = {};
    if (anio !== undefined && anio !== null) {
      params['anio'] = anio.toString();
    }
    return this.http.get<ResponseReadMultiple<PeriodoEvaluacion>>(`${this.apiUrl}`, { params });
  }

  /**
   * Obtiene el detalle de un periodo específico por su ID
   */
  getPeriodoById(id: number): Observable<ResponseReadSimple<PeriodoEvaluacion>> {
    return this.http.get<ResponseReadSimple<PeriodoEvaluacion>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtiene la lista de informes asignados a un periodo de evaluación
   */
  getInformesPorPeriodo(periodoId: number): Observable<ResponseReadMultiple<PeriodoInformeDetalle>> {
    return this.http.get<ResponseReadMultiple<PeriodoInformeDetalle>>(`${this.apiUrl}/${periodoId}/informes`);
  }

  /**
   * Obtiene la lista de recomendaciones asignadas a un periodo con flag de inclusión
   */
  getRecomendacionesPorPeriodo(periodoId: number): Observable<ResponseReadMultiple<any>> {
    return this.http.get<ResponseReadMultiple<any>>(`${this.apiUrl}/${periodoId}/recomendaciones`);
  }

  /**
   * Obtiene la lista de responsables asignados a un periodo con flag de inclusión
   */
  getResponsablesPorPeriodo(periodoId: number): Observable<ResponseReadMultiple<any>> {
    return this.http.get<ResponseReadMultiple<any>>(`${this.apiUrl}/${periodoId}/responsables`);
  }

  /**
   * Crea un nuevo periodo de evaluación o corte especial
   */
  crearPeriodo(dto: CrearPeriodoDTO): Observable<ResponseWrite> {
    return this.http.post<ResponseWrite>(`${this.apiUrl}`, dto);
  }

  /**
   * Actualiza la lista de informes asignados a un periodo (Agregar / Quitar excepciones)
   */
  actualizarInformesPeriodo(periodoId: number, informesIds: number[]): Observable<ResponseWrite> {
    return this.http.put<ResponseWrite>(`${this.apiUrl}/${periodoId}/informes`, { informes_ids: informesIds });
  }

  /**
   * Congela el estado inmutable del periodo mediante la generación de Snapshot
   */
  generarSnapshot(periodoId: number): Observable<ResponseWrite> {
    return this.http.post<ResponseWrite>(`${this.apiUrl}/${periodoId}/generar-snapshot`, {});
  }

  /**
   * Actualiza la inclusión/exclusión granular de recomendaciones
   */
  actualizarRecomendacionesPeriodo(periodoId: number, incluidasIds: number[], excluidasIds: number[]): Observable<ResponseWrite> {
    return this.http.put<ResponseWrite>(`${this.apiUrl}/${periodoId}/recomendaciones`, {
      recomendaciones_incluidas_ids: incluidasIds,
      recomendaciones_excluidas_ids: excluidasIds
    });
  }

  /**
   * Actualiza la inclusión/exclusión granular de responsables
   */
  actualizarResponsablesPeriodo(periodoId: number, incluidasIds: number[], excluidasIds: number[]): Observable<ResponseWrite> {
    return this.http.put<ResponseWrite>(`${this.apiUrl}/${periodoId}/responsables`, {
      responsables_incluidos_ids: incluidasIds,
      responsables_excluidos_ids: excluidasIds
    });
  }

  /**
   * Elimina/Desactiva un periodo de evaluación
   */
  eliminarPeriodo(periodoId: number): Observable<ResponseWrite> {
    return this.http.delete<ResponseWrite>(`${this.apiUrl}/${periodoId}`);
  }
}
