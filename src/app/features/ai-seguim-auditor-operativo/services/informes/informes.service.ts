import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable, tap, throwError } from 'rxjs';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { Informe } from '@features/ai-seguim-auditor-operativo/models/informe';
import { ResponseWrite } from '@shared/models/response-write';
import { Auditoria } from '@shared/models/audit';
import { OrganismoControl } from '@features/ai-seguim-auditor-operativo/models/informe';
import { TipoInforme } from '@features/ai-seguim-auditor-operativo/models/informe';

@Injectable({
  providedIn: 'root',
})
export class InformesService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private apiUrl: string = `${environment.url}`;
  private urlFtp: string = `${environment.url}archivo`;
  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };
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

  getFilteredInformes(
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

  getFile(rutaArchivo: string): Observable<ResponseReadSimple<any>> {
    try {
      const response = this.http.get<ResponseReadSimple<any>>(this.urlFtp, {
        params: { ruta: rutaArchivo },
      });

      return response;
    } catch (error) {
      return new Observable();
    }
  }

  editInformes(informe: FormData, id: Number): Observable<ResponseWrite> {
    try {
      informe.append('auditoria', JSON.stringify(this.audit));
      const response = this.http.post<ResponseWrite>(
        `${this.apiUrl}informes/${id}/actualizar`,
        informe
      ).pipe(
        catchError((error: HttpErrorResponse) => {
          // Extrae directamente el mensaje sin crear un nuevo Error
          const errorMessage =
            error.error?.mensaje || error.message || 'Error desconocido';
          return throwError(() => errorMessage);
        })
      );
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  deleteInforme(informe: Informe): Observable<ResponseWrite> {
    try {
      const urlDelete: string = `${this.apiUrl}informes/${informe.ainin_codigo}`;
      const options = {
        body: {
          auditoria: this.audit,
        },
      };
      const response = this.http.delete<ResponseWrite>(urlDelete, options);

      return response;
    } catch (error) {
      return new Observable();
    }
  }

  saveInforme(informe: FormData): Observable<ResponseWrite> {
    informe.append('auditoria', JSON.stringify(this.audit));
    return this.http
      .post<ResponseWrite>(`${this.apiUrl}informes`, informe)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // Extrae directamente el mensaje sin crear un nuevo Error
          const errorMessage =
            error.error?.mensaje || error.message || 'Error desconocido';
          return throwError(() => errorMessage);
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

  notificar(codRec: number): Observable<ResponseWrite> {
    const url: string = `${this.apiUrl}email/notificar-informe/${codRec}`;
    const response = this.http.get<ResponseWrite>(url);
    return response;
  }
}
