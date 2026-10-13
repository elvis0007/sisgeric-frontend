import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-notification.component.html',
  styleUrl: './alert-notification.component.css'
})
export class AlertNotificationComponent {
  @Input() autoClose: boolean = true;
  @Output() notificationReceived = new EventEmitter<void>();
  
  protected message: string = '';
  protected showAlert: boolean = false;

  /**
   * Muestra una alerta con el mensaje recibido
   * @param mensaje Mensaje a mostrar
   */
  showNotification(message: string): void {
    this.message = message;
    this.showAlert = true;
    
    // Emitir evento para actualizar el contador de notificaciones
    this.notificationReceived.emit();
    
    // Auto-cerrar la alerta después de 5 segundos
    if (this.autoClose) {
      setTimeout(() => {
        this.showAlert = false;
      }, 5000);
    }
  }

  closeAlert(): void {
    this.showAlert = false;
  }
}
