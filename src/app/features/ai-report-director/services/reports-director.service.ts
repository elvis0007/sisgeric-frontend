import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { ReportDirector } from '@features/ai-report-director/models/report-director';
import { ReportDepartamentoFechasVencidas } from '@features/ai-report-director/models/report-departamento-fechas-vencidas';
import { ResponseReadMultiple, ResponseReadSimple } from '@shared/models/response-read';
import { Observable } from 'rxjs';
import { ListaAuditorOp } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import {
  OrganismoControl
} from '@features/ai-seg-configuracion/models/Organismo-Control';

@Injectable({
  providedIn: 'root'
})
export class ReportsDirectorService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl: string = `${environment.url}`;

 getReportForDirector(startDate: string, endDate: string, orgCtrl: number, estadoSeg: number, auditor: string, dpto: string): Observable<ResponseReadMultiple<ReportDirector>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      organismo_control: orgCtrl,
      estado_seguimiento: estadoSeg,
      dpto: dpto,
      auditor: auditor,
    }
    const url: string = `${this.apiUrl}reportes/director-departamental/reporte-recomendaciones-por-departamento`;
    return this.http.post<ResponseReadMultiple<ReportDirector>>(url, payload);
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

  getReportDepartamentoFechasVencidas(startDate: string, endDate: string, orgCtrl: number, estadoSeg: number, auditor: string, dpto: string): Observable<ResponseReadMultiple<ReportDepartamentoFechasVencidas>> {
    const payload = {
      fecha_inicial: this.formatDateToDDMMYYYY(startDate),
      fecha_fin: this.formatDateToDDMMYYYY(endDate),
      organismo_control: orgCtrl,
      estado_seguimiento: estadoSeg,
      dpto: dpto,
      auditor: auditor,
    }
    const url: string = `${this.apiUrl}reportes/director-departamental/reporte-departamento-fechas-vencidas`;
    return this.http.post<ResponseReadMultiple<ReportDepartamentoFechasVencidas>>(url, payload);
  }
}