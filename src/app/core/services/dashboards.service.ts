import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { Observable } from 'rxjs';
import { ResponseReadSimple } from '@shared/models/response-read';
import {
  ChartBarAnio,
  ChartBarDpto,
  ChartDonut,
  ChartList,
  ChartListAiJefe,
  MetricasResponsable,
} from '@core/main-page/models/dashboards';

@Injectable({
  providedIn: 'root',
})
export class DashboardsService {
  private readonly http: HttpClient = inject(HttpClient);
  private url: string = `${environment.url}dashboards/`;

  getChartDonutAiJefe(): Observable<ResponseReadSimple<ChartDonut>> {
    const url: string = `${this.url}ai-jefe/dashboard-data-s1`;
    const response = this.http.get<ResponseReadSimple<ChartDonut>>(url);
    return response;
  }

  getChartBarsAiJefeDpto(): Observable<ResponseReadSimple<ChartBarDpto>> {
    const url: string = `${this.url}ai-jefe/dashboard-data-s2`;
    const response = this.http.get<ResponseReadSimple<ChartBarDpto>>(url);
    return response;
  }

  getChartBarsAiJefeAnios(): Observable<ResponseReadSimple<ChartBarAnio>> {
    const url: string = `${this.url}ai-jefe/dashboard-data-s3`;
    const response = this.http.get<ResponseReadSimple<ChartBarAnio>>(url);
    return response;
  }

  getChartDonutAiOper(
    aiUser: string
  ): Observable<ResponseReadSimple<ChartDonut>> {
    const url: string = `${this.url}ai-operativo/dashboard-data-s1/${aiUser}`;
    const response = this.http.get<ResponseReadSimple<ChartDonut>>(url);
    return response;
  }

  getChartBarsAiOperAnios(
    aiUser: string
  ): Observable<ResponseReadSimple<ChartBarAnio>> {
    const url: string = `${this.url}ai-operativo/dashboard-data-s2/${aiUser}`;
    const response = this.http.get<ResponseReadSimple<ChartBarAnio>>(url);
    return response;
  }

  getChartBarsAiOperDpto(
    aiUser: string
  ): Observable<ResponseReadSimple<ChartBarDpto>> {
    const url: string = `${this.url}ai-operativo/dashboard-data-s3/${aiUser}`;
    const response = this.http.get<ResponseReadSimple<ChartBarDpto>>(url);
    return response;
  }

  getChartDonutDirector(dpto: string): Observable<ResponseReadSimple<ChartDonut>> {
    const url: string = `${this.url}d-departamental/dashboard-data-s1/${dpto}`;
    const response = this.http.get<ResponseReadSimple<ChartDonut>>(url);
    return response;
  } 
  
  getChartBarsDirectorAnios(dpto: string): Observable<ResponseReadSimple<ChartBarAnio>> {
    const url: string = `${this.url}d-departamental/dashboard-data-s2/${dpto}`;
    const response = this.http.get<ResponseReadSimple<ChartBarAnio>>(url);
    return response;
  }

  getListDetalleDirector(dpto: string): Observable<ResponseReadSimple<ChartList>> {
    const url: string = `${this.url}d-departamental/dashboard-data-s3/${dpto}`;
    const response = this.http.get<ResponseReadSimple<ChartList>>(url);
    return response;
  }

  getMetricasResponsable(userCuenta: string): Observable<ResponseReadSimple<MetricasResponsable>> {
    const url: string = `${this.url}auditado/dashboard-data-s1/${userCuenta}`;
    const response = this.http.get<ResponseReadSimple<MetricasResponsable>>(url);
    return response;
  }

  getChartBarsResponsableAnios(userCuenta: string): Observable<ResponseReadSimple<ChartBarAnio>> {
    const url: string = `${this.url}auditado/dashboard-data-s2/${userCuenta}`;
    const response = this.http.get<ResponseReadSimple<ChartBarAnio>>(url);
    return response;
  }
  
  getListDetalleResponsable(userCuenta: string): Observable<ResponseReadSimple<ChartList>> {
    const url: string = `${this.url}auditado/dashboard-data-s3/${userCuenta}`;
    const response = this.http.get<ResponseReadSimple<ChartList>>(url);
    return response;
  }

  getListDetalleAiJefe(): Observable<ResponseReadSimple<ChartListAiJefe>> {
    const url: string = `${this.url}ai-jefe/dashboard-data-s4`;
    const response = this.http.get<ResponseReadSimple<ChartListAiJefe>>(url);
    return response;
  }
  
}
