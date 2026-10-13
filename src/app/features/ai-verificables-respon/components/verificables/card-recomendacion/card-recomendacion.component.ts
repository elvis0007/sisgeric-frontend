import { Component, inject, Input, OnChanges, SimpleChanges, OnDestroy} from '@angular/core';
import { ModalVerificablesService } from '@features/ai-verificables-respon/services/verificables/modal-verificables.service';
import { RecomendacionVerificable, Verificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { CommonModule } from '@angular/common';
import { User } from '@core/auth/models/authentication';
import { ObjectEncryptor } from '@shared/utils/object-encryptor';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { ModalSolicitudesService } from '@features/ai-verificables-respon/services/solicitud/modal-solicitudes.service';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';
import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';
import { PlanAccionService, ValidacionPlanVerificable } from '@features/ai-plan-accion-respon/services/plan-accion.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-card-recomendacion',
  standalone: true,
  imports: [CommonModule, StatusColorPipe, AbsPipe, ModalResponsablesComponent],
  templateUrl: './card-recomendacion.component.html',
  styleUrl: './card-recomendacion.component.css',
})
export class CardRecomendacionComponent implements OnChanges, OnDestroy {
  @Input() recomendaciones: RecomendacionVerificable[] = [];
  protected modalVerifSrv: ModalVerificablesService = inject(
    ModalVerificablesService
  );
  private readonly modalSolicitudesSrv: ModalSolicitudesService = inject(
    ModalSolicitudesService
  );
  private readonly encryptor: ObjectEncryptor = inject(ObjectEncryptor);
  protected readonly planAccionSrv: PlanAccionService = inject(PlanAccionService);
  protected user: User | null = null;
  protected ultimosVerificables: { [codigoRec: number]: Verificable } = {};
  protected loadingVerificables: { [codigoRec: number]: boolean } = {};
  protected resumenesPlan: { [key: string]: { total: number } } = {};
  protected cargaAnticipadaHabilitada: { [codigoRec: number]: boolean } = {};
  private readonly modalResponsablesSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );

  private readonly verificablesRespSrv: VerificablesResponsablesService =
    inject(VerificablesResponsablesService);
  
  private verificableUpdateSubscription: Subscription | null = null;
  private planChangeSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.user = JSON.parse(
      this.encryptor.decryptObject(localStorage.getItem('SEG_SE_USUARIO_AUDITORIA') || '')
    );
    // Cargar el último verificable para cada recomendación
    if (this.recomendaciones.length > 0) {
      this.loadUltimosVerificables();
    }

    // Suscribirse a las actualizaciones de verificables
    this.verificableUpdateSubscription = this.verificablesRespSrv.verificableUpdated$.subscribe(
      ({ codigoRec, codPer }) => {
        // Solo actualizar si el usuario coincide
        if (this.user?.codigo_per === codPer) {
          this.updateVerificableForRecomendacion(codigoRec);
        }
      }
    );

    // Suscribirse a cambios en el plan de acción
    this.planChangeSubscription = this.planAccionSrv.planChanged$.subscribe(change => {
      if (change) {
        this.resumenesPlan = {};
      }
    });
  }

  ngOnDestroy(): void {
    // Limpiar suscripciones para evitar memory leaks
    if (this.verificableUpdateSubscription) {
      this.verificableUpdateSubscription.unsubscribe();
    }
    if (this.planChangeSubscription) {
      this.planChangeSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recomendaciones'] && this.user) {
      // Se detectó un cambio en las recomendaciones (cambio de filtro)
      this.resumenesPlan = {};
      this.loadUltimosVerificables();
    }
  }

  private loadUltimosVerificables(): void {
    // Limpiar estados anteriores
    this.ultimosVerificables = {};
    this.loadingVerificables = {};
    
    this.recomendaciones.forEach(recomendacion => {
      const codigoRec = recomendacion.recomendaciones.arere_codigo;
      this.loadingVerificables[codigoRec] = true;
      this.getUltimoVerificable(recomendacion);
    });
  }

  protected getEstadoIndividualCodigo(recomendacion: any): number {
    const rec = recomendacion?.recomendaciones;
    return rec?.estado_individual?.arees_codigo 
      ?? recomendacion?.estado_individual?.arees_codigo 
      ?? rec?.estado_seguimiento?.arees_codigo 
      ?? recomendacion?.estado_seguimiento?.arees_codigo 
      ?? 0;
  }

  protected getEstadoIndividualDescripcion(recomendacion: any): string {
    const rec = recomendacion?.recomendaciones;
    return rec?.estado_individual?.arees_descripcion 
      ?? recomendacion?.estado_individual?.arees_descripcion 
      ?? rec?.estado_seguimiento?.arees_descripcion 
      ?? recomendacion?.estado_seguimiento?.arees_descripcion 
      ?? '';
  }

  protected openModalVerif(recomendacion: any) {
    // Si no tiene verificable previo cargado, validar que el plan cumpla las reglas de reestructuración
    if (!this.getUltimoVerificableFor(recomendacion)) {
      const val = this.getValidacionPlan(recomendacion);
      if (!val.puedeSubir) {
        this.openMatrizPlan(recomendacion);
        return;
      }
    }

    const codRec = recomendacion?.recomendaciones?.arere_codigo || recomendacion?.arere_codigo;
    const codPer = this.user?.codigo_per || '';
    const status = this.getEstadoIndividualCodigo(recomendacion);
    const plazo = this.getPlazoIndividual(recomendacion);
    const fechaMax = this.getFechaMaximaIndividual(recomendacion);
    this.modalVerifSrv.openModal({ codRec, codPer, status, plazo, fechaMax });
  }

  getEstadoPlazo(dias: number): string {
    const plazo = dias ?? 0;
    return plazo < 0 ? 'días vencidos' : 'días vigentes';
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

  getProgresoGlobal(recomendacion: any): number {
    const progreso = recomendacion?.recomendaciones?.arere_progreso;
    return typeof progreso === 'number' ? Math.min(100, Math.max(0, Math.round(progreso))) : 0;
  }

  getFechaMaxima(recomendacion: any): string {
    return this.getFechaMaximaIndividual(recomendacion);
  }

  getButtonClass(recomendacion: any): string {
    const rec = recomendacion?.recomendaciones;
    if (!rec) return 'bg-indigo-700 hover:bg-indigo-800 text-slate-300 border-none';

    const plazo = this.getPlazoIndividual(recomendacion);
    const estado = rec.estado_solicitud;

    // 1. Solicitud Pendiente o Aprobada Parcial (Amarillo/Amber con brillo)
    if (estado === 'PENDIENTE' || estado === 'APROBADO_PARCIAL') {
      return 'bg-yellow-500 hover:bg-yellow-600 text-white border-none ring-2 ring-yellow-400/50 shadow-md';
    }

    // 2. Plazo vencido y sin solicitud pendiente (Rojo vivo sólido y parpadeante brillante)
    if (plazo < 0) {
      return '!bg-red-600 hover:!bg-red-700 !text-white !border-none btn-prorroga-parpadeante';
    }

    // 3. Plazo vigente y última solicitud aprobada (Verde)
    if (plazo >= 0 && estado === 'APROBADO') {
      return 'bg-green-600 hover:bg-green-700 text-white border-none ring-2 ring-green-400/40 shadow-sm';
    }

    // 4. Plazo vigente y sin solicitud activa o rechazada (Indigo/Azul)
    return 'bg-indigo-700 hover:bg-indigo-800 text-slate-100 border-none hover:shadow-md';
  }

  getButtonTitle(recomendacion: any): string {
    const rec = recomendacion?.recomendaciones;
    if (!rec) return 'Actualizar Fecha';

    const plazo = this.getPlazoIndividual(recomendacion);
    const estado = rec.estado_solicitud;

    if (estado === 'PENDIENTE' || estado === 'APROBADO_PARCIAL') {
      return 'Solicitud de prórroga en revisión por Auditoría';
    }

    if (plazo < 0) {
      return '¡Plazo Vencido! Clic para solicitar ampliación de plazo';
    }

    if (plazo >= 0 && estado === 'APROBADO') {
      return 'Solicitud aprobada - Plazo actualizado';
    }

    return 'Solicitar Ampliación de Plazo';
  }

  protected esVencida(recomendacion: any): boolean {
    const plazo = this.getPlazoIndividual(recomendacion);
    const estadoCod = this.getEstadoIndividualCodigo(recomendacion);
    return plazo < 0 && estadoCod !== 2;
  }

  protected tieneSolicitudPendiente(recomendacion: any): boolean {
    const estado = recomendacion?.recomendaciones?.estado_solicitud;
    return estado === 'PENDIENTE' || estado === 'APROBADO_PARCIAL';
  }

  protected tieneSolicitudAprobada(recomendacion: any): boolean {
    const estado = recomendacion?.recomendaciones?.estado_solicitud;
    return estado === 'APROBADO';
  }

  protected esCumplida(recomendacion: any): boolean {
    return this.getEstadoIndividualCodigo(recomendacion) === 2;
  }

  protected esPlanSoloConsulta(recomendacion: any): boolean {
    return this.esCumplida(recomendacion) || this.esPlanBloqueadoPorVencimiento(recomendacion);
  }

  protected esPlanBloqueadoPorVencimiento(recomendacion: any): boolean {
    return this.esVencida(recomendacion) && !this.tieneSolicitudAprobada(recomendacion);
  }

  protected openModalSolicitudes(event: Event, recomendacion: any) {
    event.preventDefault();
    const recObj = recomendacion?.recomendaciones ? recomendacion : { recomendaciones: recomendacion };
    const estInd = recomendacion?.recomendaciones?.estado_individual
      || recomendacion?.estado_individual
      || recomendacion?.recomendaciones?.estado_seguimiento
      || recomendacion?.estado_seguimiento;
    const memoInf = recomendacion?.ainin_memorando || recObj?.ainin_memorando || '';
    const memoApr = recomendacion?.ainin_memo_aprobacion || recObj?.ainin_memo_aprobacion || '';
    const titInf = recomendacion?.ainin_titulo || recObj?.ainin_titulo || '';
    const descRec = recomendacion?.recomendaciones?.arere_descripcion || recomendacion?.arere_descripcion || '';
    const fechaMax = this.getFechaMaximaIndividual(recomendacion);
    const plazoInd = this.getPlazoIndividual(recomendacion);

    const modalData = {
      ...recObj,
      estado_seguimiento: estInd,
      estado_individual: estInd,
      plazo: plazoInd,
      plazo_individual: plazoInd,
      codigo_per: this.user?.codigo_per,
      arere_codigo: recomendacion?.arere_codigo || recomendacion?.recomendaciones?.arere_codigo,
      arere_descripcion: descRec,
      descripcionRecomendacion: descRec,
      arere_fecha_maxima: fechaMax,
      fechaMaximaActual: fechaMax,
      ainin_memorando: memoInf,
      memorandoInforme: memoInf,
      ainin_memo_aprobacion: memoApr,
      memorandoAprobacion: memoApr,
      ainin_titulo: titInf,
      tituloInforme: titInf
    };
    this.modalSolicitudesSrv.openModal(modalData);
  }
  protected openModalResponsable(recomendacion: RecomendacionVerificable): void {
    this.modalResponsablesSrv.openModal(recomendacion.recomendaciones.arere_codigo);
  }

  protected esVerificableJustificado(verificable: Verificable | null | undefined): boolean {
    if (!verificable) return false;
    const desc = (verificable.estado_seguimiento?.areev_descripcion || '').trim().toUpperCase();
    const cod = Number(verificable.estado_seguimiento?.areev_codigo ?? (verificable as any)?.areev_codigo);
    return desc === 'JUSTIFICA' || desc === 'JUSTIFICADO' || cod === 2;
  }

  private getUltimoVerificable(recomendacion: RecomendacionVerificable): void {
    const codigoRec = recomendacion.recomendaciones.arere_codigo;
    
    this.verificablesRespSrv
      .getVerificablesResp(codigoRec, this.user?.codigo_per || '')
      .subscribe({
        next: (response) => {
          const verificables = response.datos.verificables || [];

          if (verificables.length > 0) {
            // Prioridad absoluta: Si existe un verificable que JUSTIFICA, mostrar siempre ese verificable
            // (con su estado 'JUSTIFICA' y sus fechas de carga y validación), a pesar de que posteriormente
            // se hayan subido otros verificables (por ejemplo información adicional en estado 'PENDIENTE').
            const justificado = verificables.find(v => this.esVerificableJustificado(v))
              || (this.esCumplida(recomendacion) ? verificables.find(v => !!v.areve_fecha_validacion) : null);

            this.ultimosVerificables[codigoRec] = justificado || verificables[0];
          }
          this.loadingVerificables[codigoRec] = false;
        },
        error: () => {
          console.error("Error al obtener los verificables para recomendación:", codigoRec);
          this.loadingVerificables[codigoRec] = false;
        },
      });
  }

  // Método helper para obtener el último verificable de una recomendación específica
  protected getUltimoVerificableFor(recomendacion: RecomendacionVerificable): Verificable | null {
    return this.ultimosVerificables[recomendacion.recomendaciones.arere_codigo] || null;
  }

  // Método para verificar si está cargando un verificable específico
  protected isLoadingVerificable(recomendacion: RecomendacionVerificable): boolean {
    return this.loadingVerificables[recomendacion.recomendaciones.arere_codigo] || false;
  }

  // Método para actualizar un verificable específico cuando se recibe notificación
  private updateVerificableForRecomendacion(codigoRec: number): void {
    // Encontrar la recomendación correspondiente
    const recomendacion = this.recomendaciones.find(
      rec => rec.recomendaciones.arere_codigo === codigoRec
    );
    
    if (recomendacion) {
      this.loadingVerificables[codigoRec] = true;
      this.getUltimoVerificable(recomendacion);
    }
  }

  // Método para obtener el icono según el estado
  protected getStatusIcon(status: string): string {
    switch (status) {
      case 'PENDIENTE':
        return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5h2v6h-2zm0 8h2v2h-2z';
      case 'JUSTIFICA':
        return 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';
      case 'NO JUSTIFICA':
        return 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
      case 'VERIFICABLE NO CREADO':
      default:
        return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-3-7v1h-2v-1c0-1.1.9-2 2-2s2 .9 2 2v1h2c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1h-6c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1z';
    }
  }

  protected getAredrCodigo(recomendacion: any): number | undefined {
    const aredr = recomendacion?.recomendaciones?.aredr_codigo 
      || recomendacion?.aredr_codigo 
      || recomendacion?.responsableSeleccionado?.aredr_codigo;
    return aredr && !isNaN(Number(aredr)) ? Number(aredr) : undefined;
  }

  // Métodos del Plan de Acción y Evidencias integradas
  protected getResumenPlan(recomendacion: any): { total: number } {
    const cod = recomendacion?.recomendaciones?.arere_codigo || recomendacion?.arere_codigo;
    const aredr = this.getAredrCodigo(recomendacion);
    const cacheKey = aredr ? `${cod}_${aredr}` : `${cod}`;

    if (!this.resumenesPlan[cacheKey]) {
      const fMax = this.getFechaMaximaIndividual(recomendacion);
      const res = this.planAccionSrv.getResumenPlan(cod, fMax, aredr);
      this.resumenesPlan[cacheKey] = { total: res.total };

      // Sincronizar desde backend para el responsable específico
      if (cod && aredr) {
        this.planAccionSrv.obtenerPlanAccionApi(cod, aredr).subscribe({
          next: (apiResp) => {
            const apiTotal = (apiResp?.datos?.actividades && Array.isArray(apiResp.datos.actividades))
              ? apiResp.datos.actividades.length
              : 0;
            if (this.resumenesPlan[cacheKey]?.total !== apiTotal) {
              this.resumenesPlan[cacheKey] = { total: apiTotal };
              if (apiTotal > 0) {
                const planRec = {
                  arere_codigo: cod,
                  actividades: apiResp.datos.actividades.map((a: any, idx: number) => ({
                    id: `${cod}-${a.arpac_codigo || idx + 1}`,
                    num_actividad: a.num_actividad || idx + 1,
                    actividad: a.actividad || '',
                    fecha_ejecucion: a.fecha_ejecucion || '',
                    entregable_esperado: a.entregable_esperado || '',
                    arpac_codigo: a.arpac_codigo,
                    arer_codigo: a.arer_codigo
                  })),
                  fecha_actualizacion: apiResp.datos.fecha_actualizacion,
                  fecha_maxima_referencia: apiResp.datos.fecha_maxima_ref
                };
                localStorage.setItem(this.planAccionSrv.getStorageKey(cod, aredr), JSON.stringify(planRec));
              } else {
                localStorage.removeItem(this.planAccionSrv.getStorageKey(cod, aredr));
              }
            }
          },
          error: () => {}
        });
      }
    }
    return this.resumenesPlan[cacheKey];
  }

  protected openMatrizPlan(recomendacion: any): void {
    const isReadOnly = this.esPlanSoloConsulta(recomendacion);
    if (recomendacion) {
      const aredr = recomendacion.recomendaciones?.aredr_codigo || recomendacion.aredr_codigo;
      const codPer = this.user?.codigo_per || recomendacion.arers_codigo_per || recomendacion.recomendaciones?.arers_codigo_per;
      if (!recomendacion.responsableSeleccionado) {
        recomendacion.responsableSeleccionado = {
          aredr_codigo: aredr,
          arers_codigo: recomendacion.recomendaciones?.arers_codigo || recomendacion.arers_codigo,
          arers_codigo_per: codPer,
          arers_nombre: this.user?.nombre_completo || recomendacion.lista_responsables || 'Responsable',
          aredr_fecha_maxima: this.getFechaMaximaIndividual(recomendacion)
        };
      }
      if (!recomendacion.responsables || recomendacion.responsables.length === 0) {
        recomendacion.responsables = [recomendacion.responsableSeleccionado];
      }
    }
    this.planAccionSrv.openModal(recomendacion, isReadOnly);
  }

  protected exportarExcelPlan(recomendacion: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    try {
      this.planAccionSrv.exportarExcel(recomendacion);
    } catch (e) {
      console.error(e);
    }
  }

  protected getEvidenciaTexto(recomendacion: any): string {
    return recomendacion?.recomendaciones?.arere_evidencia_requerida || recomendacion?.arere_evidencia_requerida || '';
  }

  protected getEvidenciasList(recomendacion: any): string[] {
    const raw = this.getEvidenciaTexto(recomendacion);
    return this.planAccionSrv.parseListaEvidencias(raw);
  }

  protected getValidacionPlan(recomendacion: any): ValidacionPlanVerificable {
    const fMax = this.getFechaMaximaIndividual(recomendacion);
    const aredr = this.getAredrCodigo(recomendacion);
    return this.planAccionSrv.validarPlanParaVerificable(recomendacion, fMax, aredr);
  }

  protected puedeCargarVerificable(recomendacion: any): boolean {
    // 1. Recomendación Cumplida: Las cumplidas ya no usan Plan de Acción y pueden visualizar su histórico / verificable validado
    if (this.esCumplida(recomendacion)) {
      return true;
    }

    // 2. Recomendación Vencida: Bloqueada por vencimiento individual (requiere ampliación de plazo)
    if (this.esPlanBloqueadoPorVencimiento(recomendacion)) {
      return false;
    }

    const cod = recomendacion?.recomendaciones?.arere_codigo || recomendacion?.arere_codigo;
    const aredr = this.getAredrCodigo(recomendacion);

    // 3. Regla obligatoria: Para recomendaciones en proceso y no cumplidas
    // (con verificables en PENDIENTE DE REVISIÓN, PENDIENTE, NO JUSTIFICA o VERIFICABLE NO CREADO),
    // si NO se ha registrado previamente un Plan de Acción, NO PUEDE subir ni volver a subir ningún verificable
    // y debe mostrar la advertencia de Plan de Acción Requerido.
    if (!this.planAccionSrv.hasPlanGuardado(cod, aredr)) {
      return false;
    }

    // 4. Si ya tiene Plan de Acción guardado previamente:
    const ultimoVerif = this.getUltimoVerificableFor(recomendacion);
    if (ultimoVerif) {
      const estadoDesc = (ultimoVerif.estado_seguimiento?.areev_descripcion || '').toUpperCase();
      // Si fue rechazado (NO JUSTIFICA), no puede volver a subir verificable sin que el plan cumpla las validaciones
      if (estadoDesc === 'NO JUSTIFICA') {
        return this.getValidacionPlan(recomendacion).puedeSubir;
      }
      // Si está en PENDIENTE o en revisión, habiendo guardado su plan, muestra la tarjeta de estado del verificable
      return true;
    }

    // 5. Para verificable nuevo: validar cronograma y fechas del plan
    return this.getValidacionPlan(recomendacion).puedeSubir;
  }

  protected getRiesgoRecomendacion(recomendacion: any): string {
    const rec = recomendacion?.recomendaciones || recomendacion;
    const riesgo = rec?.arere_riesgo_verificado || recomendacion?.arere_riesgo_verificado || '';
    return (riesgo && typeof riesgo === 'string' && riesgo.trim()) ? riesgo.trim() : '';
  }

  protected getRiesgoBadgeClass(riesgo: string): string {
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
}
