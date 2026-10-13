import {
  Component,
  inject,
  OnInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartList } from '@core/main-page/models/dashboards';
import { DashboardsService } from '@core/services/dashboards.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-list-detalle-recomend',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-detalle-recomend.component.html',
  styleUrl: './list-detalle-recomend.component.css',
})
export class ListDetalleRecomendComponent implements OnInit {
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  protected readonly dashboardSrv: DashboardsService =
    inject(DashboardsService);
  protected chartList?: ChartList;

  // Arrays para datos de la lista
  protected labelsAnios: string[] = [];
  protected selectedAnios: string[] = [];
  protected showDropdown: boolean = false;
  protected searchTerm: string = '';

  protected currentPage: number = 1;
  protected itemsPerPage: number = 9;
  protected totalItems: number = 0;
  protected totalPages: number = 0;
  protected pages: (number | string)[] = [];
  protected displayedChartList: any[] = [];
  protected dataChartList: ChartList[] = [];
  protected isLoading = false;

  private readonly ROL_DIRECTOR = 5;
  private readonly ROL_RESPONSABLE = 4;
  private readonly MAX_YEARS = 7;

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      this.showDropdown = false;
    }
  }

  ngOnInit(): void {
    const dpto = this.auxiliarySrv.getUserInfo().departamento;
    this.getListDetalle(dpto);
  }

  private getListDetalle(dpto: string): void {
    this.isLoading = true;
    
    // Priorizar rol de director sobre responsable
    if (this.auxiliarySrv.hasRole([this.ROL_DIRECTOR])) {
      this.dashboardSrv.getListDetalleDirector(dpto).subscribe((response) => {
        if (response && response.datos) {
          this.chartList = response.datos;
          this.extractYears();
          this.processData();
          this.isLoading = false;
        }
      }, (error) => {
        this.isLoading = false;
      });
    } else if (this.auxiliarySrv.hasRole([this.ROL_RESPONSABLE])) {
      const userCuenta = this.auxiliarySrv.getUserCuenta();
      this.dashboardSrv
        .getListDetalleResponsable(userCuenta)
        .subscribe((response) => {
          if (response && response.datos) {
            this.chartList = response.datos;
            this.extractYears();
            this.processData();
            this.isLoading = false;
          }
        }, (error) => {
          this.isLoading = false;
        });
    }
  }

  private extractYears(): void {
    if (this.chartList?.anios) {
      // Obtener el año actual
      const currentYear = new Date().getFullYear().toString();
      
      // Filtrar solo los últimos 7 años
      let allYears = this.chartList.anios.map((anio) => anio.anio);
      // Ordenar años en orden descendente (más recientes primero)
      allYears.sort((a, b) => parseInt(b) - parseInt(a));
      
      // Tomar solo los últimos MAX_YEARS años (o menos si no hay suficientes)
      this.labelsAnios = allYears.slice(0, this.MAX_YEARS);
      
      // Inicialmente seleccionamos todos los años disponibles
      this.selectedAnios = [...this.labelsAnios];
    }
  }

  private processData(): void {
    if (!this.chartList?.anios) return;

    let processedData: any[] = [];

    this.chartList.anios.forEach((anioData) => {
      if (this.selectedAnios.includes(anioData.anio)) {
        Object.entries(anioData.codigoInformes).forEach(
          ([codigo, detalles]) => {
            // Calcular el total de recomendaciones
            const total = 
              (detalles as any).enProceso + 
              (detalles as any).cumplidas + 
              (detalles as any).noAplica + 
              (detalles as any).noCumplidas;
            
            processedData.push({
              anio: anioData.anio,
              memorando: codigo,
              ...detalles,
              total: total
            });
          }
        );
      }
    });

    // Aplicar búsqueda si existe término
    if (this.searchTerm) {
      processedData = processedData.filter((item) =>
        item.memorando.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    this.updateData(processedData);
  }

  protected onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.processData();
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  isAnioSelected(anio: string): boolean {
    return this.selectedAnios.includes(anio);
  }

  getSelectionText(): string {
    if (this.selectedAnios.length === 0) {
      return 'Seleccione años';
    } else if (this.selectedAnios.length === this.labelsAnios.length) {
      return 'Todos los años';
    } else if (this.selectedAnios.length <= 2) {
      return this.selectedAnios.join(', ');
    } else {
      return `${this.selectedAnios.length} años seleccionados`;
    }
  }

  toggleSelectAll(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedAnios = [...this.labelsAnios];
    } else {
      this.selectedAnios = [];
    }
    this.processData();
  }

  toggleAnioSelection(anio: string): void {
    if (this.selectedAnios.includes(anio)) {
      this.selectedAnios = this.selectedAnios.filter((a) => a !== anio);
    } else {
      this.selectedAnios.push(anio);
    }
    this.processData();
  }

  private updateDisplayedChartList(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedChartList = this.dataChartList.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  public updateData(newData: ChartList[]): void {
    this.dataChartList = newData;
    this.currentPage = 1;
    this.totalItems = this.dataChartList.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.updateDisplayedChartList();
    this.updatePagination();
  }

  protected changePage(page: number | string): void {
    if (typeof page === 'number') {
      this.currentPage = page;
      this.updateDisplayedChartList();
      this.updatePagination();
    } else if (page === '...') {
      this.expandPages();
    }
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.dataChartList.length / this.itemsPerPage);
    this.totalItems = this.dataChartList.length;
    this.pages = this.generatePageArray(this.totalPages);
  }

  private generatePageArray(totalPages: number): (number | string)[] {
    const visiblePages = 5;
    const pageArray: (number | string)[] = [];

    if (totalPages <= visiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageArray.push(i);
      }
    } else {
      pageArray.push(1);
      const left = Math.max(this.currentPage - 1, 2);
      const right = Math.min(this.currentPage + 1, totalPages - 1);
      if (left > 2) {
        pageArray.push('...');
      }
      for (let i = left; i <= right; i++) {
        pageArray.push(i);
      }
      if (right < totalPages - 1) {
        pageArray.push('...');
      }
      pageArray.push(totalPages);
    }

    return pageArray;
  }

  private expandPages(): void {
    const totalPages = Math.ceil(this.dataChartList.length / this.itemsPerPage);
    const visiblePages = 5;

    const left = Math.max(this.currentPage - visiblePages, 1);
    const right = Math.min(this.currentPage + visiblePages, totalPages);

    const pageArray: (number | string)[] = [];

    for (let i = left; i <= right; i++) {
      pageArray.push(i);
    }

    this.pages = pageArray;
  }

  protected goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateDisplayedChartList();
      this.updatePagination();
    }
  }

  protected goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateDisplayedChartList();
      this.updatePagination();
    }
  }

  protected getTotalItems(): number {
    return this.dataChartList.length;
  }

  protected getTotalPages(): number {
    return Math.ceil(this.getTotalItems() / this.itemsPerPage);
  }

  protected getMinItems(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  // Método para usar en la plantilla
  min(a: number, b: number): number {
    return Math.min(a, b);
  }
}
