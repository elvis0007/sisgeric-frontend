import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { Auditoria } from '@shared/models/audit';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import {
  RecomendacionVerificable,
  RecomendacionVerificables,
} from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { catchError, Observable, throwError, Subject } from 'rxjs';
import { Verificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { ResponseWrite } from '@shared/models/response-write';

@Injectable({
  providedIn: 'root',
})
export class VerificablesResponsablesService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly host: string = this.auxiliarySrv.getHost();
  private readonly usuario: string = this.auxiliarySrv.getUserCuenta();
  private urlFtp: string = `${environment.url}archivo`;
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.usuario,
  };
  private url: string = `${environment.url}`;

  // Subject para notificar actualizaciones de verificables
  private verificableUpdatedSubject = new Subject<{codigoRec: number, codPer: string}>();
  
  // Observable público para que los componentes se suscriban
  public verificableUpdated$ = this.verificableUpdatedSubject.asObservable();

  getRecResponsables(
    idState: number,
    cod_per: string,
    anio: string
  ): Observable<ResponseReadMultiple<RecomendacionVerificable>> {
    const url: string = `${this.url}recomendaciones/responsable`;
    const params = new HttpParams()
      .set('arees_estado_seg', idState.toString())
      .set('arers_codigo_per', cod_per)
      .set('arere_anio_inicio_control', anio);

    return this.http.get<ResponseReadMultiple<RecomendacionVerificable>>(url, {
      params,
    });
  }

  getVerificablesResp(
    codRec: number,
    codPer: string
  ): Observable<ResponseReadSimple<RecomendacionVerificables>> {
    const url: string = `${this.url}verificables`;
    const params = new HttpParams()
      .set('arere_codigo', codRec.toString())
      .set('arers_codigo_per', codPer);

    return this.http.get<ResponseReadSimple<RecomendacionVerificables>>(url, {
      params,
    });
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

  getVerificable(
    areve_codigo: any
  ): Observable<ResponseReadSimple<Verificable>> {
    try {
      const urlAll = `${this.url}verificables/${areve_codigo}`;
      const response = this.http.get<ResponseReadSimple<Verificable>>(urlAll);
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  deleteVerificable(verCod: any): Observable<ResponseWrite> {
    const payload = {
      body: {
        auditoria: this.audit,
      },
    };
    const url: string = `${this.url}verificables/eliminar/${verCod}`;
    const response = this.http.delete<ResponseWrite>(url, payload).pipe(
      catchError((error) => {
        // Extrae directamente el mensaje sin crear un nuevo Error
        const errorMessage =
          error.error?.mensaje || error.message || 'Error desconocido';
        return throwError(() => errorMessage);
      })
    );
    return response;
  }

  // Método para notificar que un verificable fue actualizado
  public notifyVerificableUpdated(codigoRec: number, codPer: string): void {
    this.verificableUpdatedSubject.next({ codigoRec, codPer });
  }

  getRecomendacionDetalle(arere_codigo: number): Observable<ResponseReadSimple<any>> {
    const url = `${this.url}recomendaciones/detalle/${arere_codigo}`;
    return this.http.get<ResponseReadSimple<any>>(url);
  }
}
