import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ResponseReadSimple } from '@shared/models/response-read';
import { InformeHallazgos } from '@features/ai-seguim-auditor-general/models/hallazgo-ag';

@Injectable({
  providedIn: 'root',
})
export class HallazgosAgService {
  private readonly http: HttpClient = inject(HttpClient);

  private apiUrl: string = `${environment.url}`;

  getHallazgos(id: number, termino?: string): Observable<ResponseReadSimple<InformeHallazgos>> {
    let url: string = `${this.apiUrl}hallazgos/informe/${id}`;
    if (termino && termino.trim()) {
      url += `?termino=${encodeURIComponent(termino)}`;
    }
    const response = this.http.get<ResponseReadSimple<InformeHallazgos>>(url);
    return response;
  }

}
