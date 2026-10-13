import { Component, inject, ViewChild, NgZone } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { Informe } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ModalAsignAuditAgService } from '@features/ai-seguim-auditor-general/services/informes-ag/modal-asign-audit-ag.service';
import { SearchFilterAgComponent } from '@features/ai-seguim-auditor-general/components/informes-ag/search-filter-ag/search-filter-ag.component';
import { TableInformesAgComponent } from '@features/ai-seguim-auditor-general/components/informes-ag/table-informes-ag/table-informes-ag.component';
import { ModalAsignAuditAgComponent } from '@features/ai-seguim-auditor-general/components/informes-ag/modal-asign-audit-ag/modal-asign-audit-ag.component';

@Component({
  selector: 'app-list-informes-ag',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    BreadcrumbsComponent,
    SearchFilterAgComponent,
    TableInformesAgComponent,
    ModalAsignAuditAgComponent
  ],
  templateUrl: './list-informes-ag.component.html',
  styleUrl: './list-informes-ag.component.css',
})
export class ListInformesAgComponent {
  @ViewChild(TableInformesAgComponent) tableComponent!: TableInformesAgComponent;
  @ViewChild(SearchFilterAgComponent)
  searchFilterComponent!: SearchFilterAgComponent;
  private readonly modalSrvAsignAud: ModalAsignAuditAgService = inject(
    ModalAsignAuditAgService
  );
  private readonly ngZone = inject(NgZone);
  protected rutaHijaActiva: boolean = false;
  protected informes: Informe[] = [];
  protected isLoading = false;

  protected selectedInformes: Informe[] = [];

  // Método que se invoca cuando la tabla emite un cambio en la selección
  protected onSelectionChange(selected: Informe[]): void {
    this.selectedInformes = selected;
  }

  protected onFilterChange(filteredData: Informe[]): void {
    this.informes = filteredData;
    
    // Solo intentamos actualizar la tabla si hay datos y el tableComponent existe
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
    this.selectedInformes = [];
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

  protected openModal(): void {
    this.modalSrvAsignAud.openModal(this.selectedInformes);
  }

  protected resetSelected(): void {
    this.tableComponent.clearSelection();
    this.selectedInformes = [];
  }
}
