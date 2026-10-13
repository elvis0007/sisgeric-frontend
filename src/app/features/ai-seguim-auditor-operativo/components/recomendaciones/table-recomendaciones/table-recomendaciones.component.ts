import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import {
  Recomendacion,
} from '@features/ai-seguim-auditor-operativo/models/recomendacion';
import { ModalFormRecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/modal-form-recomendaciones.service';
import { ModalResponsablesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/modal-responsables.service';
import { RecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/recomendaciones.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-table-recomendaciones',
  standalone: true,
  imports: [CommonModule, AbsPipe, StatusColorPipe, PaginationComponent],
  templateUrl: './table-recomendaciones.component.html',
  styleUrl: './table-recomendaciones.component.css',
})
export class TableRecomendacionesComponent implements OnChanges, OnDestroy {
  @Input() recomendaciones: Recomendacion[] = [];
  @Input() reloadTable!: () => void;
  @Input() searchTerm: string | null = '';
  private readonly modalResponsablesSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );
  private readonly modalFormRecomendacioSrv: ModalFormRecomendacionesService =
    inject(ModalFormRecomendacionesService);
  private readonly recomendacionSrv: RecomendacionesService = inject(
    RecomendacionesService
  );
  protected readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private readonly filterStateService = inject(FilterStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];
  
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedRecomendaciones: Recomendacion[] = [];
  protected filteredRecomendaciones: Recomendacion[] = [];
  private recomendacionEliminar!: Recomendacion;

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recomendaciones'] && changes['recomendaciones'].currentValue) {
      this.filteredRecomendaciones = [...this.recomendaciones];
      this.filterRecomendaciones();

      const savedState = this.filterStateService.getFilters('seguim_auditor_operativo_rec');
      if (savedState && savedState.currentPage) {
        const maxPages = Math.ceil((this.filteredRecomendaciones?.length || 0) / this.itemsPerPage) || 1;
        this.currentPage = Math.min(savedState.currentPage, maxPages);
      } else {
        this.currentPage = 1;
      }
      this.updateDisplayedRecomendaciones();
    }
    
    if (changes['searchTerm']) {
      this.filterRecomendaciones();
      if (!changes['searchTerm'].firstChange) {
        this.currentPage = 1;
      }
      this.updateDisplayedRecomendaciones();
    }
  }

  private filterRecomendaciones(): void {
    if (!this.searchTerm || !this.searchTerm.trim()) {
      this.filteredRecomendaciones = [...this.recomendaciones];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredRecomendaciones = this.recomendaciones.filter(recomendacion => {
        const descripcion = String(recomendacion.arere_descripcion).toLowerCase();
        const numRec = String(recomendacion.arere_num_rec);
        return descripcion.includes(term) || numRec.includes(term);
      });
    }
  }

  protected isCumplida(recomendacion: Recomendacion): boolean {
    return recomendacion?.estado_seguimiento?.arees_descripcion === 'CUMPLIDA';
  }

  protected verRiesgo(recomendacion: Recomendacion): void {
    this.router.navigate(['riesgo', btoa(String(recomendacion.arere_codigo))], {
      relativeTo: this.route,
    });
  }

  protected openModal(recomendacion: Recomendacion): void {
    this.modalResponsablesSrv.openModal(
      recomendacion.arere_codigo,
      this.isCumplida(recomendacion)
    );
  }

  protected openModalConf(recomendacion: Recomendacion) {
    if (this.isCumplida(recomendacion)) {
      return;
    }
    this.recomendacionEliminar = recomendacion;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de eliminar la recomendación?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteConclusion(this.recomendacionEliminar);
    });
    
    this.subscriptions.push(subscription);
  }

  protected deleteConclusion(recomendacion: Recomendacion): void {
    this.recomendacionSrv.deleteRecomendacion(recomendacion).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.reloadTable();
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
      },
    });
  }

  private updateDisplayedRecomendaciones(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedRecomendaciones = this.filteredRecomendaciones.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    const currentState = this.filterStateService.getFilters('seguim_auditor_operativo_rec') || {};
    this.filterStateService.setFilters('seguim_auditor_operativo_rec', { ...currentState, currentPage: page });
    this.updateDisplayedRecomendaciones();
  }

  protected editRecomendacion(recomendacion: Recomendacion): void {
    if (this.isCumplida(recomendacion)) {
      return;
    }
    this.modalFormRecomendacioSrv.openModal(recomendacion, 'edit');
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    const currentState = this.filterStateService.getFilters('seguim_auditor_operativo_rec') || {};
    this.filterStateService.setFilters('seguim_auditor_operativo_rec', { ...currentState, currentPage: 1 });
    this.updateDisplayedRecomendaciones();
  }
}
