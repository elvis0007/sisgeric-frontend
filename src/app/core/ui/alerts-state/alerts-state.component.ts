import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-alerts-states',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts-state.component.html',
  styleUrl: './alerts-state.component.css',
})
export class AlertsStatesComponent implements OnInit, OnDestroy {
  @Input() type: 'success' | 'warning' | 'error' | 'info' = 'info';
  @Input() message: string = '';
  protected isVisible: boolean = false;
  
  private readonly alertsService = inject(AlertsStateService);
  private subscription: Subscription = new Subscription();
  
  ngOnInit(): void {
    // Suscripción al servicio de alertas
    this.subscription = this.alertsService.alert$.subscribe(alert => {
      this.showAlert(alert.message, alert.type);
    });
  }
  
  ngOnDestroy(): void {
    // Desuscribirse para evitar memory leaks
    this.subscription.unsubscribe();
  }

  showAlert(message: string, type: string) {
    this.message = message;
    this.type = type as 'success' | 'warning' | 'error' | 'info';
    this.isVisible = true;

    setTimeout(() => {
      this.isVisible = false;
    }, 3500);
  }

  protected get alertClass(): string {
    switch (this.type) {
      case 'success':
        return 'alert-success';
      case 'warning':
        return 'alert-warning';
      case 'error':
        return 'alert-error';
      case 'info':
      default:
        return 'alert-info';
    }
  }

  protected get iconPath(): string {
    switch (this.type) {
      case 'success':
        return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'warning':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
      case 'error':
        return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'info':
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }
}
