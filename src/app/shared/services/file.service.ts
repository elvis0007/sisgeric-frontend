import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { ResponseReadSimple } from '@shared/models/response-read';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  private readonly http: HttpClient = inject(HttpClient);
  private urlFtp: string = `${environment.url}archivo`;

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
}
