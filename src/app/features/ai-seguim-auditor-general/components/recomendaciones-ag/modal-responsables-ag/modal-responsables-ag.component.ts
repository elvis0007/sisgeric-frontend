import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import { ResponsableView } from '@features/ai-seguim-auditor-general/models/recomendacion-ag';
import { ModalResponsablesAgService } from '@features/ai-seguim-auditor-general/services/recomendaciones-ag/modal-responsables-ag.service';
import { RecomendacionesAgService } from '@features/ai-seguim-auditor-general/services/recomendaciones-ag/recomendaciones-ag.service';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';

@Component({
  selector: 'app-modal-responsables-ag',
  standalone: true,
  imports: [CommonModule, StatusColorPipe],
  templateUrl: './modal-responsables-ag.component.html',
  styleUrl: './modal-responsables-ag.component.css',
})
export class ModalResponsablesAgComponent {
  protected userPhotoUrl: string = 'sisrec/assets/images/avatar_profile.png';
  protected modalResponsableSrv: ModalResponsablesAgService = inject(
    ModalResponsablesAgService
  );
  private readonly recomendacionSrv: RecomendacionesAgService = inject(
    RecomendacionesAgService
  );
  private readonly alertStateService = inject(AlertsStateService);

  protected id_rec!: number;
  protected selectedState: number = 1; // 'Actuales' activado por defecto
  protected responsables: ResponsableView[] = [];
  protected isLoadingCards = false;
  protected readonly Math = Math;

  constructor() {
    effect(() => {
      const id_rec = this.modalResponsableSrv.modalData();
      if (id_rec) {
        this.id_rec = id_rec;
        this.getResponsables(this.id_rec);
      }
    });
  }

  protected closeModal() {
    this.modalResponsableSrv.closeModal();
    this.responsables = [];
  }

  // Obtiene los responsables de la recomendación
  protected getResponsables(id_rec: number): void {
    this.isLoadingCards = true; // Activa el indicador de carga para las tarjetas
    this.recomendacionSrv.getResponsables(id_rec).subscribe({
      next: (response: ResponseReadMultiple<ResponsableView>) => {
        this.responsables = response.datos.map((responsable) => ({
          ...responsable,
          fotografia: `data:image/jpeg;base64,${responsable.fotografia}`, // Concatenar el prefijo
        }));
      },
      error: () => {
        this.alertStateService.showAlert(
          'Error al obtener responsables.',
          'error'
        );
      },
      complete: () => {
        this.isLoadingCards = false; // Desactiva el indicador de carga al finalizar
      },
    });
  }

  protected get filteredResponsables(): ResponsableView[] {
    return this.responsables.filter((responsable) => {
      // Si el filtro es ACTUALES (1), se muestran los que no tienen estado '0'
      if (this.selectedState === 1) {
        return responsable.arers_estado !== '0';
      }
      // Si el filtro es ANTERIORES (2), se muestran los que tienen estado '0'
      return responsable.arers_estado === '0';
    });
  }  

  protected setFilter(state: number): void {
    this.selectedState = state;
  }

  protected esJustificado(responsable: ResponsableView): boolean {
    if (!responsable.areev_descripcion) return false;
    const desc = responsable.areev_descripcion.toUpperCase().trim();
    return desc === 'JUSTIFICA' || desc === 'JUSTIFICADO' || desc === 'VERIFICABLE JUSTIFICADO';
  }

  protected getAbsPlazo(plazo: number | undefined): number {
    return Math.abs(plazo || 0);
  }
}
