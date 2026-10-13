import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, ViewChild, NgZone } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  RecomendacionVerificable,
  Verificable,
} from '@features/ai-rec-verificables/models/Verificable';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { TableVerificablesComponent } from '@features/ai-rec-verificables/components/verificables/table-verificables/table-verificables.component';
import { ModalFormVerificableService } from '@features/ai-rec-verificables/services/verificables/modal-form-verificable.service';
import { SearchFilterComponent } from '@features/ai-rec-verificables/components/verificables/search-filter/search-filter.component';
import { ModalValidarVerificableComponent } from '@features/ai-rec-verificables/components/verificables/modal-validar-verificable/modal-validar-verificable.component';
import { ModalVerficableComponent } from '@features/ai-rec-verificables/components/verificables/modal-verficable/modal-verficable.component';
import { ModalFechaMaxComponent } from '@features/ai-rec-verificables/components/recomendaciones/modal-fecha-max/modal-fecha-max.component';
import { ModalMatrizPlanAccionComponent } from '@features/ai-plan-accion-respon/components/modal-matriz-plan-accion/modal-matriz-plan-accion.component';
import { PlanAccionService } from '@features/ai-plan-accion-respon/services/plan-accion.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { InformesVerificablesService } from '@features/ai-rec-verificables/services/informes/informes-verificables.service';

@Component({
  selector: 'app-list-verificables',
  standalone: true,
  imports: [
    CommonModule,
    TableVerificablesComponent,
    SearchFilterComponent,
    ModalValidarVerificableComponent,
    ModalVerficableComponent,
    ModalFechaMaxComponent,
    ModalMatrizPlanAccionComponent,
  ],
  templateUrl: './list-verificables.component.html',
  styleUrl: './list-verificables.component.css',
})
export class ListVerificablesComponent implements OnInit, OnDestroy {
  private paramsSubscription!: Subscription;
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly ngZone = inject(NgZone);
  protected readonly planAccionSrv = inject(PlanAccionService);
  private readonly filterStateService = inject(FilterStateService);
  private readonly informesSrv = inject(InformesVerificablesService);
  
  @ViewChild(SearchFilterComponent)
  searchFilterComponent!: SearchFilterComponent;

  @ViewChild(TableVerificablesComponent)
  tableComponent!: TableVerificablesComponent;
  private readonly modalFormVer: ModalFormVerificableService = inject(
    ModalFormVerificableService
  );
  protected verificables: Verificable[] = [];
  protected recomendaciones!: RecomendacionVerificable;
  protected tituloRecomendacion: string = '';
  protected informeMemorando: string = '';
  protected informeTitulo: string = '';
  protected idInf: number = 0;
  protected isLoading = false;
  protected isAddButtonDisabled = false;
  protected selectedResponsableId: string = '0';

  ngOnInit(): void {
    this.paramsSubscription = this.ruta.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.auxiliarSrv.saveUrlParameter(id, 'id_det_rec');
        this.idInf = +atob(id);
      }
    });

    const idInfVer = this.auxiliarSrv.getUrlParameter('id_inf_ver');
    if (idInfVer) {
      this.informesSrv.getInformeByCod({ ainin_codigo: +idInfVer } as any).subscribe({
        next: (resp) => {
          if (resp?.datos) {
            this.informeMemorando = resp.datos.ainin_memorando || '';
            this.informeTitulo = resp.datos.ainin_titulo || '';
            if (this.recomendaciones) {
              if (!this.recomendaciones.ainin_memorando) {
                this.recomendaciones.ainin_memorando = this.informeMemorando;
              }
              if (!this.recomendaciones.ainin_titulo) {
                this.recomendaciones.ainin_titulo = this.informeTitulo;
              }
              if (this.tableComponent) {
                this.tableComponent.recomendaciones = this.recomendaciones;
              }
            }
          }
        },
        error: () => {}
      });
    }
  }

  ngOnDestroy(): void {
    if (this.paramsSubscription) {
      this.paramsSubscription.unsubscribe();
    }
  }

  onFilterChange(filteredData: RecomendacionVerificable): void {
    this.isLoading = true;
    if (this.informeMemorando && !filteredData.ainin_memorando) {
      filteredData.ainin_memorando = this.informeMemorando;
    }
    if (this.informeTitulo && !filteredData.ainin_titulo) {
      filteredData.ainin_titulo = this.informeTitulo;
    }
    this.recomendaciones = filteredData;
    this.tituloRecomendacion = filteredData.arere_descripcion;
    this.verificables = filteredData.verificables;
    
    const saved = this.filterStateService.getFilters('rec_verificables_verificables');
    this.selectedResponsableId = saved?.arers_codigo_per || '0';
    
    if (this.tableComponent && this.verificables) {
      this.tableComponent.updateData(this.verificables, this.selectedResponsableId, this.recomendaciones);
      
      this.ngZone.run(() => {
        setTimeout(() => {
          this.isLoading = false;
        });
      });
    } else {
      this.ngZone.run(() => {
        setTimeout(() => {
          this.isLoading = false;
        });
      });
    }
  }

  onLoadingChange(isLoading: boolean): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.isLoading = isLoading;
      });
    });
  }

  // Deshabilita el botón de agregar si no hay responsables
  onResponsablesStatusChange(isDisabled: boolean): void {
    this.isAddButtonDisabled = isDisabled;
  }

  reloadTable(): void {
    if (this.searchFilterComponent) {
      this.searchFilterComponent.reloadTable();
    }
  }

  protected get isCumplida(): boolean {
    const estado = this.recomendaciones?.estado_seguimiento?.arees_descripcion?.toUpperCase()?.trim();
    const codigo = this.recomendaciones?.estado_seguimiento?.arees_codigo;
    return codigo === 2 || estado === 'CUMPLIDA' || this.isAddButtonDisabled;
  }

  protected openModal(): void {
    this.modalFormVer.openModal(null, 'create');
  }

  protected openModalAdicional(): void {
    this.modalFormVer.openModal(null, 'adicional');
  }

  protected openPlanAccionModal(): void {
    const cod = this.idInf || this.recomendaciones?.arere_codigo || 0;
    const listaResp = this.searchFilterComponent?.selectResponsable || [];
    const respSeleccionadoId = (this.searchFilterComponent as any)?.filterForm?.get('arers_codigo_per')?.value;

    let respActual: any = null;
    if (respSeleccionadoId && String(respSeleccionadoId) !== '0') {
      respActual = listaResp.find(r => String(r.arers_codigo_per) === String(respSeleccionadoId)) || null;
    }
    if (!respActual && listaResp.length > 0) {
      respActual = listaResp[0];
    }

    const recObj: any = {
      arere_codigo: cod,
      responsables: listaResp,
      responsableSeleccionado: respActual,
      recomendaciones: {
        arere_codigo: cod,
        arere_descripcion: this.tituloRecomendacion || this.recomendaciones?.arere_descripcion || '',
        arere_evidencia_requerida: (this.recomendaciones as any)?.arere_evidencia_requerida || '',
        fecha_maxima_individual: respActual?.aredr_fecha_maxima || ''
      }
    };
    this.planAccionSrv.openModal(recObj, true);
  }

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarSrv.hasRole(roleIds);
  }
}

