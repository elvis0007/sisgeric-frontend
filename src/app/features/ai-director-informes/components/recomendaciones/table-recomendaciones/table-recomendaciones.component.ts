import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
  OnInit,
} from '@angular/core';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { Recomendacion } from '@features/ai-director-informes/models/Recomendacion';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { RoundPipe } from '@shared/pipe/round.pipe';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';

@Component({
  selector: 'app-table-recomendaciones',
  standalone: true,
  imports: [CommonModule, AbsPipe, StatusColorPipe, RoundPipe, PaginationComponent],
  templateUrl: './table-recomendaciones.component.html',
  styleUrl: './table-recomendaciones.component.css',
})
export class TableRecomendacionesComponent implements OnChanges, OnInit {
  @Input() recomendaciones: Recomendacion[] = [];

  private readonly modalResponsablesSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedRecomendaciones: Recomendacion[] = [];
  // Variables para ordenamiento
  protected ordenNumeroAscendente: boolean = true;
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  protected originalOrder: Recomendacion[] = [];

  ngOnInit(): void {
    // Si ya hay recomendaciones al inicializar, aplicamos el ordenamiento por defecto
    if (this.recomendaciones && this.recomendaciones.length > 0) {
      this.ordenarPorFechaInicial();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recomendaciones'] && changes['recomendaciones'].currentValue) {
      // Guardar una copia del orden original al recibir nuevos datos
      this.originalOrder = [...this.recomendaciones];
      // Aplicar ordenamiento por defecto (fechas más recientes primero)
      this.ordenarPorFechaInicial();
      this.reloadTable();
    }
  }

  private ordenarPorFechaInicial(): void {
    if (!this.recomendaciones || this.recomendaciones.length === 0) return;
    
    // Ordenamiento descendente por defecto (de más reciente a más antiguo)
    this.recomendaciones.sort((a, b) => {
      const fechaA = new Date(a.arere_fecha_maxima).getTime();
      const fechaB = new Date(b.arere_fecha_maxima).getTime();
      return fechaB - fechaA;
    });
  }

  reloadTable(): void {
    this.updateDisplayedRecomendaciones();
  }

  private updateDisplayedRecomendaciones(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedRecomendaciones = this.recomendaciones.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected openModalResponsable(recomendacion: Recomendacion): void {
    this.modalResponsablesSrv.openModal(recomendacion.arere_codigo);
  }

  // Método para ordenar por fecha máxima
  protected ordenarPorFecha(): void {
    this.ordenFecha = this.ordenFecha === 'asc' ? 'desc' : 'asc';
    
    // Solo ordenar si hay datos que ordenar
    if (!this.recomendaciones || this.recomendaciones.length === 0) return;

    // Ordenar las recomendaciones según el estado actual
    if (this.ordenFecha === 'asc') {
      // Ordenamiento ascendente (de más antiguo a más reciente)
      this.recomendaciones.sort((a, b) => {
        const fechaA = new Date(a.arere_fecha_maxima).getTime();
        const fechaB = new Date(b.arere_fecha_maxima).getTime();
        return fechaA - fechaB;
      });
    } else {
      // Ordenamiento descendente (de más reciente a más antiguo)
      this.recomendaciones.sort((a, b) => {
        const fechaA = new Date(a.arere_fecha_maxima).getTime();
        const fechaB = new Date(b.arere_fecha_maxima).getTime();
        return fechaB - fechaA;
      });
    }
    
    this.reloadTable();
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedRecomendaciones();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedRecomendaciones();
  }
}
