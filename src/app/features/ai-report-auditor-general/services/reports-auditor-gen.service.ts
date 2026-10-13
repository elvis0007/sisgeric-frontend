import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { ResponseReadMultiple, ResponseReadSimple } from '@shared/models/response-read';
import { Observable, timeout, catchError, throwError } from 'rxjs';
import { ReportEstadoSeguimiento, ReportDirectorio, ReportOrgCtrlConteoEstados, ReportDptoConteoEstados, ReportTipoInforme, ReportRecomendacionesDepartamento, ReportHallazgos, ReporteRecomendacionesFechaCorte, ReportRecomendacionesVencidasAIJ, Report7Auditores, ReportGeneralAIJ, ReporteProrrogasAIJ, ReporteProrrogasRealizadasAIJ } from '../models/reports-auditor-gen';
import { ListaAuditorOp } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import {
  OrganismoControl
} from '@features/ai-seg-configuracion/models/Organismo-Control';

@Injectable({
  providedIn: 'root'
})
export class ReportsAuditorGenService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl: string = `${environment.url}`;

  getReportByEstadoSeg(startDate: string, endDate: string, estadoSeg: number, auditor_responsable: string): Observable<ResponseReadMultiple<ReportEstadoSeguimiento>> {
    const payload = {
      fechaInicio: this.formatDateToDDMMYYYY(startDate),
      fechaFin: this.formatDateToDDMMYYYY(endDate),
      estadoSeguimiento: estadoSeg,
      auditor_responsable: auditor_responsable
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte2-directorio-recomendaciones-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportEstadoSeguimiento>>(url, payload);
  }

  getReportDirectorio(startDate: string, endDate: string, dpto: string, orgCtrl: number, estadoSeg: number, auditor: string): Observable<ResponseReadMultiple<ReportDirectorio>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      dpto: dpto,
      org_control: orgCtrl,
      estado_seguimiento: estadoSeg,
      auditor: auditor
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte3-recomendaciones-directorio-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportDirectorio>>(url, payload);
  }

  getReportOrgCtrlConteoEstados(startDate: string, endDate: string): Observable<ResponseReadMultiple<ReportOrgCtrlConteoEstados>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate)
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte4-conteo-recomendaciones-estado-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportOrgCtrlConteoEstados>>(url, payload);
  }

  getReportDptoConteoEstados(startDate: string, endDate: string, dpto: string, orgCtrl: number): Observable<ResponseReadMultiple<ReportDptoConteoEstados>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      dpto: dpto,
      org_control: orgCtrl
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte5-conteo-recomendaciones-departamento-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportDptoConteoEstados>>(url, payload);
  }

  getReportbyTipoInforme(startDate: string, endDate: string, tipoInforme: number): Observable<ResponseReadMultiple<ReportTipoInforme>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      tipo_informe: tipoInforme
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte-por-tipo-informe-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportTipoInforme>>(url, payload);
  }

  getReportPorDepartamento(startDate: string, endDate: string, orgCtrl: number, estadoSeg: number): Observable<ResponseReadMultiple<ReportRecomendacionesDepartamento>> {
    const payload = {
      fechaInicio: this.formatDateToDDMMYYYY(startDate),
      fechaFin: this.formatDateToDDMMYYYY(endDate),
      organismoControl: orgCtrl,
      estadoSeguimiento: estadoSeg
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte1-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportRecomendacionesDepartamento>>(url, payload);
  }

  getReportHallazgos(startDate: string, endDate: string, orgCtrl: number, auditor: string): Observable<ResponseReadMultiple<ReportHallazgos>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      organismo_control: orgCtrl,
      auditor: auditor
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte-hallazgos-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportHallazgos>>(url, payload);
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

  getAuditores(): Observable<ResponseReadSimple<ListaAuditorOp>> {
    try {
      const roleAuditorOp = 3;
      const response = this.http.get<ResponseReadSimple<ListaAuditorOp>>(
        `${this.apiUrl}roles/usuario/${roleAuditorOp}`
      );
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  getEstadoSeg(): Observable<ResponseReadMultiple<EstadoSeg>> {
    const response = this.http.get<ResponseReadMultiple<EstadoSeg>>(
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

  getReportFechaCorte(fechaCorteEmision: string, dpto: string, orgCtrl: number, fechaCorteEstado?: string): Observable<ResponseReadMultiple<ReporteRecomendacionesFechaCorte>> {
    const payload = {
      fecha_corte: fechaCorteEstado || fechaCorteEmision,
      fecha_corte_emision: fechaCorteEmision,
      fecha_corte_estado: fechaCorteEstado || fechaCorteEmision,
      dpto: dpto,
      org_control: orgCtrl
    };
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte-recomendaciones-fecha-corte-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReporteRecomendacionesFechaCorte>>(url, payload);
  }

  getReportRecomendacionesVencidasAIJ(startDate: string, endDate: string, estadoSeg: number): Observable<ResponseReadMultiple<ReportRecomendacionesVencidasAIJ>> {
    const payload = {
      fechaInicio: this.formatDateToDDMMYYYY(startDate),
      fechaFin: this.formatDateToDDMMYYYY(endDate),
      estadoSeguimiento: estadoSeg
    }
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte-recomendaciones-vencidas-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportRecomendacionesVencidasAIJ>>(url, payload)
      .pipe(
        timeout(120000), // 2 minutos de timeout
        catchError(error => {
          console.error('Error en getReportRecomendacionesVencidasAIJ:', error);
          if (error.name === 'TimeoutError') {
            return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
          }
          return throwError(() => error);
        })
      );
  }

  getReport7Auditores(startDate: string, endDate: string, auditor: string): Observable<ResponseReadMultiple<Report7Auditores>> {
    const payload = {
      fechaInicio: this.formatDateToDDMMYYYY(startDate),
      fechaFin: this.formatDateToDDMMYYYY(endDate),
      auditor: auditor
    };
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte7-auditores-ai-jefe`;
    return this.http.post<ResponseReadMultiple<Report7Auditores>>(url, payload)
      .pipe(
        timeout(120000),
        catchError(error => {
          console.error('Error en getReport7Auditores:', error);
          if (error.name === 'TimeoutError') {
            return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
          }
          return throwError(() => error);
        })
      );
  }

  getReportGeneralAIJ(startDate: string, endDate: string, orgCtrl: number, estadoSeg: number, auditor: string, dpto: string): Observable<ResponseReadMultiple<ReportGeneralAIJ>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      organismo_control: orgCtrl,
      estado_seguimiento: estadoSeg,
      auditor: auditor,
      dpto: dpto
    };
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte-general-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportGeneralAIJ>>(url, payload)
      .pipe(
        timeout(120000),
        catchError(error => {
          console.error('Error en getReportGeneralAIJ:', error);
          if (error.name === 'TimeoutError') {
            return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
          }
          return throwError(() => error);
        })
      );
  }

  getReportProrrogasAIJ(): Observable<ResponseReadMultiple<ReporteProrrogasAIJ>> {
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte-prorrogas-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReporteProrrogasAIJ>>(url, {})
      .pipe(
        timeout(120000),
        catchError(error => {
          console.error('Error en getReportProrrogasAIJ:', error);
          if (error.name === 'TimeoutError') {
            return throwError(() => new Error('La consulta está tardando demasiado.'));
          }
          return throwError(() => error);
        })
      );
  }

  getReportProrrogasRealizadas(): Observable<ResponseReadMultiple<ReporteProrrogasRealizadasAIJ>> {
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte-prorrogas-realizadas`;
    return this.http.post<ResponseReadMultiple<ReporteProrrogasRealizadasAIJ>>(url, {})
      .pipe(
        timeout(120000),
        catchError(error => {
          console.error('Error en getReportProrrogasRealizadas:', error);
          if (error.name === 'TimeoutError') {
            return throwError(() => new Error('La consulta está tardando demasiado.'));
          }
          return throwError(() => error);
        })
      );
  }

  getReportPlanesEvidenciasAIJ(startDate: string, endDate: string, orgCtrl: number, estadoSeg: number, auditor: string, dpto: string): Observable<ResponseReadMultiple<ReportGeneralAIJ>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      organismo_control: orgCtrl,
      estado_seguimiento: estadoSeg,
      auditor: auditor,
      dpto: dpto
    };
    const url: string = `${this.apiUrl}reportes/auditor-interno-jefe/reporte-planes-evidencias-ai-jefe`;
    return this.http.post<ResponseReadMultiple<ReportGeneralAIJ>>(url, payload)
      .pipe(
        timeout(120000),
        catchError(error => {
          console.error('Error en getReportPlanesEvidenciasAIJ:', error);
          if (error.name === 'TimeoutError') {
            return throwError(() => new Error('La consulta está tardando demasiado. Por favor, intenta con un rango de fechas más pequeño.'));
          }
          return throwError(() => error);
        })
      );
  }
}
