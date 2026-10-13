import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnChanges,
  OnInit,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ModalFormComponent } from '@features/ai-seg-configuracion/components/tipo-informe/modal-form/modal-form.component';
import {
  TipoInforme,
  TipoInformeWrite,
} from '@features/ai-seg-configuracion/models/Tipo-Informe';
import { ModalTipoInformeService } from '@features/ai-seg-configuracion/services/tipo-informe/modal-tipo-informe.service';
import { TipoInformeService } from '@features/ai-seg-configuracion/services/tipo-informe/tipo-informe.service';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-table-tipo-informe',
  standalone: true,
  imports: [CommonModule, ModalFormComponent, PaginationComponent],
  templateUrl: './table-tipo-informe.component.html',
  styleUrl: './table-tipo-informe.component.css',
})
export class TableTipoInformeComponent implements OnChanges, OnInit, OnDestroy {
  protected modalService: ModalTipoInformeService = inject(ModalTipoInformeService);
  protected readonly tipoInformeSrv: TipoInformeService = inject(
    TipoInformeService
  );
  protected readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];
  
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected tipoInformes: TipoInforme[] = [];
  protected displayedTipoInformes: TipoInforme[] = [];
  private tipoInformeEliminar!: TipoInforme;
  protected isLoading = false;

  ngOnInit(): void {
    this.getDataTiposInformes();
  }
  
  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tipoInformes'] && changes['tipoInformes'].currentValue) {
      this.updateDisplayedTipoInformes();
    }
  }

  private updateDisplayedTipoInformes(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedTipoInformes = this.tipoInformes.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  private getDataTiposInformes(): void {
    this.isLoading = true;
    this.tipoInformeSrv.getTiposInformes().subscribe({
      next: (response: ResponseReadMultiple<TipoInforme>) => {
        this.tipoInformes = response.datos;
        this.updateTable();
        this.isLoading = false;
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al obtener la información', 'error');
        this.isLoading = false;
      },
    });
  }

  private updateTable(): void {
    this.updateDisplayedTipoInformes();
  }

  reloadTable() {
    this.getDataTiposInformes();
  }

  protected openModalForm(tipoInf: TipoInformeWrite | null) {
    if (tipoInf === null) {
      this.modalService.openModal(null);
    } else {
      this.modalService.openModal(tipoInf, 'edit');
    }
  }

  protected openModalConf(tipoInf: TipoInforme) {
    this.tipoInformeEliminar = tipoInf;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de eliminar el Tipo de Informe ${tipoInf.ainti_descripcion} ?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteTipoInforme(tipoInf);
    });
    
    this.subscriptions.push(subscription);
  }

  protected deleteTipoInforme(tipoInf: TipoInforme): void {
    this.tipoInformeSrv.deleteTipoInforme(tipoInf).subscribe({
      next: (response) => {
        this.reloadTable();
        this.alertsService.showAlert(response.mensaje, 'success');
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
      },
    });
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedTipoInformes();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedTipoInformes();
  }
}
