import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import {
  ResponsableInfo,
  RoleResponsable,
} from '@features/ai-seguim-auditor-operativo/models/responsable'; 
import { SearchFilterComponent } from '@features/ai-seguim-recomendaciones/components/search-filter/search-filter.component';
import { TableRecomendacionesComponent } from '@features/ai-seguim-recomendaciones/components/table-recomendaciones/table-recomendaciones.component';
import {
  RecomendacionInforme,
} from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { ModalHistorialComponent } from '@features/ai-seguim-recomendaciones/components/modal-historial/modal-historial.component';
import { ModalHistorialService } from '@features/ai-seguim-recomendaciones/services/modal-historial.service';

@Component({
  selector: 'app-list-recomendaciones',
  standalone: true,
  imports: [
    CommonModule,
    BreadcrumbsComponent,
    SearchFilterComponent,
    TableRecomendacionesComponent,
    ModalResponsablesComponent,
    ModalHistorialComponent,
  ],
  templateUrl: './list-recomendaciones.component.html',
  styleUrl: './list-recomendaciones.component.css',
})
export class ListRecomendacionesComponent {
  @ViewChild(SearchFilterComponent)
  searchFilterComponent!: SearchFilterComponent;
  @ViewChild(TableRecomendacionesComponent)
  tableComponent!: TableRecomendacionesComponent;
  protected recomendaciones: RecomendacionInforme[] = [];
  protected readonly modalResponsableSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );
  protected readonly modalHistorialSrv: ModalHistorialService = inject(
    ModalHistorialService
  );

  protected userRolResponsable: RoleResponsable[] = [];
  protected responsablesInfo: ResponsableInfo[] = [];
  protected responsablesFilter: ResponsableInfo[] = [];
  protected selectedResponsables: ResponsableInfo[] = [];

  protected isLoading = false;
  protected isLoadingRespon = false;
  
  protected onFilterChange(filteredData: RecomendacionInforme[]): void {
    this.recomendaciones = filteredData;

    if (this.tableComponent) {
      this.tableComponent.updateData(filteredData);
      this.isLoading = false;
    } 
  }

  protected onLoadingChange(isLoading: boolean): void {
    this.isLoading = isLoading;
  }

  // Método para recargar la tabla desde el hijo
  reloadTable(): void {
    // Limpiamos la selección
    this.recomendaciones = [];
    if (this.tableComponent) {
      this.tableComponent.clearSelection();
    }
    
    // Establecemos loading a true antes de llamar a reloadTable
    setTimeout(() => {
      if (this.searchFilterComponent) {
        this.isLoading = true;
        this.searchFilterComponent.reloadTable();
      }
    });
  }
}
