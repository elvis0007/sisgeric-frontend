import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { Observable } from 'rxjs';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { Auditoria } from '@shared/models/audit';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Nas } from '@features/ai-seg-configuracion/models/Nas';

@Injectable({
  providedIn: 'root',
})
export class NasService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl: string = `${environment.url}configuracion`;
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);

  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };

  getCurrentData(): Observable<ResponseReadMultiple<Nas>> {
    try {
      const response = this.http.get<ResponseReadMultiple<Nas>>(this.apiUrl);
      return response;
    } catch (error) {
      return new Observable();
    }
  }

  getConfiguracion(config: Nas): Observable<ResponseReadSimple<Nas>> {
    try {
      const urlAll = `${this.apiUrl}/${config.aseco_codigo}`;
      const response = this.http.get<ResponseReadSimple<Nas>>(urlAll);
      return response;
    } catch (error) {
      return new Observable();
    }
  }

  updateConfiguracion(
    config: Nas,
    password: string
  ): Observable<ResponseWrite> {
    try {
      // Construir el body base con todos los campos requeridos
      const body: any = {
        aseco_codigo: config.aseco_codigo,
        aseco_host: config.aseco_host,
        aseco_port: config.aseco_port,
        aseco_user: config.aseco_user,
        aseco_nombre_host: config.aseco_nombre_host,
        aseco_directorio: config.aseco_directorio,
        aseco_size_file_mb: config.aseco_size_file_mb,
        auditoria: this.audit,
      };

      // Solo agregar la contraseña si se proporciona y no está vacía
      if (password && password.trim() !== '') {
        body.aseco_contrasenia = password;
      }

      const urlAll = `${this.apiUrl}/${config.aseco_codigo}`;
      const response = this.http.put<ResponseWrite>(urlAll, body);
      return response;
    } catch (error) {
      console.error('Error updating configuracion:', error);
      return new Observable();
    }
  }
}
