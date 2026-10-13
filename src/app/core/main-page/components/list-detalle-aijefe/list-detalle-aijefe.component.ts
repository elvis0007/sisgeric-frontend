import {
  Component,
  inject,
  OnInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartListAiJefe } from '@core/main-page/models/dashboards';
import { DashboardsService } from '@core/services/dashboards.service';
@Component({
  selector: 'app-list-detalle-aijefe',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-detalle-aijefe.component.html',
  styleUrl: './list-detalle-aijefe.component.css',
})
export class ListDetalleAijefeComponent implements OnInit {
  protected readonly dashboardSrv: DashboardsService =
    inject(DashboardsService);
  protected chartList?: ChartListAiJefe;

  // Arrays para datos de la lista
  protected departamentos: string[] = [];
  protected selectedDepartamentos: string[] = [];
  protected showDropdown: boolean = false;
  protected searchTerm: string = '';
  protected totalItems: number = 0;
  protected totalPages: number = 0;
  protected currentPage: number = 1;
  protected itemsPerPage: number = 10;
  protected pages: (number | string)[] = [];
  protected displayedChartList: any[] = [];
  protected dataChartList: any[] = [];
  protected isLoading = false;

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      this.showDropdown = false;
    }
  }

  ngOnInit(): void {
    this.getListDetalle();
  }

  private getListDetalle(): void {
    this.isLoading = true;
    this.dashboardSrv.getListDetalleAiJefe().subscribe(
      (response) => {
        if (response && response.datos) {
          this.chartList = response.datos;
          this.extractDepartamentos();
          this.processData();
          this.isLoading = false;
        }
      },
      (error) => {
        this.isLoading = false;
      }
    );
  }

  private extractDepartamentos(): void {
    if (this.chartList?.departamentos) {
      this.departamentos = this.chartList.departamentos.map(
        (depto) => depto.departamento
      );
      
      // Inicialmente seleccionamos todos los departamentos disponibles
      this.selectedDepartamentos = [...this.departamentos];
    }
  }

  private processData(): void {
    if (!this.chartList?.departamentos) return;

    let processedData: any[] = [];

    this.chartList.departamentos.forEach((deptoData) => {
      if (this.selectedDepartamentos.includes(deptoData.departamento)) {
        Object.entries(deptoData.codigoInformes).forEach(
          ([codigo, detalles]) => {
            // Calcular el total de recomendaciones
            const total = 
              (detalles as any).enProceso + 
              (detalles as any).cumplidas + 
              (detalles as any).noAplica + 
              (detalles as any).noCumplidas;
            
            processedData.push({
              departamento: deptoData.departamento,
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

  isDepartamentoSelected(departamento: string): boolean {
    return this.selectedDepartamentos.includes(departamento);
  }

  getSelectionText(): string {
    if (this.selectedDepartamentos.length === 0) {
      return 'Seleccione departamentos';
    } else if (this.selectedDepartamentos.length === this.departamentos.length) {
      return 'Todos los departamentos';
    } else if (this.selectedDepartamentos.length <= 2) {
      return this.selectedDepartamentos.join(', ');
    } else {
      return `${this.selectedDepartamentos.length} departamentos seleccionados`;
    }
  }

  toggleSelectAll(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedDepartamentos = [...this.departamentos];
    } else {
      this.selectedDepartamentos = [];
    }
    this.processData();
  }

  toggleDepartamentoSelection(departamento: string): void {
    if (this.selectedDepartamentos.includes(departamento)) {
      this.selectedDepartamentos = this.selectedDepartamentos.filter((d) => d !== departamento);
    } else {
      this.selectedDepartamentos.push(departamento);
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

  public updateData(newData: any[]): void {
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
