import { Component, inject, ViewChild, NgZone } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { ModalService } from '@features/ai-seguim-auditor-operativo/services/informes/modal.service';
import { ModalFormComponent } from '@features/ai-seguim-auditor-operativo/components/informes/modal-form/modal-form.component';
import { SearchFilterComponent } from '@features/ai-seguim-auditor-operativo/components/informes/search-filter/search-filter.component';
import { TableInformesComponent } from '@features/ai-seguim-auditor-operativo/components/informes/table-informes/table-informes.component';
import { Informe } from '@features/ai-seguim-auditor-operativo/models/informe';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-list-informes',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    BreadcrumbsComponent,
    TableInformesComponent,
    SearchFilterComponent,
    ModalFormComponent,
  ],
  templateUrl: './list-informes.component.html',
  styleUrl: './list-informes.component.css',
})
export class ListInformesComponent {
  @ViewChild(TableInformesComponent) tableComponent!: TableInformesComponent;
  @ViewChild(SearchFilterComponent) searchFilterComponent!: SearchFilterComponent;
  private readonly ngZone = inject(NgZone);
  protected rutaHijaActiva: boolean = false;
  protected modalService: ModalService = inject(ModalService);
  protected informes: Informe[] = [];
  protected isLoading = false;

  protected onFilterChange(filteredData: Informe[]): void {
    this.isLoading = true;
    this.informes = filteredData;
    if (this.tableComponent && this.informes) {
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
    this.informes = [];
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

  protected openModal(): void {
    this.modalService.openModal(null);
  }

  protected enActivacionRutaHija(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.rutaHijaActiva = true;
      });
    });
  }

  protected enDesactivacionRutaHija(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.rutaHijaActiva = false;
      });
    });
  }
}
