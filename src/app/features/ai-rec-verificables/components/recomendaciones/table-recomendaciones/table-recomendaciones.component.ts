import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { Recomendacion } from '@features/ai-rec-verificables/models/Recomendacion';
import { ModalFormFechaMaxService } from '@features/ai-rec-verificables/services/recomendaciones/modal-form-fecha-max.service';
import { ModalFormVerificableService } from '@features/ai-rec-verificables/services/verificables/modal-form-verificable.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { RoundPipe } from '@shared/pipe/round.pipe';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ObjectEncryptor } from '@shared/utils/object-encryptor';
import { FilterStateService } from '@core/services/filter-state.service';
import { ModalEstadoSeguimService } from '@features/ai-rec-verificables/services/recomendaciones/modal-estado-seguim.service';

@Component({
  selector: 'app-table-recomendaciones',
  standalone: true,
  imports: [CommonModule, AbsPipe, StatusColorPipe, RoundPipe, PaginationComponent],
  templateUrl: './table-recomendaciones.component.html',
  styleUrl: './table-recomendaciones.component.css',
})
export class TableRecomendacionesComponent implements OnChanges {
  @Input() recomendaciones: Recomendacion[] = [];
  @Input() searchTerm: string | null = '';
  private readonly router = inject(Router);
  protected readonly auxiliarSrv = inject(AuxiliaryService);
  protected readonly encryptor: ObjectEncryptor = inject(ObjectEncryptor);
  private readonly filterStateService = inject(FilterStateService);

  protected readonly modalFormVerSrv: ModalFormVerificableService = inject(
    ModalFormVerificableService
  );
  private readonly modalResponsablesSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );
  protected readonly modalFormRecFechaSrv: ModalFormFechaMaxService = inject(
    ModalFormFechaMaxService
  );
  private readonly modalEstadoSeguimSrv: ModalEstadoSeguimService = inject(
    ModalEstadoSeguimService
  );
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedRecomendaciones: Recomendacion[] = [];
  protected filteredRecomendaciones: Recomendacion[] = [];
  private ordenAscendente: boolean = true;
  protected isAuditorJefe: boolean = this.auxiliarSrv.getUserInfo().roles.find(role => role.asero_codigo === 2) ? true : false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recomendaciones'] && changes['recomendaciones'].currentValue) {
      this.filteredRecomendaciones = [...this.recomendaciones];
      this.filterRecomendaciones();

      const savedState = this.filterStateService.getFilters('rec_verificables_recomendaciones');
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
      this.filteredRecomendaciones = this.recomendaciones.filter(recomendacion => 
        recomendacion.arere_descripcion.toLowerCase().includes(term)
      );
    }
  }

  reloadTable(): void {
    this.filterRecomendaciones();
    this.updateDisplayedRecomendaciones();
  }

  protected ordenarPorNumero(): void {
    this.ordenAscendente = !this.ordenAscendente;
    
    this.filteredRecomendaciones.sort((a, b) => {
      if (this.ordenAscendente) {
        return a.arere_num_rec - b.arere_num_rec;
      } else {
        return b.arere_num_rec - a.arere_num_rec;
      }
    });
    
    this.updateDisplayedRecomendaciones();
  }

  protected redireccionPagina(recomendacion: Recomendacion): void {
    const idInfVer: number = this.auxiliarSrv.getUrlParameter('id_inf_ver');
    this.router.navigate([
      'inicio/informes-verificables/recomendaciones-verificables',
      btoa(idInfVer.toString()),
      'verificables',
      btoa(recomendacion.arere_codigo.toString()),
    ]);
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
    const currentState = this.filterStateService.getFilters('rec_verificables_recomendaciones') || {};
    this.filterStateService.setFilters('rec_verificables_recomendaciones', { ...currentState, currentPage: page });
    this.updateDisplayedRecomendaciones();
  }

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarSrv.hasRole(roleIds);
  }

  protected isCumplida(recomendacion: Recomendacion): boolean {
    const desc = recomendacion?.estado_seguimiento?.arees_descripcion?.toUpperCase()?.trim();
    const cod = recomendacion?.estado_seguimiento?.arees_codigo;
    return desc === 'CUMPLIDA' || cod === 2;
  }

  protected isChangeStateDisabled(recomendacion: Recomendacion): boolean {
    if (this.hasRole([2])) {
      return false; // El Auditor Interno Jefe (Rol 2) puede editar el estado aunque esté CUMPLIDA
    }
    return this.isCumplida(recomendacion);
  }

  protected openModalChangeDate(event: Event, recomendacion: Recomendacion) {
    event.preventDefault();
    if (this.isCumplida(recomendacion)) {
      return;
    }
    this.modalFormRecFechaSrv.openModal(recomendacion, 'edit');
  }

  protected openModalChangeState(event: Event, recomendacion: Recomendacion) {
    event.preventDefault();
    if (this.isChangeStateDisabled(recomendacion)) {
      return;
    }
    this.modalEstadoSeguimSrv.openModal(recomendacion);
  }

  protected openModalResponsable(recomendacion: Recomendacion): void {
    this.modalResponsablesSrv.openModal(recomendacion.arere_codigo);
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    const currentState = this.filterStateService.getFilters('rec_verificables_recomendaciones') || {};
    this.filterStateService.setFilters('rec_verificables_recomendaciones', { ...currentState, currentPage: 1 });
    this.updateDisplayedRecomendaciones();
  }
}
