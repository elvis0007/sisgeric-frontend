import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
})
export class PaginationComponent implements OnChanges {
  @Input() totalItems: number = 0;
  @Input() itemsPerPage: number = 5;
  @Input() currentPage: number = 1;
  @Output() pageChange = new EventEmitter<number>();
  @Output() itemsPerPageChange = new EventEmitter<number>();

  protected pages: (number | string)[] = [];
  protected totalPages: number = 0;
  @Input() rowsPerPageOptions: number[] = [5, 10, 15];

  // Método para usar en la plantilla
  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['totalItems'] || changes['itemsPerPage'] || changes['currentPage']) {
      this.updatePagination();
    }
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.pages = this.generatePageArray(this.totalPages);
  }

  generatePageArray(totalPages: number): (number | string)[] {
    const pageArray: (number | string)[] = [];

    if (totalPages <= this.itemsPerPage) {
      // Si hay pocas páginas, mostrar todas
      for (let i = 1; i <= totalPages; i++) {
        pageArray.push(i);
      }
    } else {
      // Siempre mostrar la primera página
      pageArray.push(1);
      const left = Math.max(this.currentPage - 1, 2);
      const right = Math.min(this.currentPage + 1, totalPages - 1);
      // Agregar "..." si las páginas intermedias no son consecutivas
      if (left > 2) {
        pageArray.push('...');
      }
      // Mostrar las páginas alrededor de la página actual
      for (let i = left; i <= right; i++) {
        pageArray.push(i);
      }
      // Agregar "..." si las páginas intermedias no son consecutivas
      if (right < totalPages - 1) {
        pageArray.push('...');
      }

      // Siempre mostrar la última página
      pageArray.push(totalPages);
    }

    return pageArray;
  }

  changePage(page: number | string): void {
    if (typeof page === 'number') {
      this.currentPage = page;
      this.pageChange.emit(page);
      this.updatePagination();
    } else if (page === '...') {
      // Expande las páginas si se hace clic en los puntos suspensivos
      this.expandPages();
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.pageChange.emit(this.currentPage);
      this.updatePagination();
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.pageChange.emit(this.currentPage);
      this.updatePagination();
    }
  }

  changeItemsPerPage(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const newValue = parseInt(selectElement.value, 10);
    
    if (newValue !== this.itemsPerPage) {
      this.itemsPerPage = newValue;
      this.currentPage = 1; // Resetear a la primera página
      this.itemsPerPageChange.emit(newValue);
      this.updatePagination();
    }
  }

  private expandPages(): void {
    const visiblePages = 5;

    const left = Math.max(this.currentPage - visiblePages, 1);
    const right = Math.min(this.currentPage + visiblePages, this.totalPages);

    const pageArray: (number | string)[] = [];

    for (let i = left; i <= right; i++) {
      pageArray.push(i);
    }

    this.pages = pageArray;
  }
}