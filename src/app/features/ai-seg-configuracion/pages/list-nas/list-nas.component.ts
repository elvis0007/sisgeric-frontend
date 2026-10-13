import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, effect } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { CardNasComponent } from '@features/ai-seg-configuracion/components/nas/card-nas/card-nas.component';
import { ModalFormComponent } from '@features/ai-seg-configuracion/components/nas/modal-form/modal-form.component';
import { Nas } from '@features/ai-seg-configuracion/models/Nas';
import { NasService } from '@features/ai-seg-configuracion/services/nas/nas.service';
import { ModalService } from '@features/ai-seg-configuracion/services/nas/modal.service';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-list-nas',
  standalone: true,
  imports: [
    BreadcrumbsComponent,
    CommonModule,
    CardNasComponent,
    ModalFormComponent,
  ],
  templateUrl: './list-nas.component.html',
  styleUrl: './list-nas.component.css',
})
export class ListNasComponent implements OnInit {
  protected configuracion: Nas[] = [];
  protected isLoading = false;

  private configuracionSrv: NasService = inject(NasService);
  private modalSrv: ModalService = inject(ModalService);
  protected readonly alertsService = inject(AlertsStateService);

  constructor() {
    // Escuchar cambios en la configuración
    effect(() => {
      if (this.modalSrv.configurationUpdated()) {
        this.reloadConfiguration();
      }
    });
  }

  ngOnInit(): void {
    this.getConfiguracion();
  }

  private getConfiguracion() {
    this.isLoading = true;
    this.configuracionSrv.getCurrentData().subscribe({
      next: (response: ResponseReadMultiple<Nas>) => {
        this.configuracion = response.datos;
        this.isLoading = false;
      },
      error: () => {
        this.alertsService.showAlert('Error al cargar la configuración', 'error');
        this.isLoading = false;
      },
    });
  }

  private reloadConfiguration() {
    // Recargar sin mostrar el spinner de carga completo
    this.configuracionSrv.getCurrentData().subscribe({
      next: (response: ResponseReadMultiple<Nas>) => {
        this.configuracion = response.datos;
        // Mostrar una notificación sutil de que se actualizó
        this.alertsService.showAlert('Configuración actualizada correctamente', 'success');
      },
      error: () => {
        this.alertsService.showAlert('Error al recargar la configuración', 'error');
      },
    });
  }

  protected getCurrentDate(): string {
    const today = new Date();
    return today.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
