import { CommonModule } from '@angular/common';
import {
  Component,
  effect,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ResponsableInfo } from '@features/ai-seguim-auditor-operativo/models/responsable';
import { FilterResponsablesComponent } from '@features/ai-seguim-auditor-operativo/components/conclusiones/filter-responsables/filter-responsables.component';
import { ModalAddResponsablesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/modal-add-responsables.service';
import { AlertsStateService } from '@core/services/alerts-state.service';
@Component({
  selector: 'app-table-responsables',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterResponsablesComponent, PaginationComponent],
  templateUrl: './table-responsables.component.html',
  styleUrl: './table-responsables.component.css',
})
export class TableResponsablesComponent implements OnChanges {
  @Input() responsables: ResponsableInfo[] = [];
  @Output() responsablesSelected = new EventEmitter<ResponsableInfo[]>(); // Para enviar los responsables asignados
  protected modalAddResponsSrv: ModalAddResponsablesService = inject(
    ModalAddResponsablesService
  );
  protected readonly alertsService = inject(AlertsStateService);
  protected searchQuery: string = '';
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;

  protected displayedResponsables: ResponsableInfo[] = [];
  protected filteredResponsables: ResponsableInfo[] = [];
  protected operationType: 'assing' | 'replace' = 'assing';
  protected isSubmitting = false;

  constructor() {
    effect(() => {
      this.operationType = this.modalAddResponsSrv.getOperationType();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.isSubmitting = false;
    if (changes['responsables'] && changes['responsables'].currentValue) {
      // Map responsables while preserving selection state
      this.filteredResponsables = this.responsables.map((responsable) => ({
        ...responsable,
        // Preserve selection if previously selected, assigned, or in current selection
        selected:
          this.filteredResponsables?.find(
            (r) => r.CODIGO === responsable.CODIGO
          )?.selected ||
          responsable.selected ||
          responsable.isAssigned ||
          false,
      }));
      this.updateDisplayedResponsables();
      this.searchQuery = '';
    }
  }

  protected toSendResponsables() {
    if (this.isSubmitting) {
      return;
    }
    if (this.operationType === 'assing') {
      this.assignResponsables();
    } else {
      this.replaceResponsable();
    }
  }

  private assignResponsables() {
    // Filtrar solo los responsables seleccionados, excluyendo los ya asignados
    const selectedResponsables = this.displayedResponsables.filter(
      (r) => r.selected && !r.isAssigned
    );

    // Si no hay nuevos responsables seleccionados, muestra una alerta
    if (selectedResponsables.length === 0) {
      this.alertsService.showAlert(
        'Seleccione al menos un responsable',
        'warning'
      );
      return;
    }

    this.isSubmitting = true;
    // Emitir al padre los responsables seleccionados
    this.responsablesSelected.emit(selectedResponsables);
  }

  private replaceResponsable() {
    const selectedResponsable = this.displayedResponsables.filter(
      (r) => r.selected && !r.isAssigned
    );

    // Si no hay nuevos responsables seleccionados, muestra una alerta
    if (selectedResponsable.length === 0) {
      this.alertsService.showAlert(
        'Seleccione al menos un responsable',
        'warning'
      );
      return;
    }

    if (selectedResponsable.length > 1) {
      this.alertsService.showAlert(
        'Seleccione solo un responsable',
        'warning'
      );
      return;
    }

    this.isSubmitting = true;
    // Emitir al padre el responsable seleccionado
    this.responsablesSelected.emit(selectedResponsable);
  }

  protected onFilterChanged(filter: { departamento: string; search: string }) {
    // Primero filtrar por departamento
    let filteredByDepartamento = this.responsables;
    if (filter.departamento) {
      filteredByDepartamento = this.responsables.filter(
        (responsable) => responsable.DEPARTAMENTO === filter.departamento
      );
    }

    // Luego filtrar por búsqueda si hay término de búsqueda
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase().trim();
      this.filteredResponsables = filteredByDepartamento.filter(
        (responsable) =>
          responsable.CARGO.toLowerCase().includes(searchTerm) ||
          `${responsable.NOMBRES} ${responsable.APELLIDOS}`
            .toLowerCase()
            .includes(searchTerm)
      );
    } else {
      this.filteredResponsables = filteredByDepartamento;
    }

    // Resetear a la primera página cuando se aplica un filtro
    this.currentPage = 1;
    this.updateDisplayedResponsables();
  }

  private updateDisplayedResponsables(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedResponsables = this.filteredResponsables.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedResponsables();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedResponsables();
  }
}
