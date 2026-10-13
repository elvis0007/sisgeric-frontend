import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  HallazgoConclusiones,
  TitleInformeHallazgo
} from '@features/ai-seguim-auditor-general/models/conclusion-ag';
import {
  ResponsableInfo,
} from '@features/ai-seguim-auditor-general/models/responsable-ag';
import {
  ResponseReadMultipeEeasa,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ConclusionesAgService {
  private readonly http: HttpClient = inject(HttpClient);
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

  getTitlesInformeHallazgo(id_hall: string): Observable<ResponseReadSimple<TitleInformeHallazgo>> {
    const url: string = `${this.url}hallazgos/titulos/${id_hall}`;
    const response = this.http.get<ResponseReadSimple<TitleInformeHallazgo>>(url);
    return response;
  }
}
