import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { ReportEstadoSeguimiento, ReportEstadoSeguimientoDetalle, ReportRecomendacionesVencidasOperativo, ReportSeguimientoResponsable } from '@features/ai-report-auditor-operativo/models/reports-auditor-oper';
import { ReportGeneralAIJ } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { Observable, timeout, catchError, throwError } from 'rxjs';
import { EstadoSeguimiento } from '@features/ai-seg-configuracion/models/Estado-Seg';
import {
  OrganismoControl
} from '@features/ai-seg-configuracion/models/Organismo-Control';

@Injectable({
  providedIn: 'root'
})
export class ReportsAuditorOperService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl: string = `${environment.url}`;

  getReportByEstadoSeg(startDate: string, endDate: string, dpto: string, estadoSeg: number, user: string): Observable<ResponseReadMultiple<ReportEstadoSeguimiento>>  {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      dpto: dpto,
      estado_seguimiento: estadoSeg,
      auditor_responsable: user
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-operativo/reporte-por-departamento-estado-seguimiento`;
    return this.http.post<ResponseReadMultiple<ReportEstadoSeguimiento>>(url, payload).pipe(
      timeout(120000),
      catchError(error => {
        console.error('Error en getReportByEstadoSeg:', error);
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
        }
        return throwError(() => error);
      })
    );
  }

  getReportByEstadoSegDetalle(startDate: string, endDate: string, user: string, organismoControl: number): Observable<ResponseReadMultiple<ReportEstadoSeguimientoDetalle>> {
    const payload = { 
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      auditor_responsable: user,
      org_control: organismoControl
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-operativo/reporte-recomendaciones-progreso`;
    return this.http.post<ResponseReadMultiple<ReportEstadoSeguimientoDetalle>>(url, payload);
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

  getDepartamentos(): Observable<ResponseReadMultiple<string>> {
    return this.http.get<ResponseReadMultiple<string>>(
      `${this.apiUrl}responsables/departamentos`
    );
  }

  getOrganismos(): Observable<ResponseReadMultiple<OrganismoControl>> {
    const response = this.http.get<ResponseReadMultiple<OrganismoControl>>(
      `${this.apiUrl}organismos`
    );
    return response;
  }

  getReportRecomendacionesVencidasOperativo(startDate: string, endDate: string, estadoSeg: number, user: string): Observable<ResponseReadMultiple<ReportRecomendacionesVencidasOperativo>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      estado_seguimiento: estadoSeg,
      auditor_responsable: user
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-operativo/reporte-recomendaciones-vencidas-operativo`;
    return this.http.post<ResponseReadMultiple<ReportRecomendacionesVencidasOperativo>>(url, payload).pipe(
      timeout(120000),
      catchError(error => {
        console.error('Error en getReportRecomendacionesVencidasOperativo:', error);
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
        }
        return throwError(() => error);
      })
    );
  }

  getReportSeguimientoPorResponsable(
    startDate: string,
    endDate: string,
    orgCtrl: number,
    estadoSeg: number,
    auditor: string,
    dpto: string
  ): Observable<ResponseReadMultiple<ReportSeguimientoResponsable>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      organismo_control: orgCtrl,
      estado_seguimiento: estadoSeg,
      auditor: auditor,
      dpto: dpto
    };
    const url: string = `${this.apiUrl}reportes/auditor-interno-operativo/reporte-seguimiento-responsable`;
    return this.http.post<ResponseReadMultiple<ReportSeguimientoResponsable>>(url, payload).pipe(
      timeout(120000),
      catchError(error => {
        console.error('Error en getReportSeguimientoPorResponsable:', error);
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
        }
        return throwError(() => error);
      })
    );
  }

  getReportPlanesEvidenciasAO(
    startDate: string,
    endDate: string,
    orgCtrl: number,
    estadoSeg: number,
    auditor: string,
    dpto: string
  ): Observable<ResponseReadMultiple<ReportGeneralAIJ>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      organismo_control: orgCtrl,
      estado_seguimiento: estadoSeg,
      auditor: auditor,
      dpto: dpto
    };
    const url: string = `${this.apiUrl}reportes/auditor-interno-operativo/reporte-planes-evidencias-operativo`;
    return this.http.post<ResponseReadMultiple<ReportGeneralAIJ>>(url, payload).pipe(
      timeout(120000),
      catchError(error => {
        console.error('Error en getReportPlanesEvidenciasAO:', error);
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
        }
        return throwError(() => error);
      })
    );
  }
}
