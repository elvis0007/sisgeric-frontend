import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { SearchFilterComponent } from '@features/ai-director-departamental/components/search-filter/search-filter.component';
import { TableSolicitudesComponent } from '@features/ai-director-departamental/components/table-solicitudes/table-solicitudes.component';
import { Solicitud } from '@features/ai-director-departamental/models/solicitud';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { ModalAtenderSolicitudDirectorComponent } from '@features/ai-director-departamental/components/modal-atender-solicitud/modal-atender-solicitud.component';

@Component({
  selector: 'app-list-director-depart',
  standalone: true,
  imports: [
    CommonModule,
    BreadcrumbsComponent,
    SearchFilterComponent,
    TableSolicitudesComponent,
    ModalAtenderSolicitudDirectorComponent,
  ],
  templateUrl: './list-director-depart.component.html',
  styleUrl: './list-director-depart.component.css',
})
export class ListDirectorDepartComponent {
  @ViewChild(TableSolicitudesComponent)
  tableComponent!: TableSolicitudesComponent;
  @ViewChild(SearchFilterComponent)
  searchFilterComponent!: SearchFilterComponent;

  protected selectedSolicitudes: Solicitud[] = [];
  protected solicitudes: Solicitud[] = [];
  protected isLoading = false;

  protected onSelectionChange(selected: Solicitud[]): void {
    this.selectedSolicitudes = selected;
  }

  protected onFilterChange(filteredData: Solicitud[]): void {
    this.isLoading = true;
    this.solicitudes = filteredData;
    if (this.tableComponent && this.solicitudes) {
      this.tableComponent.updateData(filteredData);
      this.isLoading = false;
    } else {
      this.isLoading = false;
    }
  }

  protected onLoadingChange(isLoading: boolean): void {
    this.isLoading = isLoading;
  }

  // Método para recargar la tabla desde el hijo
  reloadTable(): void {
    this.selectedSolicitudes = [];
    if (this.tableComponent) {  
      this.tableComponent.clearSelection();
    }
    setTimeout(() => {
      if (this.searchFilterComponent) {
        this.isLoading = true;
        this.searchFilterComponent.reloadTable();
      }
    });
  }
}
