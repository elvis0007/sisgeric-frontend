import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import {
  RecomendacionInforme,
} from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { ModalHistorialService } from '@features/ai-seguim-recomendaciones/services/modal-historial.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';

@Component({
  selector: 'app-table-recomendaciones',
  standalone: true,
  imports: [CommonModule, AbsPipe, StatusColorPipe, PaginationComponent],
  templateUrl: './table-recomendaciones.component.html',
  styleUrl: './table-recomendaciones.component.css',
})
export class TableRecomendacionesComponent implements OnInit, OnChanges {
  @Input() reloadTable!: () => void;
  @Input() recomendaciones: RecomendacionInforme[] = [];
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedIRecomendaciones: RecomendacionInforme[] = [];
  // Comenzamos con orden descendente
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  private originalOrder: RecomendacionInforme[] = [];
  protected targetArereId: number | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly modalResponsablesSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );

  private readonly modalHistorialSrv: ModalHistorialService = inject(
    ModalHistorialService
  );

  private readonly filterStateService = inject(FilterStateService);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.targetArereId = params['arere'] ? Number(params['arere']) : null;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recomendaciones'] && changes['recomendaciones'].currentValue) {
      // Solo ordenamos si estamos recibiendo un array de recomendaciones con datos
      if (this.recomendaciones && this.recomendaciones.length > 0) {
        // Guardar una copia del orden original al recibir nuevos datos
        this.originalOrder = [...this.recomendaciones];
        // Aplicar el ordenamiento descendente por defecto
        this.ordenFecha = 'asc';
        this.aplicarOrdenamiento();
      }

      const savedState = this.filterStateService.getFilters('seguim_recomendaciones');
      if (savedState && savedState.currentPage) {
        const maxPages = Math.ceil((this.recomendaciones?.length || 0) / this.itemsPerPage) || 1;
        this.currentPage = Math.min(savedState.currentPage, maxPages);
      }
      this.updateDisplayedRecom();
    }
  }

  public clearSelection() {
    this.recomendaciones = [];
  }

  protected ordenarPorFecha(): void {
    // Simplificar: solo alternar entre asc y desc
    this.ordenFecha = this.ordenFecha === 'desc' ? 'asc' : 'desc';

    // Aplicar el ordenamiento basado en el nuevo estado
    this.aplicarOrdenamiento();

    // Actualizar la visualización
    this.currentPage = 1;
    this.updateDisplayedRecom();
  }

  protected ordenarPorNumRec(): void {
    // Alternar entre asc y desc
    this.ordenFecha = this.ordenFecha === 'asc' ? 'desc' : 'asc';
    this.aplicarOrdenamientoNumRec();
    // Actualizar la visualización
    this.currentPage = 1;
    this.updateDisplayedRecom();
  }

  private aplicarOrdenamientoNumRec() {
    this.recomendaciones.sort((a, b) => {
      const numRecA = a.recomendaciones.arere_num_rec;
      const numRecB = b.recomendaciones.arere_num_rec;

      if (this.ordenFecha === 'asc') {
        return numRecA - numRecB;
      } else {
        return numRecB - numRecA;
      }
    });
  }

  private aplicarOrdenamiento(): void {
    // Solo ordenar si hay datos que ordenar
    if (!this.recomendaciones || this.recomendaciones.length === 0) return;

    // Ordenar las recomendaciones según el estado actual
    if (this.ordenFecha === 'asc') {
      // Ordenamiento ascendente (de más antiguo a más reciente)
      this.recomendaciones.sort((a, b) => {
        const fechaA = new Date(a.recomendaciones.arere_fecha_maxima).getTime();
        const fechaB = new Date(b.recomendaciones.arere_fecha_maxima).getTime();
        return fechaA - fechaB;
      });
    } else {
      // Ordenamiento descendente (de más reciente a más antiguo)
      this.recomendaciones.sort((a, b) => {
        const fechaA = new Date(a.recomendaciones.arere_fecha_maxima).getTime();
        const fechaB = new Date(b.recomendaciones.arere_fecha_maxima).getTime();
        return fechaB - fechaA;
      });
    }
  }

  private updateDisplayedRecom(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedIRecomendaciones = this.recomendaciones.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  public updateData(newData: RecomendacionInforme[]): void {
    this.recomendaciones = newData;
    const savedState = this.filterStateService.getFilters('seguim_recomendaciones');
    if (savedState && savedState.currentPage) {
      const maxPages = Math.ceil((this.recomendaciones?.length || 0) / this.itemsPerPage) || 1;
      this.currentPage = Math.min(savedState.currentPage, maxPages);
    } else {
      this.currentPage = 1;
    }
    this.ordenFecha = 'desc';
    // Guardar una copia del orden original
    this.originalOrder = [...newData];

    // Aplicar ordenamiento por defecto a los nuevos datos
    this.aplicarOrdenamiento();
    this.updateDisplayedRecom();
  }

  protected openModal(recomendacion: RecomendacionInforme): void {
    this.modalResponsablesSrv.openModal(
      recomendacion.recomendaciones.arere_codigo
    );
  }

  protected openHistorial(recomendacion: RecomendacionInforme): void {
    this.modalHistorialSrv.openModal({
      id_rec: recomendacion.recomendaciones.arere_codigo,
      numRec: recomendacion.recomendaciones.arere_num_rec,
      descripcion: recomendacion.recomendaciones.arere_descripcion,
      memorando: recomendacion.ainin_memorando,
      tituloInforme: recomendacion.ainin_titulo,
      lista_responsables: recomendacion.lista_responsables,
      auditor: recomendacion.ainin_usuario
    });
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    const currentState = this.filterStateService.getFilters('seguim_recomendaciones') || {};
    this.filterStateService.setFilters('seguim_recomendaciones', { ...currentState, currentPage: page });
    this.updateDisplayedRecom();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    const currentState = this.filterStateService.getFilters('seguim_recomendaciones') || {};
    this.filterStateService.setFilters('seguim_recomendaciones', { ...currentState, currentPage: 1 });
    this.updateDisplayedRecom();
  }
}
