import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { Informe, OrganismoControl, TipoInforme } from '@features/ai-rec-verificables/models/Informe';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InformesVerificablesService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl: string = `${environment.url}`;
  private currentData: Informe[] | null = null;

  getInformeByCod(informe: Informe): Observable<ResponseReadSimple<Informe>> {
    try {
      const response = this.http.get<ResponseReadSimple<Informe>>(
        `${this.apiUrl}informes/${informe.ainin_codigo}`
      );
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  getCurrentData(): Informe[] | null {
    return this.currentData;
  }

  getFilteredInformesAudOper(
    orgCtrl: number,
    tipInf: number,
    startDate: string,
    endDate: string
  ): Observable<ResponseReadMultiple<Informe>> {
    const cuenta = '0';
    return this.http
      .get<ResponseReadMultiple<Informe>>(
        `${this.apiUrl}informes/filtro-auditor-operativo?ainoc_organismo_control=${orgCtrl}&ainti_tipo_inf=${tipInf}&ainin_fecha_inicio=${startDate}&ainin_fecha_fin=${endDate}&ainin_usuario=${cuenta}`
      )
      .pipe(
        tap((response) => {
          this.currentData = response.datos;
        })
      );
  }

  getFilteredInformesAudGen(
    orgCtrl: number,
    tipInf: number,
    startDate: string,
    endDate: string
  ): Observable<ResponseReadMultiple<Informe>> {
    const cuenta = '0';
    return this.http
      .get<ResponseReadMultiple<Informe>>(
        `${this.apiUrl}informes/filtro-auditor-general?ainoc_organismo_control=${orgCtrl}&ainti_tipo_inf=${tipInf}&ainin_fecha_inicio=${startDate}&ainin_fecha_fin=${endDate}&ainin_usuario=${cuenta}`
      )
      .pipe(
        tap((response) => {
          this.currentData = response.datos;
        })
      );
  }

  getOrganismoControl(): Observable<ResponseReadMultiple<OrganismoControl>> {
    try {
      const response = this.http.get<ResponseReadMultiple<OrganismoControl>>(
        `${this.apiUrl}organismos`
      );
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  getTipoInforme(): Observable<ResponseReadMultiple<TipoInforme>> {
    try {
      const response = this.http.get<ResponseReadMultiple<TipoInforme>>(
        `${this.apiUrl}tipoInf`
      );
      return response;
    } catch (error) {
      return new Observable();
    }
  }
}
