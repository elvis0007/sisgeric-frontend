import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { SearchFilterComponent } from '@features/ai-rec-solicitudes/components/search-filter/search-filter.component';
import { TableSolicitudesComponent } from '@features/ai-rec-solicitudes/components/table-solicitudes/table-solicitudes.component';
import { Solicitud } from '@features/ai-rec-solicitudes/models/solicitud';
import { ModalAtenderSolicitudAuditorComponent } from '@features/ai-rec-solicitudes/components/modal-atender-solicitud-auditor/modal-atender-solicitud-auditor.component';
import { ModalCrearSolicitudComponent } from '@features/ai-rec-solicitudes/components/modal-crear-solicitud/modal-crear-solicitud.component';
import { ModalCrearSolicitudService } from '@features/ai-rec-solicitudes/services/modal-crear-solicitud.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-list-solicitudes-depart',
  standalone: true,
  imports: [
    CommonModule,
    BreadcrumbsComponent,
    SearchFilterComponent,
    TableSolicitudesComponent,
    ModalAtenderSolicitudAuditorComponent,
    ModalCrearSolicitudComponent,
  ],
  templateUrl: './list-solicitudes.component.html',
  styleUrl: './list-solicitudes.component.css',
})
export class ListSolicitudesDirectorComponent {
  @ViewChild(TableSolicitudesComponent)
  tableComponent!: TableSolicitudesComponent;
  @ViewChild(SearchFilterComponent)
  searchFilterComponent!: SearchFilterComponent;

  protected selectedSolicitudes: Solicitud[] = [];
  protected solicitudes: Solicitud[] = [];
  protected isLoading = false;
  protected modalCrearSrv: ModalCrearSolicitudService = inject(ModalCrearSolicitudService);

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

  protected openCrearSolicitud(): void {
    this.modalCrearSrv.openModal({});
  }
}
