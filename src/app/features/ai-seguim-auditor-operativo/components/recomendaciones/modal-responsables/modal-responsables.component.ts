import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input, OnDestroy } from '@angular/core';
import { ResponsableView } from '@features/ai-seguim-auditor-operativo/models/recomendacion';
import { ModalResponsablesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/modal-responsables.service';
import { RecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/recomendaciones.service';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-modal-responsables',
  standalone: true,
  imports: [CommonModule, StatusColorPipe],
  templateUrl: './modal-responsables.component.html',
  styleUrl: './modal-responsables.component.css',
})
export class ModalResponsablesComponent implements OnDestroy {
  @Input() openModalAddResp!: (
    responsablesCodigos: string[],
    codes: {},
    type: 'assing' | 'replace'
  ) => Promise<void>;
  @Input() reloadTable!: () => void;
  protected userPhotoUrl: string =
    'sisrec/assets/images/avatar_profile.png';
  protected readonly Math = Math;
  protected modalResponsableSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );
  private readonly recomendacionSrv: RecomendacionesService = inject(
    RecomendacionesService
  );
  protected readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];
  private responsableEliminar!: ResponsableView;
  protected id_rec!: number;
  protected selectedState: number = 1; // 'Actuales' activado por defecto
  protected responsables: ResponsableView[] = [];
  protected isLoadingBotonAssing = false;
  isLoadingBotonReplace: { [key: string]: boolean } = {};
  protected isLoadingCards = false;

  protected esJustificado(responsable: any): boolean {
    const estado = (responsable?.areev_descripcion || '').trim().toUpperCase();
    if (estado === 'NO JUSTIFICA') return false;
    return estado === 'JUSTIFICA' || estado === 'JUSTIFICADO' || estado === 'VERIFICABLE JUSTIFICADO' || responsable?.estado_plazo === 'CUMPLIDO';
  }

  constructor() {
    effect(() => {
      const id_rec = this.modalResponsableSrv.modalData();
      if (id_rec) {
        this.id_rec = id_rec;
        this.getResponsables(this.id_rec);
      }
    });
  }

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  protected isCumplida(): boolean {
    return this.modalResponsableSrv.isCumplida();
  }

  /* 
    idResp: id unico de responsanble asignado a la recomendacion para ser reemplazado 
  */
  protected openModalReplaceResponsable(idResp: string): void {
    if (this.isCumplida()) {
      return;
    }
    this.isLoadingBotonReplace[idResp] = true;
    const responsablesCodigos = this.responsables
      .filter((r) => r.arers_estado === '1')
      .map((r) => r.arers_codigo_per);

    //convertir a array para pasarle al metodo openModal
    const codes = { arere_codigo: this.id_rec, arers_codigo: idResp }; //objeto con el codifo de la recomendacion y el responsable a ser resplazado
    // Llamar al método del padre
    this.openModalAddResp(responsablesCodigos, codes, 'replace')
      .catch(() => {
        this.alertsService.showAlert(
          'Error al abrir el modal de responsables.',
          'error'
        );
      })
      .finally(() => {
        this.isLoadingBotonReplace[idResp] = false; // Restablece el estado de carga solo para este botón
      });
  }

  protected openModalAddResponsables(): void {
    if (this.isCumplida()) {
      return;
    }
    this.isLoadingBotonAssing = true; // Indica que está cargando en el componente hijo
    // Obtener los códigos de los responsables activos
    const responsablesCodigos = this.responsables
      .filter((r) => r.arers_estado === '1')
      .map((r) => r.arers_codigo_per);
    const codes = { arere_codigo: this.id_rec, arers_codigo: '' };
    // Llamar al método del padre pasando los códigos
    this.openModalAddResp(responsablesCodigos, codes, 'assing')
      .catch(() => {
        this.alertsService.showAlert(
          'Error al abrir el modal de responsables.',
          'error'
        );
        this.isLoadingBotonAssing = false;
      })
      .finally(() => {
        this.isLoadingBotonAssing = false; // Restablece el estado de carga
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
        this.alertsService.showAlert(
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

  protected deleteResponsable(codResp: number): void {
    this.recomendacionSrv.deleteResponsable(this.id_rec, codResp).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.getResponsables(this.id_rec);
        this.reloadTable();
        this.closeModal();
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
      },
    });
  }

  protected openModalDeleteResponsable(responsable: ResponsableView): void {
    if (this.isCumplida()) {
      return;
    }
    this.responsableEliminar = responsable;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: '¿Estás seguro de eliminar este responsable?',
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR',
    }); 

    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteResponsable(this.responsableEliminar.arers_codigo);
    });
    
    this.subscriptions.push(subscription);
  }
}
