import { CommonModule } from '@angular/common';
import { Component, ViewChild, NgZone, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { SearchFilterComponent } from '@features/ai-rec-verificables/components/informes/search-filter/search-filter.component';
import { TableInformesComponent } from '@features/ai-rec-verificables/components/informes/table-informes/table-informes.component';
import { Informe } from '@features/ai-rec-verificables/models/Informe';

@Component({
  selector: 'app-list-informes',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    BreadcrumbsComponent,
    SearchFilterComponent,
    TableInformesComponent,
  ],
  templateUrl: './list-informes.component.html',
  styleUrl: './list-informes.component.css',
})
export class ListInformesComponent implements OnInit, OnDestroy {
  @ViewChild(TableInformesComponent) tableComponent!: TableInformesComponent;
  @ViewChild(SearchFilterComponent)
  searchFilterComponent!: SearchFilterComponent;
  private ngZone = inject(NgZone);
  private popStateListener: any;

  protected rutaHijaActiva: boolean = false;
  // protected modalService: ModalService = inject(ModalService);
  protected informes: Informe[] = [];
  protected isLoading = false;

  ngOnInit(): void {
    // Agregar listener para el evento popstate (cuando el usuario usa los botones de navegación del navegador)
    this.popStateListener = () => {
      if (!this.rutaHijaActiva) {
        this.reloadTable();
      }
    };
    window.addEventListener('popstate', this.popStateListener);
  }

  ngOnDestroy(): void {
    // Eliminar el listener del evento popstate
    if (this.popStateListener) {
      window.removeEventListener('popstate', this.popStateListener);
    }
  }

  onFilterChange(filteredData: Informe[]): void {
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
    // this.modalService.openModal(null);
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
        // Recargar datos cuando se regresa a esta página
        this.reloadTable();
      });
    });
  }
}
