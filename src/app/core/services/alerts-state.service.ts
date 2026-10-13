import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface AlertConfig {
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class AlertsStateService {
  // Subject que emitirá los eventos de alerta
  private alertSubject = new Subject<AlertConfig>();
  
  // Observable público que los componentes pueden suscribirse
  public alert$ = this.alertSubject.asObservable();
  
  /**
   * Muestra una alerta con un mensaje y tipo específicos
   * @param message El mensaje a mostrar
   * @param type El tipo de alerta: 'success', 'warning', 'error', 'info'
   */
  showAlert(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
    this.alertSubject.next({ message, type });
  }
}
