import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnChanges,
  OnInit,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ModalFormComponent } from '@features/ai-seg-configuracion/components/estado-seg/modal-form/modal-form.component';
import {
  EstadoSeguimiento,
  EstadoSegumientoWrite,
} from '@features/ai-seg-configuracion/models/Estado-Seg';
import { EstadoSegService } from '@features/ai-seg-configuracion/services/estado-seg/estado-seg.service';
import { ModalEstadoSegService } from '@features/ai-seg-configuracion/services/estado-seg/modal-estado-seg.service';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-table-estado-seg',
  standalone: true,
  imports: [
    CommonModule,
    ModalFormComponent,
    PaginationComponent,
  ],
  templateUrl: './table-estado-seg.component.html',
  styleUrl: './table-estado-seg.component.css',
})
export class TableEstadoSegComponent implements OnChanges, OnInit, OnDestroy {
  protected readonly alertsService = inject(AlertsStateService);
  protected modalService: ModalEstadoSegService = inject(ModalEstadoSegService);
  protected readonly estadoSegSrv: EstadoSegService = inject(EstadoSegService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];
  
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected estadoSeguimientos: EstadoSeguimiento[] = [];
  protected displayedEstadoSeguim: EstadoSeguimiento[] = [];
  private estadoSegEliminar!: EstadoSeguimiento;
  protected isLoading = false;
  
  ngOnInit(): void {
    this.getDataEstadoSeguimiento();
  }
  
  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['estadoSeguimientos'] &&
      changes['estadoSeguimientos'].currentValue
    ) {
      this.updateDisplayedEstadoSeg();
    }
  }

  private updateDisplayedEstadoSeg(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedEstadoSeguim = this.estadoSeguimientos.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  private getDataEstadoSeguimiento(): void {
    this.isLoading = true;
    this.estadoSegSrv.getEstadoSeguimiento().subscribe({
      next: (response: ResponseReadMultiple<EstadoSeguimiento>) => {
        this.estadoSeguimientos = response.datos;
        this.isLoading = false;
        this.uploadTable(); // Actualizamos la tabla después de obtener los datos
      },
      error: () => {
        this.alertsService.showAlert('Error al obtener la información', 'error');
        this.isLoading = false;
      },
    });
  }

  private uploadTable(): void {
    this.updateDisplayedEstadoSeg();
  }

  reloadTable() {
    this.getDataEstadoSeguimiento();
  }

  protected openModalForm(estadoSeg: EstadoSegumientoWrite | null) {
    if (estadoSeg === null) {
      this.modalService.openModal(null);
    } else {
      this.modalService.openModal(estadoSeg, 'edit');
    }
  }

  protected openModalConf(estadoSeg: EstadoSeguimiento) {
    this.estadoSegEliminar = estadoSeg;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de eliminar el estado de seguimiento ${estadoSeg.arees_descripcion} ?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteEstadoSeg(estadoSeg);
    });
    
    this.subscriptions.push(subscription);
  }

  protected deleteEstadoSeg(estadoSeg: EstadoSeguimiento): void {
    this.estadoSegSrv.deleteEstadoSeguimiento(estadoSeg).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.reloadTable();
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
      },
    });
  }
  
  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedEstadoSeg();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedEstadoSeg();
  }
}
