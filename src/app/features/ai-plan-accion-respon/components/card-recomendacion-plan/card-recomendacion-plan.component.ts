import { Component, inject, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RecomendacionVerificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { PlanAccionService } from '../../services/plan-accion.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-card-recomendacion-plan',
  standalone: true,
  imports: [CommonModule, StatusColorPipe, AbsPipe, ModalResponsablesComponent],
  templateUrl: './card-recomendacion-plan.component.html',
  styleUrl: './card-recomendacion-plan.component.css'
})
export class CardRecomendacionPlanComponent implements OnInit, OnDestroy {
  @Input() recomendaciones: RecomendacionVerificable[] = [];

  protected readonly planAccionSrv = inject(PlanAccionService);
  private readonly modalResponsablesSrv = inject(ModalResponsablesService);
  private readonly auxiliarySrv = inject(AuxiliaryService);
  private planChangeSub!: Subscription;

  // Cache of summary stats per recommendation and responsable code
  protected resumenesPlan: { [key: string]: { total: number; cumplidas: number; porcentaje: number } } = {};

  ngOnInit(): void {
    this.actualizarResumenes();
    this.planChangeSub = this.planAccionSrv.planChanged$.subscribe(() => {
      this.actualizarResumenes();
    });
  }

  ngOnDestroy(): void {
    if (this.planChangeSub) {
      this.planChangeSub.unsubscribe();
    }
  }

  protected actualizarResumenes(): void {
    if (!this.recomendaciones) return;
    this.recomendaciones.forEach(rec => {
      const cod = rec.recomendaciones.arere_codigo;
      const aredr = (rec as any)?.aredr_codigo || rec?.recomendaciones?.aredr_codigo;
      const key = aredr ? `${cod}_${aredr}` : `${cod}`;
      const fMaxInd = this.getFechaMaximaIndividual(rec);
      this.resumenesPlan[key] = this.planAccionSrv.getResumenPlan(cod, fMaxInd, aredr);
    });
  }

  protected getResumen(rec: RecomendacionVerificable): { total: number; cumplidas: number; porcentaje: number } {
    const cod = rec.recomendaciones.arere_codigo;
    const aredr = (rec as any)?.aredr_codigo || rec?.recomendaciones?.aredr_codigo;
    const key = aredr ? `${cod}_${aredr}` : `${cod}`;
    if (!this.resumenesPlan[key]) {
      const fMaxInd = this.getFechaMaximaIndividual(rec);
      this.resumenesPlan[key] = this.planAccionSrv.getResumenPlan(cod, fMaxInd, aredr);
    }
    return this.resumenesPlan[key];
  }

  protected getEvidenciasList(rec: RecomendacionVerificable): string[] {
    return this.planAccionSrv.parseListaEvidencias(rec?.recomendaciones?.arere_evidencia_requerida);
  }

  protected openMatrizPlan(recomendacion: RecomendacionVerificable): void {
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
          aredr_fecha_maxima: this.getFechaMaximaIndividual(recomendacion)
        };
      }
      if (!recAny.responsables || recAny.responsables.length === 0) {
        recAny.responsables = [recAny.responsableSeleccionado];
      }
    }
    this.planAccionSrv.openModal(recomendacion);
  }

  protected openModalResponsable(recomendacion: RecomendacionVerificable): void {
    this.modalResponsablesSrv.openModal(recomendacion.recomendaciones.arere_codigo);
  }

  exportarExcel(recomendacion: RecomendacionVerificable, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    try {
      this.planAccionSrv.exportarExcel(recomendacion);
    } catch (e) {
      console.error(e);
    }
  }

  getProgresoGlobal(recomendacion: any): number {
    const progreso = recomendacion?.recomendaciones?.arere_progreso;
    return typeof progreso === 'number' ? Math.min(100, Math.max(0, Math.round(progreso))) : 0;
  }

  getFechaMaximaGeneral(recomendacion: any): string {
    return recomendacion?.recomendaciones?.fecha_maxima_general
      || recomendacion?.arere_fecha_maxima
      || recomendacion?.recomendaciones?.arere_fecha_maxima
      || '';
  }

  getFechaMaximaIndividual(recomendacion: any): string {
    return recomendacion?.recomendaciones?.fecha_maxima_individual
      || recomendacion?.aredr_fecha_maxima
      || recomendacion?.recomendaciones?.aredr_fecha_maxima
      || recomendacion?.recomendaciones?.arere_fecha_maxima
      || '';
  }

  getPlazoIndividual(recomendacion: any): number {
    const rec = recomendacion?.recomendaciones;
    return rec?.plazo_individual ?? rec?.plazo ?? 0;
  }

  getEstadoPlazo(dias: number): string {
    const plazo = dias ?? 0;
    return plazo < 0 ? 'días vencidos' : 'días vigentes';
  }

  getRiesgoRecomendacion(recomendacion: any): string {
    const rec = recomendacion?.recomendaciones || recomendacion;
    const riesgo = rec?.arere_riesgo_verificado || recomendacion?.arere_riesgo_verificado || '';
    return (riesgo && typeof riesgo === 'string' && riesgo.trim()) ? riesgo.trim() : '';
  }

  getRiesgoBadgeClass(riesgo: string): string {
    if (!riesgo) return '';
    const r = riesgo.toUpperCase().trim();
    if (r === 'ALTO') {
      return 'bg-rose-600 text-white border-none shadow-xs font-bold';
    }
    if (r === 'MODERADO' || r === 'MEDIO') {
      return 'bg-amber-500 text-slate-950 border-none shadow-xs font-bold';
    }
    if (r === 'BAJO') {
      return 'bg-emerald-600 text-white border-none shadow-xs font-bold';
    }
    return 'bg-indigo-700 text-white border-none shadow-xs font-bold';
  }

  esCumplida(recomendacion: any): boolean {
    const rec = recomendacion?.recomendaciones || recomendacion;
    const cod = rec?.estado_individual?.arees_codigo ?? rec?.estado_seguimiento?.arees_codigo ?? 0;
    return cod === 2;
  }
}
