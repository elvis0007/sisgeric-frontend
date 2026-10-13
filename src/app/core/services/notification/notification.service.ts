import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Auditoria } from '@shared/models/audit';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Notification } from '@core/auth/models/notification';
import { environment } from '@environments/environment.development';
import { Observable } from 'rxjs';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly host: string = this.auxiliarySrv.getHost();
  private readonly usuario: string = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.usuario,
  };
  private url: string = `${environment.url}`;

  getNotifications(codUser: string): Observable<ResponseReadMultiple<Notification>> {
    const url: string = `${this.url}notificaciones/notificaciones-usuario/${codUser}`;
    const response = this.http.get<ResponseReadMultiple<Notification>>(url);
    return response;
  }

  updateNotification(codNotification: number): Observable<ResponseWrite> {
    const url: string = `${this.url}notificaciones/actualizar-notif/${codNotification}`;
    const response = this.http.put<ResponseWrite>(url, {});
    return response;
  }

  getCadenaIds(arereCodigo: number): Observable<any> {
    const url = `${this.url}notificaciones/cadena-ids/${arereCodigo}`;
    return this.http.get<any>(url);
  }
}
