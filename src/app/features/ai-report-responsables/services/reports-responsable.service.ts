import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { Observable, timeout, catchError, throwError } from 'rxjs';
import { ReportProgresoRecomendacion, ReportRecomResponsable, ReportRecomendacionesVencidasResponsable } from '../models/reports-responsable';
import { EstadoSeguimiento } from '@features/ai-seg-configuracion/models/Estado-Seg';

@Injectable({
  providedIn: 'root'
})
export class ReportsResponsableService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl: string = `${environment.url}`;

  getReportRecomResponsable(startDate: string, endDate: string, estadoSeg: number, user: string): Observable<ResponseReadMultiple<ReportRecomResponsable>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      estado_seguimiento: estadoSeg,
      usuario: user
    } 
    const url: string = `${this.apiUrl}reportes/responsable/reporte-recomendaciones-responsable`;
    return this.http.post<ResponseReadMultiple<ReportRecomResponsable>>(url, payload);
  }

  getReportProgresoRecomendacion(startDate: string, endDate: string, user: string): Observable<ResponseReadMultiple<ReportProgresoRecomendacion>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      usuario: user
    }
    const url: string = `${this.apiUrl}reportes/responsable/reporte-progreso-recomendaciones-responsable`;
    return this.http.post<ResponseReadMultiple<ReportProgresoRecomendacion>>(url, payload);
  }

  /**
   * Formatea una fecha en formato ISO (yyyy-MM-dd) a formato dd/MM/aaaa
   * @param isoDate Fecha en formato ISO (yyyy-MM-dd)
   * @returns Fecha formateada como dd/MM/aaaa
   */
  private formatDateToDDMMYYYY(isoDate: string): string {
    if (!isoDate) return '';
    
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    
    // Reordenar de yyyy-MM-dd a dd/MM/aaaa
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  getEstadoSeg(): Observable<ResponseReadMultiple<EstadoSeguimiento>> {
    const response = this.http.get<ResponseReadMultiple<EstadoSeguimiento>>(
      `${this.apiUrl}estado-seguimiento`
    );
    return response;
  }

  getReportRecomendacionesVencidasResponsable(startDate: string, endDate: string, estadoSeg: number, user: string): Observable<ResponseReadMultiple<ReportRecomendacionesVencidasResponsable>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      estado_seguimiento: estadoSeg,
      usuario: user
    }
    const url: string = `${this.apiUrl}reportes/responsable/reporte-recomendaciones-vencidas-responsable`;
    return this.http.post<ResponseReadMultiple<ReportRecomendacionesVencidasResponsable>>(url, payload).pipe(
      timeout(120000),
      catchError(error => {
        console.error('Error en getReportRecomendacionesVencidasResponsable:', error);
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
        }
        return throwError(() => error);
      })
    );
  }
}
