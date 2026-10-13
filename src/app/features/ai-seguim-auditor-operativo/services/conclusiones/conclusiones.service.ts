import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  Conclusion,
  ConclusionEscritura,
  HallazgoConclusiones,
  MaxItems,
  TitleInformeHallazgo
} from '@features/ai-seguim-auditor-operativo/models/conclusion';
import {
  ResponsableInfo,
} from '@features/ai-seguim-auditor-operativo/models/responsable';
import { Auditoria } from '@shared/models/audit';
import {
  ResponseReadMultipeEeasa,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { catchError, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ConclusionesService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly host: string = this.auxiliarySrv.getHost();
  private readonly usuario: string = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.usuario,
  };
  private url: string = `${environment.url}`;
  private url_sisgerh: string = `${environment.url_sisgerh}selectListaPersonalEEASA?inEstadoPersona=ACTIVO`;

  getConclusiones(
    id: number,
    termino?: string
  ): Observable<ResponseReadSimple<HallazgoConclusiones>> {
    let url: string = `${this.url}conclusiones/hallazgo/${id}`;
    if (termino && termino.trim()) {
      url += `?termino=${encodeURIComponent(termino)}`;
    }
    const response =
      this.http.get<ResponseReadSimple<HallazgoConclusiones>>(url);
    return response;
  }

  createConclusión(
    conclusionEscritura: ConclusionEscritura
  ): Observable<ResponseWrite> {
    const payload = {
      ...conclusionEscritura,
      auditoria: this.audit,
    };

    const url = `${this.url}conclusiones`;
    return this.http.post<ResponseWrite>(url, payload).pipe(
      catchError((error) => {
        console.error('Error al registrar la conclusión', error);
        throw error;
      })
    ); 
  }

  editConclusion(conclusion: Conclusion): Observable<ResponseWrite> {
    const payload = {
      ...conclusion,
      auditoria: this.audit,
    };

    const urlAll = `${this.url}conclusiones/${conclusion.areco_codigo}`;
    const response = this.http.put<ResponseWrite>(urlAll, payload).pipe(
      catchError((error) => {
        console.error('Error al editar hallazgo:', error);
        throw error;
      })
    );
    return response;
  }

  deleteConclusion(conclusion: Conclusion): Observable<ResponseWrite> {
    const payload = {
      body: {
        auditoria: this.audit,
      },
    };

    const urlAll = `${this.url}conclusiones/${conclusion.areco_codigo}`;
    const response = this.http.delete<ResponseWrite>(urlAll, payload).pipe(
      catchError((error) => {
        console.error('Error al editar hallazgo:', error);
        throw error;
      })
    );
    return response;
  }

  getPersonalInfo(): Observable<ResponseReadMultipeEeasa<ResponsableInfo>> {
    try {
      const response = this.http.get<ResponseReadMultipeEeasa<ResponsableInfo>>(
        `${this.url_sisgerh}`
      );
      return response;
    } catch (error) {
      return new Observable();
    }
  }

  getMaxNumRecomendacion(id: string): Observable<ResponseReadSimple<MaxItems>> {
    const url: string = `${this.url}recomendaciones/max-num-rec/${id}`;
    const response = this.http.get<ResponseReadSimple<MaxItems>>(url);
    return response;
  }

  getTitlesInformeHallazgo(id_hall: string): Observable<ResponseReadSimple<TitleInformeHallazgo>> {
    const url: string = `${this.url}hallazgos/titulos/${id_hall}`;
    const response = this.http.get<ResponseReadSimple<TitleInformeHallazgo>>(url);
    return response;
  }
}
