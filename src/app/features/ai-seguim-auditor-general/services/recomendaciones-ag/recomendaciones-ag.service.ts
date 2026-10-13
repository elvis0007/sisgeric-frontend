import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import {
  ConclusionRecomendaciones,
  ResponsableView,
} from '@features/ai-seguim-auditor-general/models/recomendacion-ag';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RecomendacionesAgService {
  private readonly http: HttpClient = inject(HttpClient);
  private url: string = `${environment.url}`;

  getRecomendaciones(
    id: number
  ): Observable<ResponseReadSimple<ConclusionRecomendaciones>> {
    const url: string = `${this.url}recomendaciones/conclusion/${id}`;
    const response =
      this.http.get<ResponseReadSimple<ConclusionRecomendaciones>>(url);
    return response;
  }

  getResponsables(
    id: number
  ): Observable<ResponseReadMultiple<ResponsableView>> {
    const url: string = `${this.url}responsables/recomendacion/${id}`;
    const response = this.http.get<ResponseReadMultiple<ResponsableView>>(url);
    return response;
  }
}
