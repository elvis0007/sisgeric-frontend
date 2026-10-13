import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Bitacora } from '@features/ai-seg-bitacora/models/bitacora';

@Component({
  selector: 'app-table-bitacora',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './table-bitacora.component.html',
  styleUrl: './table-bitacora.component.css',
})
export class TableBitacoraComponent implements OnChanges {
  @Input() bitacora: Bitacora[] = []; 
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedBitacora: Bitacora[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bitacora'] && changes['bitacora'].currentValue) {
      this.updateDisplayedBitacora();
    }
  }

  private updateDisplayedBitacora(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedBitacora = this.bitacora.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  public updateData(newData: Bitacora[]): void {
    this.bitacora = newData;
    this.currentPage = 1;
    this.updateDisplayedBitacora();
  }

  public clearSelection(): void {
    this.bitacora = [];
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedBitacora();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedBitacora();
  }
}
