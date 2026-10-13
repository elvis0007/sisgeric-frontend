import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Hallazgo } from '@features/ai-seguim-auditor-operativo/models/hallazgo';
import { HallazgosService } from '@features/ai-seguim-auditor-operativo/services/hallazgos/hallazgos.service';
import { ModalFormService } from '@features/ai-seguim-auditor-operativo/services/hallazgos/modal-form.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-table-hallazgos',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './table-hallazgos.component.html',
  styleUrl: './table-hallazgos.component.css',
})
export class TableHallazgosComponent implements OnChanges, OnDestroy {
  @Input() reloadTable!: () => void;
  @Input() hallazgos: Hallazgo[] = [];
  @Output() openModal = new EventEmitter<Hallazgo>();
  protected modalFormSrv: ModalFormService = inject(ModalFormService);
  protected hallazgoSrv: HallazgosService = inject(HallazgosService);
  private readonly router = inject(Router);
  protected readonly auxiliarSrv = inject(AuxiliaryService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];

  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedHallazgos: Hallazgo[] = [];
  private hallazgoEliminar!: Hallazgo;

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hallazgos'] && changes['hallazgos'].currentValue) {
      this.currentPage = 1;
      this.updateDisplayedHallazgos();
    }
  }

  protected isDeleteDisabled(hallazgo: Hallazgo): boolean {
    return (hallazgo?.totalConclusiones ?? 0) > 0;
  }

  protected openModalConf(hallazgo: Hallazgo) {
    if (this.isDeleteDisabled(hallazgo)) {
      this.alertsService.showAlert('No se puede eliminar el hallazgo porque tiene conclusiones registradas', 'error');
      return;
    }
    this.hallazgoEliminar = hallazgo;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de eliminar el hallazgo?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteHallazgo(hallazgo);
    });
    
    this.subscriptions.push(subscription);
  }

  protected editHallazgo(hallazgo: Hallazgo): void {
    this.modalFormSrv.openModal(hallazgo, 'edit');
  }

  protected deleteHallazgo(hallazgo: Hallazgo): void {
    this.hallazgoSrv.deleteHallazgo(hallazgo).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.reloadTable();
      },
      error: (err) => {
        const errorMsg = err?.error?.mensaje || err?.mensaje || err?.message || 'Error al eliminar el hallazgo';
        this.alertsService.showAlert(errorMsg, 'error');
      },
    });
  }

  private updateDisplayedHallazgos(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedHallazgos = this.hallazgos.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedHallazgos();
  }

  protected redireccionPagina(id: number): void {
    const idInf: number = this.auxiliarSrv.getUrlParameter('id_inf');
    
    this.router.navigate([
      'inicio/auditor-operativo/hallazgos', btoa(idInf.toString()), 'conclusiones',
      btoa(id.toString())
    ]).catch(error => {
      console.error('Error en navegación', error);
    });
  }

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarSrv.hasRole(roleIds);
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedHallazgos();
  }
}
