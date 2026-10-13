import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import {
  Recomendacion,
} from '@features/ai-seguim-auditor-general/models/recomendacion-ag';
import { ModalResponsablesAgService } from '@features/ai-seguim-auditor-general/services/recomendaciones-ag/modal-responsables-ag.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';

@Component({
  selector: 'app-table-recomendaciones-ag',
  standalone: true,
  imports: [CommonModule, AbsPipe, StatusColorPipe, PaginationComponent],
  templateUrl: './table-recomendaciones-ag.component.html',
  styleUrl: './table-recomendaciones-ag.component.css',
})
export class TableRecomendacionesAgComponent implements OnChanges {
  @Input() recomendaciones: Recomendacion[] = [];
  @Input() searchTerm: string | null = '';
  private readonly modalResponsablesSrv: ModalResponsablesAgService = inject(
    ModalResponsablesAgService
  );
  private readonly filterStateService = inject(FilterStateService);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected verRiesgo(recomendacion: Recomendacion): void {
    this.router.navigate(['riesgo', btoa(String(recomendacion.arere_codigo))], {
      relativeTo: this.route,
    });
  }

  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedRecomendaciones: Recomendacion[] = [];
  protected filteredRecomendaciones: Recomendacion[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recomendaciones'] && changes['recomendaciones'].currentValue) {
      this.filteredRecomendaciones = [...this.recomendaciones];
      this.filterRecomendaciones();

      const savedState = this.filterStateService.getFilters('seguim_auditor_general_rec');
      if (savedState && savedState.currentPage) {
        const maxPages = Math.ceil((this.filteredRecomendaciones?.length || 0) / this.itemsPerPage) || 1;
        this.currentPage = Math.min(savedState.currentPage, maxPages);
      } else {
        this.currentPage = 1;
      }
      this.updateDisplayedRecomendaciones();
    }
    
    if (changes['searchTerm']) {
      this.filterRecomendaciones();
      if (!changes['searchTerm'].firstChange) {
        this.currentPage = 1;
      }
      this.updateDisplayedRecomendaciones();
    }
  }

  private filterRecomendaciones(): void {
    if (!this.searchTerm || !this.searchTerm.trim()) {
      this.filteredRecomendaciones = [...this.recomendaciones];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredRecomendaciones = this.recomendaciones.filter(recomendacion => {
        const descripcion = String(recomendacion.arere_descripcion).toLowerCase();
        return descripcion.includes(term);
      });
    }
  }

  reloadTable(): void {
    this.filterRecomendaciones();
    this.updateDisplayedRecomendaciones();
  }

  protected openModal(recomendacion: Recomendacion): void {
    this.modalResponsablesSrv.openModal(recomendacion.arere_codigo);
  }

  private updateDisplayedRecomendaciones(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedRecomendaciones = this.filteredRecomendaciones.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    const currentState = this.filterStateService.getFilters('seguim_auditor_general_rec') || {};
    this.filterStateService.setFilters('seguim_auditor_general_rec', { ...currentState, currentPage: page });
    this.updateDisplayedRecomendaciones();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    const currentState = this.filterStateService.getFilters('seguim_auditor_general_rec') || {};
    this.filterStateService.setFilters('seguim_auditor_general_rec', { ...currentState, currentPage: 1 });
    this.updateDisplayedRecomendaciones();
  }
}
