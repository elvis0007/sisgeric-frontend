import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { ModalAddResponsablesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/modal-add-responsables.service';
import { TableResponsablesComponent } from '@features/ai-seguim-auditor-operativo/components/conclusiones/table-responsables/table-responsables.component';
import { ResponsableInfo } from '@features/ai-seguim-auditor-operativo/models/responsable';
import { FilterResponsablesComponent } from '@features/ai-seguim-auditor-operativo/components/conclusiones/filter-responsables/filter-responsables.component';

@Component({
  selector: 'app-modal-add-responsables',
  standalone: true,
  imports: [CommonModule, TableResponsablesComponent],
  templateUrl: './modal-add-responsables.component.html',
  styleUrl: './modal-add-responsables.component.css'
})
export class ModalAddResponsablesComponent {
  @Input() responsables: ResponsableInfo[] = [];
  @Output() codResponOld: string = '';
  @Output() responsablesSelected = new EventEmitter<ResponsableInfo[]>();
  @ViewChild(FilterResponsablesComponent) filterComponent?: FilterResponsablesComponent;

  protected modalAddResponsSrv: ModalAddResponsablesService = inject(
    ModalAddResponsablesService
  );

  protected onResponsablesSelected(responsables: ResponsableInfo[]) {
    // Emitir al padre y cerrar modal
    this.responsablesSelected.emit(responsables);
    this.closeModal();
  }

  // Cierra el modal al completar
  protected closeModal(): void {
    this.modalAddResponsSrv.closeModal();
    this.responsables = [];
    // Solo ejecutar resetFilters si el componente existe
    if (this.filterComponent) {
      this.filterComponent.resetFilters();
    }
  }
}
