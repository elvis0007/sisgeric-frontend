import { Component, ViewChild } from '@angular/core';
import { TableBitacoraComponent } from '@features/ai-seg-bitacora/components/table-bitacora/table-bitacora.component';
import {
  Bitacora
} from '@features/ai-seg-bitacora/models/bitacora';
import { BitacoraService } from '@features/ai-seg-bitacora/services/bitacora.service';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { SearchFilterComponent } from '@features/ai-seg-bitacora/components/search-filter/search-filter.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-list-bitacora',
  standalone: true,
  imports: [
    TableBitacoraComponent,
    BreadcrumbsComponent,
    SearchFilterComponent,
    CommonModule,
  ],
  templateUrl: './list-bitacora.component.html',
  styleUrl: './list-bitacora.component.css',
})
export class ListBitacoraComponent {
  @ViewChild(TableBitacoraComponent) tableComponent!: TableBitacoraComponent;

  protected bitacora: Bitacora[] = [];
  protected itemsPerPage: number = 10;
  protected isLoading = false;

  constructor(private bitacoraSrv: BitacoraService) {}

  protected onFilterChange(filteredData: Bitacora[]): void {
    this.bitacora = filteredData;
    if (this.tableComponent) {
      this.tableComponent.updateData(filteredData);
      this.isLoading = false;
    }
  }

  protected onLoadingChange(isLoading: boolean): void {
    this.isLoading = isLoading;
  }

  protected exportData(): void {
    if (this.bitacora.length > 0) {
      this.bitacoraSrv.exportToExcel(this.bitacora);
    }
  }
}
