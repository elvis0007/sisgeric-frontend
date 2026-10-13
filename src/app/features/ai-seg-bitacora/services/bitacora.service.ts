import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import { Bitacora } from '@features/ai-seg-bitacora/models/bitacora';
import { Observable, tap } from 'rxjs';
import { ResponseReadMultiple } from '@shared/models/response-read';

@Injectable({
  providedIn: 'root',
})
export class BitacoraService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl: string = `${environment.url}bitacora`;
  private currentData: Bitacora[] | null = null;

  getCurrentData(): Bitacora[] | null {
    return this.currentData;
  }
  
  filterByDates(startDate: string, endDate: string): Observable<ResponseReadMultiple<Bitacora>> {
    return this.http.get<ResponseReadMultiple<Bitacora>>(
      `${this.apiUrl}/filtrarPorFechas?fechaInicio=${startDate}&fechaFin=${endDate}`
    ).pipe(
      tap(response => {
        this.currentData = response.datos;
      })
    );
  }

  exportToExcel(data: Bitacora[]): void {
    import('xlsx').then(xlsx => {
      const worksheet = xlsx.utils.json_to_sheet(data.map(item => ({
        Código: item.codigo,
        Proyecto: item.proyecto,
        Tabla: item.tabla,
        Host: item.host,
        Usuario: item.usuario,
        Fecha: new Date(item.fecha).toLocaleString(),
        Detalle: item.detalle
      })));

      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Bitácora');
      
      xlsx.writeFile(workbook, `bitacora_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  }
}
