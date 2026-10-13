import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { User } from '@core/auth/models/authentication';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { RecomendacionVerificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { PlanAccionService } from '../../services/plan-accion.service';
import { CardRecomendacionPlanComponent } from '../../components/card-recomendacion-plan/card-recomendacion-plan.component';
import { ModalMatrizPlanAccionComponent } from '../../components/modal-matriz-plan-accion/modal-matriz-plan-accion.component';
import { SearchFilterPlanComponent } from '../../components/search-filter-plan/search-filter-plan.component';

@Component({
  selector: 'app-list-plan-accion-resp',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbsComponent,
    CardRecomendacionPlanComponent,
    ModalMatrizPlanAccionComponent,
    SearchFilterPlanComponent
  ],
  templateUrl: './list-plan-accion-resp.component.html',
  styleUrl: './list-plan-accion-resp.component.css'
})
export class ListPlanAccionRespComponent implements OnInit {
  private readonly verificablesRespSrv = inject(VerificablesResponsablesService);
  private readonly auxiliarySrv = inject(AuxiliaryService);
  private readonly route = inject(ActivatedRoute);
  private readonly planAccionSrv = inject(PlanAccionService);

  protected user: User | null = null;
  protected selectedState: number = 1; // PENDIENTES por defecto
  protected selectedYear: number | null = null;
  protected allRecomendaciones: RecomendacionVerificable[] = [];
  protected recomendaciones: RecomendacionVerificable[] = [];
  protected isEmpty = false;
  protected isLoading = false;

  @ViewChild(SearchFilterPlanComponent) searchFilterComponent!: SearchFilterPlanComponent;

  ngOnInit(): void {
    this.user = this.auxiliarySrv.getUserInfo();
    const qpAnio = this.route.snapshot.queryParamMap.get('anio');
    if (qpAnio && !isNaN(Number(qpAnio)) && Number(qpAnio) > 0) {
      this.selectedYear = Number(qpAnio);
    }
    this.fetchRecomendaciones();
  }

  protected fetchRecomendaciones(): void {
    if (!this.user) return;
    this.isLoading = true;
    this.isEmpty = false;
    const cod_per = this.user?.codigo_per || '';
    const anioStr = this.selectedYear ? this.selectedYear.toString() : '0';

    this.verificablesRespSrv
      .getRecResponsables(this.selectedState, cod_per, anioStr)
      .subscribe({
        next: (response) => {
          this.allRecomendaciones = response.datos || [];
          this.recomendaciones = [...this.allRecomendaciones];
          this.isEmpty = this.recomendaciones.length === 0;
          this.isLoading = false;

          if (this.searchFilterComponent) {
            this.searchFilterComponent.updateOriginalData(this.allRecomendaciones);
          }

          const arereParam = this.route.snapshot.queryParamMap.get('arere');
          if (arereParam) {
            const target = this.allRecomendaciones.find(
              r => r.recomendaciones?.arere_codigo === Number(arereParam)
            );
            if (target) {
              this.openMatrizForRec(target);
            }
          }
        },
        error: (err) => {
          console.error('Error fetching recomendaciones for plan de acción:', err);
          this.isLoading = false;
        }
      });
  }

  private openMatrizForRec(recomendacion: RecomendacionVerificable): void {
    if (recomendacion) {
      const user = this.auxiliarySrv.getUserInfo();
      const recAny = recomendacion as any;
      const aredr = recomendacion.recomendaciones?.aredr_codigo || recAny.aredr_codigo;
      const codPer = user?.codigo_per || recAny.arers_codigo_per || recomendacion.recomendaciones?.arers_codigo_per;
      if (!recAny.responsableSeleccionado) {
        recAny.responsableSeleccionado = {
          aredr_codigo: aredr,
          arers_codigo: recomendacion.recomendaciones?.arers_codigo || recAny.arers_codigo,
          arers_codigo_per: codPer,
          arers_nombre: user?.nombre_completo || recAny.lista_responsables || 'Responsable',
          aredr_fecha_maxima: recAny.aredr_fecha_maxima || recomendacion.recomendaciones?.aredr_fecha_maxima || recomendacion.recomendaciones?.arere_fecha_maxima
        };
      }
      if (!recAny.responsables || recAny.responsables.length === 0) {
        recAny.responsables = [recAny.responsableSeleccionado];
      }
      this.planAccionSrv.openModal(recomendacion);
    }
  }

  protected setFilter(state: number): void {
    this.selectedState = state;
    this.fetchRecomendaciones();
  }

  protected onFilterChange(filteredData: RecomendacionVerificable[]): void {
    this.recomendaciones = filteredData;
    this.isEmpty = filteredData.length === 0;
  }

  protected onLoadingChange(loading: boolean): void {
    this.isLoading = loading;
  }
}
