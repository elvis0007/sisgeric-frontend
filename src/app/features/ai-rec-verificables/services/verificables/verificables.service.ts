import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  RecomendacionVerificable,
  Verificable,
  VerificableEscritura,
} from '@features/ai-rec-verificables/models/Verificable';
import { Auditoria } from '@shared/models/audit';
import { ResponseReadSimple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class VerificablesService {
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
  private currentData: Verificable[] | null = null;

  getCurrentData(): Verificable[] | null {
    return this.currentData;
  }

  getVerificables(
    arere_codigo: number,
    arers_codigo_per: string
  ): Observable<ResponseReadSimple<RecomendacionVerificable>> {
    const url: string = `${this.apiUrl}verificables?arere_codigo=${arere_codigo}&arers_codigo_per=${arers_codigo_per}`;
    return this.http
      .get<ResponseReadSimple<RecomendacionVerificable>>(url)
      .pipe(
        tap((response) => {
          this.currentData = response.datos.verificables;
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

  saveVerificable(verificable: FormData): Observable<ResponseWrite> {
    verificable.append('auditoria', JSON.stringify(this.audit));
    return this.http
      .post<ResponseWrite>(`${this.apiUrl}verificables`, verificable)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // Extrae directamente el mensaje sin crear un nuevo Error
          const errorMessage =
            error.error?.mensaje || error.message || 'Error desconocido';
          return throwError(() => errorMessage);
        })
      );
  }

  notificarEnvioBatch(data: {
    arere_codigo: number;
    arers_codigo_per: string;
    cantidadVerificables: number;
    nombresArchivos: string[];
    descripcion: string;
  }): Observable<ResponseWrite> {
    const payload = {
      ...data,
      auditoria: JSON.stringify(this.audit),
    };
    return this.http
      .post<ResponseWrite>(`${this.apiUrl}verificables/notificar-envio`, payload)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage =
            error.error?.mensaje || error.message || 'Error al notificar envío de verificables';
          return throwError(() => errorMessage);
        })
      );
  }

  getResposablesForFilter(
    codRecom: string
  ): Observable<ResponseReadSimple<any>> {
    return this.http.get<ResponseReadSimple<any>>(
      `${this.apiUrl}responsables/recomendacion/${codRecom}`
    );
  }

  validarVerificable(
    hallazgo: VerificableEscritura,
    areve_codigo: number
  ): Observable<ResponseWrite> {
    const payload = {
      ...hallazgo,
      auditoria: this.audit,
    };
    const urlAll = `${this.apiUrl}verificables/validar/${areve_codigo}`;
    const response = this.http.put<ResponseWrite>(urlAll, payload).pipe(
      catchError((error) => {
        // Extrae directamente el mensaje sin crear un nuevo Error
        const errorMessage =
          error.error?.mensaje || error.message || 'Error desconocido';
        return throwError(() => errorMessage);
      })
    );
    return response;
  }

  deleteVerificable(verificable: Verificable): Observable<ResponseWrite> {
    try {
      const payload = {
        body: { auditoria: this.audit },
      };
      const urlAll = `${this.apiUrl}verificables/eliminar/${verificable.areve_codigo}`;
      const response = this.http.delete<ResponseWrite>(urlAll, payload);
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  getVerificable(
    areve_codigo: any
  ): Observable<ResponseReadSimple<Verificable>> {
    try {
      const urlAll = `${this.apiUrl}verificables/${areve_codigo}`;
      const response = this.http.get<ResponseReadSimple<Verificable>>(urlAll);
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  editVerificable(
    areve_codigo: number,
    verificable: FormData
  ): Observable<ResponseWrite> {
    try {
      verificable.append('auditoria', JSON.stringify(this.audit));
      const response = this.http
        .post<ResponseWrite>(
          `${this.apiUrl}verificables/${areve_codigo}/actualizar`,
          verificable
        )
        .pipe(
          catchError((error) => {
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
}
