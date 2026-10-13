import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Informe } from '@features/ai-rec-verificables/models/Informe';
import { FilterStateService } from '@core/services/filter-state.service';
import { RoundPipe } from '@shared/pipe/round.pipe';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-table-informes',
  standalone: true,
  imports: [CommonModule, RoundPipe, PaginationComponent],
  templateUrl: './table-informes.component.html',
  styleUrl: './table-informes.component.css',
})
export class TableInformesComponent implements OnChanges, OnInit {
  @Input() reloadTable!: () => void;
  @Input() informes: Informe[] = [];
  private readonly router = inject(Router);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly filterStateService = inject(FilterStateService);
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedInformes: Informe[] = [];
  // Comenzamos con orden descendente
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  // Guardar el orden original si es necesario
  private originalOrder: Informe[] = [];
  protected AUDITOR_JEFE = 2;

  ngOnInit(): void {

  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['informes'] && changes['informes'].currentValue) {
      // Solo ordenamos si estamos recibiendo un array de informes con datos
      if (this.informes && this.informes.length > 0) {
        // Guardar una copia del orden original al recibir nuevos datos
        this.originalOrder = [...this.informes];
        // Aplicar el ordenamiento descendente por defecto
        this.ordenFecha = 'desc';
        this.aplicarOrdenamiento();
      }

      const savedState = this.filterStateService.getFilters('rec_verificables_informes');
      if (savedState && savedState.currentPage) {
        const maxPages = Math.ceil((this.informes?.length || 0) / this.itemsPerPage) || 1;
        this.currentPage = Math.min(savedState.currentPage, maxPages);
      }
      this.updateDisplayedInformes();
    }
  }

  public clearSelection() {
    this.informes = [];
  }

  protected redireccionPagina(id: number): void {
    this.router.navigate([
      'inicio/informes-verificables/recomendaciones-verificables',
      btoa(id.toString()),
    ]);
  }

  protected ordenarPorFecha(): void {
    // Simplificar: solo alternar entre asc y desc
    this.ordenFecha = this.ordenFecha === 'desc' ? 'asc' : 'desc';
    
    // Aplicar el ordenamiento basado en el nuevo estado
    this.aplicarOrdenamiento();
    
    // Actualizar la visualización
    this.currentPage = 1;
    this.updateDisplayedInformes();
  }

  private aplicarOrdenamiento(): void {
    // Solo ordenar si hay datos que ordenar
    if (!this.informes || this.informes.length === 0) return;

    // Ordenar los informes según el estado actual
    if (this.ordenFecha === 'asc') {
      // Ordenamiento ascendente (de más antiguo a más reciente)
      this.informes.sort((a, b) => {
        const fechaA = new Date(a.ainin_fechaEmision).getTime();
        const fechaB = new Date(b.ainin_fechaEmision).getTime();
        return fechaA - fechaB;
      });
    } else {
      // Ordenamiento descendente (de más reciente a más antiguo)
      this.informes.sort((a, b) => {
        const fechaA = new Date(a.ainin_fechaEmision).getTime();
        const fechaB = new Date(b.ainin_fechaEmision).getTime();
        return fechaB - fechaA;
      });
    }
  }

  private updateDisplayedInformes(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedInformes = this.informes.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  public updateData(newData: Informe[]): void {
    this.informes = newData;
    // Guardar una copia del orden original
    this.originalOrder = [...newData];
    const savedState = this.filterStateService.getFilters('rec_verificables_informes');
    if (savedState && savedState.currentPage) {
      const maxPages = Math.ceil((this.informes?.length || 0) / this.itemsPerPage) || 1;
      this.currentPage = Math.min(savedState.currentPage, maxPages);
    } else {
      this.currentPage = 1;
    }
    this.ordenFecha = 'desc';
    
    // Aplicar ordenamiento por defecto a los nuevos datos
    this.aplicarOrdenamiento();
    this.updateDisplayedInformes();
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    const currentState = this.filterStateService.getFilters('rec_verificables_informes') || {};
    this.filterStateService.setFilters('rec_verificables_informes', { ...currentState, currentPage: page });
    this.updateDisplayedInformes();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    const currentState = this.filterStateService.getFilters('rec_verificables_informes') || {};
    this.filterStateService.setFilters('rec_verificables_informes', { ...currentState, currentPage: 1 });
    this.updateDisplayedInformes();
  }

  protected hasRole(roles: number[]): boolean {
    return this.auxiliarySrv.hasRole(roles);
  }
}
