import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Conclusion } from '@features/ai-seguim-auditor-operativo/models/conclusion';
import { ConclusionesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/conclusiones.service';
import { ModalFormService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/modal-form.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-table-conclusiones',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './table-conclusiones.component.html',
  styleUrl: './table-conclusiones.component.css',
})
export class TableConclusionesComponent implements OnChanges, OnDestroy {
  @Input() reloadTable!: () => void;
  @Input() conclusiones: Conclusion[] = [];
  private readonly router = inject(Router);
  private conclusionEliminar!: Conclusion;
  protected readonly auxiliarSrv = inject(AuxiliaryService);
  protected readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];
  
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedConclusiones: Conclusion[] = [];
  protected modalFormSrv: ModalFormService = inject(ModalFormService);
  protected conclusionSrv: ConclusionesService = inject(ConclusionesService);

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conclusiones'] && changes['conclusiones'].currentValue) {
      this.currentPage = 1;
      this.updateDisplayedConclusiones();
    }
  }

  private updateDisplayedConclusiones(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedConclusiones = this.conclusiones.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedConclusiones();
  }

  protected editConclusion(conclusino: Conclusion): void {
    this.modalFormSrv.openModal(conclusino, 'edit');
  }
  
  protected isDeleteDisabled(conclusion: Conclusion): boolean {
    return (conclusion?.totalRecomendaciones ?? 0) > 0;
  }
  
  protected openModalConf(conclusion: Conclusion) {
    if (this.isDeleteDisabled(conclusion)) {
      this.alertsService.showAlert('No se puede eliminar la conclusión porque tiene recomendaciones registradas', 'error');
      return;
    }
    this.conclusionEliminar = conclusion;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de eliminar la conclusión?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteConclusion(conclusion);
    });
    
    this.subscriptions.push(subscription);
  }

  protected deleteConclusion(conclusion: Conclusion): void {
    this.conclusionSrv.deleteConclusion(conclusion).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.reloadTable();
      },
      error: (err) => {
        const errorMsg = err?.error?.mensaje || err?.mensaje || err?.message || 'Error al eliminar la conclusión';
        this.alertsService.showAlert(errorMsg, 'error');
      },
    });
  }

  protected redireccionPagina(id: number): void {
    const idHall: number = this.auxiliarSrv.getUrlParameter('id_inf');
    const idCon: number = this.auxiliarSrv.getUrlParameter('id_hal');
   
    this.router
      .navigate([
        'inicio/auditor-operativo/hallazgos',
        btoa(idHall.toString()),
        'conclusiones',
        btoa(idCon.toString()),
        'recomendaciones',
        btoa(id.toString()),
      ])
      .catch((error) => {
        console.error('Error en navegación', error);
      });
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedConclusiones();
  }
}
