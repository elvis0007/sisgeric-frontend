import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { Informe } from '@features/ai-director-informes/models/Informe';
import { OrganismoControl, TipoInforme } from '@features/ai-seguim-auditor-operativo/models/informe';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InformesDirectorService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl: string = `${environment.url}`;
  private currentData: Informe[] | null = null;

  getCurrentData(): Informe[] | null {
    return this.currentData;
  }

  getFilteredInformes(
    orgCtrl: number,
    tipInf: number,
    startDate: string,
    endDate: string,
    departamento: string
  ): Observable<ResponseReadMultiple<Informe>> {
    return this.http
      .get<ResponseReadMultiple<Informe>>(
        `${this.apiUrl}informes/filtro-director?ainoc_organismo_control=${orgCtrl}&ainti_tipo_inf=${tipInf}&ainin_fecha_inicio=${startDate}&ainin_fecha_fin=${endDate}&departamento=${departamento}`
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
