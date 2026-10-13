import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { PlanAccionService } from '../../services/plan-accion.service';
import { ActividadPlanAccion } from '../../models/plan-accion.model';
import { RecomendacionVerificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-modal-matriz-plan-accion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-matriz-plan-accion.component.html',
  styleUrl: './modal-matriz-plan-accion.component.css'
})
export class ModalMatrizPlanAccionComponent implements OnInit, OnDestroy {
  protected readonly planAccionSrv = inject(PlanAccionService);
  private readonly auxiliarySrv = inject(AuxiliaryService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private readonly alertsService = inject(AlertsStateService);
  private sub!: Subscription;
  private subReadOnly!: Subscription;
  private subsConfirmations: Subscription[] = [];

  protected recomendacion: RecomendacionVerificable | null = null;
  protected actividades: ActividadPlanAccion[] = [];
  protected listaEvidencias: string[] = [];
  protected isReadOnly = false;

  // Control de dropdown personalizado para Entregable Esperado
  protected dropdownAbiertoIndex: number | null = null;

  // Responsables para filtrado y consulta por responsable
  protected responsablesList: any[] = [];
  protected responsableSeleccionadoId: string = '0';
  protected responsableActual: any = null;

  protected showSaveAlert = false;
  protected saveAlertMessage = '';
  protected isAlertError = false;

  ngOnInit(): void {
    this.subReadOnly = this.planAccionSrv.isReadOnly$.subscribe(ro => {
      this.isReadOnly = ro;
    });

    this.sub = this.planAccionSrv.selectedRecomendacion$.subscribe(rec => {
      this.recomendacion = rec;
      if (rec) {
        this.responsablesList = (rec as any).responsables || [];
        let respActual = (rec as any).responsableSeleccionado || (this.responsablesList.length > 0 ? this.responsablesList[0] : null);

        // Si no viene responsableSeleccionado (como sucede cuando se abre desde el rol responsable),
        // construir el responsable con aredr_codigo de la recomendación y la información del usuario en sesión
        if (!respActual) {
          const user = this.auxiliarySrv.getUserInfo();
          const aredrRec = (rec as any).aredr_codigo 
            || rec.recomendaciones?.aredr_codigo 
            || (rec as any).arers_codigo;
          const arersRec = (rec as any).arers_codigo 
            || rec.recomendaciones?.arers_codigo;
          const perRec = (rec as any).arers_codigo_per 
            || rec.recomendaciones?.arers_codigo_per 
            || user?.codigo_per;

          respActual = {
            aredr_codigo: aredrRec,
            arers_codigo: arersRec,
            arers_codigo_per: perRec,
            arers_nombre: user?.nombre_completo || (rec as any).lista_responsables || 'Responsable',
            aredr_fecha_maxima: rec.recomendaciones?.fecha_maxima_individual || rec.recomendaciones?.arere_fecha_maxima
          };
          this.responsablesList = [respActual];
        }

        this.responsableActual = respActual;
        this.responsableSeleccionadoId = respActual ? String(respActual.arers_codigo_per || respActual.arers_codigo || respActual.aredr_codigo || '0') : '0';

        const rawEvidencia = rec.recomendaciones?.arere_evidencia_requerida || (rec as any).arere_evidencia_requerida;
        this.listaEvidencias = this.planAccionSrv.parseListaEvidencias(rawEvidencia);

        const arereCodigo = rec.recomendaciones?.arere_codigo || (rec as any).arere_codigo;
        if (arereCodigo) {
          this.planAccionSrv.obtenerEvidenciasRequeridasApi(arereCodigo).subscribe({
            next: (resp) => {
              if (resp?.datos && Array.isArray(resp.datos) && resp.datos.length > 0) {
                let apiList = resp.datos.map(d => d.arer_descripcion).filter(Boolean);
                if (apiList.length === 1 && (apiList[0].includes(';') || apiList[0].length > 100)) {
                  apiList = this.planAccionSrv.parseListaEvidencias(apiList[0]);
                }
                if (apiList.length > 0) {
                  this.listaEvidencias = Array.from(new Set(apiList.map(s => s.trim())));
                }
              }
            },
            error: (err) => {
              console.warn('No se pudieron cargar evidencias requeridas desde API:', err);
            }
          });
          this.cargarActividades(arereCodigo);
        }
      } else {
        this.actividades = [];
        this.listaEvidencias = [];
        this.responsablesList = [];
        this.responsableActual = null;
        this.responsableSeleccionadoId = '0';
      }
    });
  }

  onCambiarResponsable(idPer: string): void {
    this.responsableSeleccionadoId = idPer;
    this.responsableActual = this.responsablesList.find(
      r => String(r.arers_codigo_per || r.arers_codigo || r.aredr_codigo) === String(idPer)
    ) || null;
    if (this.recomendacion?.recomendaciones?.arere_codigo) {
      this.cargarActividades(this.recomendacion.recomendaciones.arere_codigo);
    }
  }

  getEvidenciaTooltipText(): string {
    if (this.listaEvidencias && this.listaEvidencias.length > 0) {
      return this.listaEvidencias.map((ev, i) => `${i + 1}. ${ev}`).join('\n');
    }
    const raw = this.recomendacion?.recomendaciones?.arere_evidencia_requerida || (this.recomendacion as any)?.arere_evidencia_requerida;
    if (raw && raw.trim()) {
      return raw.trim();
    }
    return 'Definida en la recomendación de auditoría para su verificación previa a la remisión de verificables finales.';
  }

  selectorEvidenciaModalIndex: number | null = null;
  selectorActividad: ActividadPlanAccion | null = null;

  abrirSelectorEvidencias(act: ActividadPlanAccion, index: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly) return;
    this.selectorActividad = act;
    this.selectorEvidenciaModalIndex = index;
  }

  cerrarSelectorEvidencias(): void {
    this.selectorEvidenciaModalIndex = null;
    this.selectorActividad = null;
  }

  seleccionarEvidenciaParaActividad(ev: string): void {
    if (this.selectorActividad) {
      this.selectorActividad.entregable_esperado = ev;
    }
    this.cerrarSelectorEvidencias();
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.selectorEvidenciaModalIndex !== null) {
      this.cerrarSelectorEvidencias();
    }
  }

  ngOnDestroy(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
    if (this.subReadOnly) {
      this.subReadOnly.unsubscribe();
    }
    this.subsConfirmations.forEach(s => s.unsubscribe());
  }

  getFechaMaximaIndividual(): string {
    return this.responsableActual?.aredr_fecha_maxima
      || this.recomendacion?.recomendaciones?.fecha_maxima_individual
      || this.recomendacion?.recomendaciones?.arere_fecha_maxima
      || '';
  }

  getFechaMaximaIndividualIso(): string {
    return this.planAccionSrv.normalizeDateToIso(this.getFechaMaximaIndividual());
  }

  cargarActividades(arere_codigo: number): void {
    const aredrCodigo = this.responsableActual?.aredr_codigo 
      || (this.recomendacion as any)?.aredr_codigo 
      || this.recomendacion?.recomendaciones?.aredr_codigo
      || this.responsableActual?.arers_codigo;

    this.actividades = this.planAccionSrv.getActividades(arere_codigo, this.getFechaMaximaIndividual(), aredrCodigo);

    const aredrParaApi = aredrCodigo ? Number(aredrCodigo) : 0;
    if (arere_codigo && aredrParaApi > 0) {
      this.planAccionSrv.obtenerPlanAccionApi(arere_codigo, aredrParaApi).subscribe({
        next: (resp) => {
          if (resp && resp.datos && Array.isArray(resp.datos.actividades) && resp.datos.actividades.length > 0) {
            this.actividades = resp.datos.actividades.map((a: any, idx: number) => ({
              id: `${arere_codigo}-${a.arpac_codigo || idx + 1}`,
              num_actividad: a.num_actividad || idx + 1,
              actividad: a.actividad || '',
              fecha_ejecucion: a.fecha_ejecucion || '',
              entregable_esperado: a.entregable_esperado || '',
              arpac_codigo: a.arpac_codigo,
              arer_codigo: a.arer_codigo
            }));
          } else {
            this.actividades = [];
          }
        },
        error: (err) => {
          console.warn('No se pudo cargar plan desde backend, usando caché/local:', err);
        }
      });
    }
  }

  agregarActividad(): void {
    if (this.isReadOnly || !this.recomendacion) return;
    const nuevoNumero = this.actividades.length + 1;
    const maxIso = this.getFechaMaximaIndividualIso();

    const nuevaActividad: ActividadPlanAccion = {
      id: `${this.recomendacion.recomendaciones.arere_codigo}-${Date.now()}`,
      num_actividad: nuevoNumero,
      actividad: '',
      fecha_ejecucion: maxIso || '',
      entregable_esperado: '',
      estado_cumplimiento: ''
    };
    this.actividades.push(nuevaActividad);
  }

  eliminarActividad(index: number): void {
    if (this.isReadOnly) return;
    const act = this.actividades[index];
    const numAct = act?.num_actividad || (index + 1);
    const descAct = (act?.actividad && act.actividad.trim()) ? act.actividad : 'Sin descripción asignada';

    const actionId = this.modalConfirmationService.show({
      title: 'Eliminar Actividad del Plan',
      message: `
        <div class="space-y-2 text-sm text-base-content/85">
          <p>¿Está seguro de que desea eliminar la <strong>Actividad N° ${numAct}</strong>?</p>
          <div class="p-2.5 bg-base-200/70 rounded-xl border border-base-300 text-xs text-base-content/75 italic">
            "${descAct.length > 90 ? descAct.substring(0, 90) + '...' : descAct}"
          </div>
          <p class="text-xs text-rose-600 dark:text-rose-400 font-medium pt-1">
            Esta actividad se quitará del cronograma. Recuerde hacer clic en "Guardar Plan" para confirmar el cambio.
          </p>
        </div>
      `,
      confirmText: 'SÍ, ELIMINAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'error',
      cancelButtonType: 'ghost',
      iconType: 'warning'
    });

    const sub = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.actividades.splice(index, 1);
      this.actividades.forEach((a, idx) => {
        a.num_actividad = idx + 1;
      });
      this.alertsService.showAlert(`Actividad N° ${numAct} eliminada. Guarde los cambios para confirmar.`, 'warning');
      this.mostrarAlerta(`Actividad N° ${numAct} eliminada.`);
    });
    this.subsConfirmations.push(sub);
  }

  isFechaExcedida(fecha: string): boolean {
    const maxIso = this.getFechaMaximaIndividualIso();
    if (!fecha || !maxIso) return false;
    return fecha > maxIso;
  }

  isFinalActividad(index: number): boolean {
    return index === this.actividades.length - 1;
  }

  tieneProrrogaAprobada(): boolean {
    const estado = this.recomendacion?.recomendaciones?.estado_solicitud;
    return estado === 'APROBADO' || estado === 'APROBADO_PARCIAL';
  }

  ajustarFechaFinalANuevaFechaMaxima(): void {
    if (this.isReadOnly) return;
    const maxIso = this.getFechaMaximaIndividualIso();
    if (!maxIso || this.actividades.length === 0) return;
    const maxFmt = this.getFechaMaximaIndividual() ? new Date(this.getFechaMaximaIndividual()!).toLocaleDateString('es-EC') : maxIso;

    const actionId = this.modalConfirmationService.show({
      title: 'Reestructurar Cronograma por Prórroga',
      message: `
        <div class="space-y-2 text-sm text-base-content/85">
          <p>¿Desea extender la fecha de la última actividad a su nueva fecha máxima autorizada (<strong>${maxFmt}</strong>)?</p>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 text-xs text-amber-900 dark:text-amber-100">
            Esto sincronizará el cronograma con la ampliación de plazo concedida y le permitirá guardar los cambios para proceder con los verificables.
          </div>
        </div>
      `,
      confirmText: 'EXTENDER FECHA',
      cancelText: 'CANCELAR',
      confirmButtonType: 'primary',
      cancelButtonType: 'ghost',
      iconType: 'info'
    });

    const sub = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      const ultima = this.actividades[this.actividades.length - 1];
      ultima.fecha_ejecucion = maxIso;
      this.alertsService.showAlert(`Última actividad extendida a ${maxFmt}. Haga clic en "Guardar Plan" para confirmar.`, 'info');
      this.mostrarAlerta(`Última actividad sincronizada con la nueva fecha máxima (${maxIso}).`);
    });
    this.subsConfirmations.push(sub);
  }

  ajustarFinAHoyParaEntregaAnticipada(): void {
    if (this.isReadOnly || this.actividades.length === 0) return;
    const hoy = new Date();
    const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const hoyFmt = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;

    const actionId = this.modalConfirmationService.show({
      title: 'Culminar Plan Hoy (Entrega Anticipada)',
      message: `
        <div class="space-y-3 text-sm text-base-content/85">
          <p>¿Desea ajustar la fecha de la última actividad al día de hoy (<strong>${hoyFmt}</strong>)?</p>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-300 text-xs text-blue-900 dark:text-blue-100 space-y-1">
            <p class="font-bold">Finalidad del ajuste:</p>
            <p>Se adelantará el término del plan a la fecha actual, permitiendo cargar y remitir de inmediato las evidencias y verificables finales sin esperar la fecha máxima programada.</p>
          </div>
        </div>
      `,
      confirmText: 'SÍ, AJUSTAR A HOY',
      cancelText: 'CANCELAR',
      confirmButtonType: 'secondary',
      cancelButtonType: 'ghost',
      iconType: 'info'
    });

    const sub = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      const ultima = this.actividades[this.actividades.length - 1];
      ultima.fecha_ejecucion = hoyIso;

      // Asegurar que las actividades intermedias anteriores no queden con fechas futuras (> hoy)
      for (let i = 0; i < this.actividades.length - 1; i++) {
        if (this.actividades[i].fecha_ejecucion && this.actividades[i].fecha_ejecucion > hoyIso) {
          this.actividades[i].fecha_ejecucion = hoyIso;
        }
      }

      this.alertsService.showAlert(`Fecha final ajustada a hoy (${hoyFmt}). Haga clic en "Guardar Plan" para confirmar.`, 'info');
      this.mostrarAlerta(`Se ajustó la culminación a la fecha de hoy (${hoyIso}) para habilitar la entrega anticipada.`);
    });
    this.subsConfirmations.push(sub);
  }

  private mostrarAdvertenciaValidacion(titulo: string, mensajeHtml: string): void {
    this.modalConfirmationService.show({
      title: titulo,
      message: mensajeHtml,
      confirmText: 'ENTENDIDO',
      cancelText: '',
      confirmButtonType: 'primary',
      cancelButtonType: 'ghost',
      iconType: 'warning'
    });
    this.alertsService.showAlert(titulo, 'warning');
    this.mostrarAlerta(titulo, true);
  }

  guardarPlan(): void {
    if (this.isReadOnly || !this.recomendacion) return;

    if (this.actividades.length === 0) {
      this.mostrarAdvertenciaValidacion(
        'Cronograma sin actividades',
        '<p>El plan de acción debe contener al menos una actividad planificada antes de ser guardado. Puede hacer clic en <strong>"+ Agregar Actividad"</strong> para incorporar una nueva tarea.</p>'
      );
      return;
    }

    // Validar actividades vacías
    const actVacia = this.actividades.find(a => !a.actividad || !a.actividad.trim());
    if (actVacia) {
      this.mostrarAdvertenciaValidacion(
        'Actividad sin descripción',
        `<p>La <strong>Actividad N° ${actVacia.num_actividad}</strong> se encuentra vacía. Por favor ingrese la descripción detallada de la tarea a realizar.</p>`
      );
      return;
    }

    // Validar fechas vacías
    const actSinFecha = this.actividades.find(a => !a.fecha_ejecucion);
    if (actSinFecha) {
      this.mostrarAdvertenciaValidacion(
        'Fecha de ejecución pendiente',
        `<p>La <strong>Actividad N° ${actSinFecha.num_actividad}</strong> no tiene una fecha de ejecución asignada. Por favor seleccione la fecha programada en el calendario.</p>`
      );
      return;
    }

    // Validar evidencia / entregable esperado obligatorio
    const actSinEvidencia = this.actividades.find(a => !a.entregable_esperado || !a.entregable_esperado.trim());
    if (actSinEvidencia) {
      this.mostrarAdvertenciaValidacion(
        'Entregable / Evidencia requerida',
        `<p>La <strong>Actividad N° ${actSinEvidencia.num_actividad}</strong> debe tener asociado un entregable o evidencia que sustente su cumplimiento.</p>`
      );
      return;
    }

    // Validar coherencia cronológica secuencial
    for (let i = 1; i < this.actividades.length; i++) {
      const ant = this.actividades[i - 1].fecha_ejecucion;
      const curr = this.actividades[i].fecha_ejecucion;
      if (ant && curr && curr < ant) {
        this.mostrarAdvertenciaValidacion(
          'Incoherencia en el cronograma',
          `<div class="space-y-2">
            <p>El orden cronológico de las actividades no es coherente:</p>
            <div class="p-2.5 bg-base-200/80 rounded-xl border border-base-300 text-xs">
              <p>• <strong>Actividad N° ${i}:</strong> programada para <span class="font-bold text-primary">${ant}</span></p>
              <p>• <strong>Actividad N° ${i + 1}:</strong> programada para <span class="font-bold text-error">${curr}</span></p>
            </div>
            <p class="text-xs text-base-content/70">Una actividad posterior no puede tener fecha anterior a la que le precede en el flujo de ejecución.</p>
          </div>`
        );
        return;
      }
    }

    const maxIso = this.getFechaMaximaIndividualIso();
    if (maxIso) {
      // 1. Validar la última actividad
      const ultima = this.actividades[this.actividades.length - 1];
      if (ultima.fecha_ejecucion && ultima.fecha_ejecucion > maxIso) {
        this.mostrarAdvertenciaValidacion(
          'Límite de plazo excedido',
          `<div class="space-y-2">
            <p>La fecha de la última actividad (<strong>${ultima.fecha_ejecucion}</strong>) supera su fecha máxima autorizada (<strong>${maxIso}</strong>).</p>
            <p class="text-xs text-base-content/70">Ajuste la fecha dentro del plazo asignado o tramite una solicitud de ampliación de plazo si requiere más tiempo.</p>
          </div>`
        );
        return;
      }

      // 2. Validar que ninguna actividad supere la fecha máxima individual
      const actividadExcedida = this.actividades.find(a => a.fecha_ejecucion && a.fecha_ejecucion > maxIso);
      if (actividadExcedida) {
        this.mostrarAdvertenciaValidacion(
          'Actividad fuera del plazo límite',
          `<div class="space-y-2">
            <p>La <strong>Actividad N° ${actividadExcedida.num_actividad}</strong> (${actividadExcedida.fecha_ejecucion}) supera la fecha máxima permitida (<strong>${maxIso}</strong>).</p>
            <p class="text-xs text-base-content/70">Todas las actividades intermedias deben planificarse dentro del límite individual establecido.</p>
          </div>`
        );
        return;
      }
    }

    const aredrCodigo = this.responsableActual?.aredr_codigo 
      || (this.recomendacion as any)?.aredr_codigo 
      || this.recomendacion?.recomendaciones?.aredr_codigo;
    const arersCodigo = this.responsableActual?.arers_codigo 
      || (this.recomendacion as any)?.arers_codigo 
      || this.recomendacion?.recomendaciones?.arers_codigo;
    const arersCodigoPer = this.responsableActual?.arers_codigo_per 
      || (this.recomendacion as any)?.arers_codigo_per 
      || this.recomendacion?.recomendaciones?.arers_codigo_per;

    this.planAccionSrv.saveActividades(
      this.recomendacion.recomendaciones.arere_codigo,
      this.actividades,
      maxIso,
      aredrCodigo,
      arersCodigo ? Number(arersCodigo) : undefined,
      arersCodigoPer ? String(arersCodigoPer) : undefined
    ).subscribe({
      next: () => {
        this.alertsService.showAlert('¡Plan de acción y actividades guardados exitosamente!', 'success');
        this.mostrarAlerta('¡Plan de acción y actividades guardados exitosamente!');
      },
      error: (err) => {
        console.error('Error al guardar plan de acción en el backend:', err);
        const msg = err?.error?.mensaje || err?.message || 'Error al guardar el plan de acción.';
        this.mostrarAdvertenciaValidacion(
          'Error al guardar',
          `<p>No se pudo guardar el plan de acción. Motivo: <em>${msg}</em></p>`
        );
      }
    });
  }

  exportarExcel(): void {
    if (!this.recomendacion) return;
    try {
      this.planAccionSrv.exportarExcel(this.recomendacion, this.actividades);
      this.mostrarAlerta('¡Plan de acción descargado exitosamente en formato Excel (.xlsx)!');
    } catch (err: any) {
      this.mostrarAlerta(err?.message || 'Error al exportar a Excel.', true);
    }
  }

  mostrarAlerta(mensaje: string, esError = false): void {
    this.saveAlertMessage = mensaje;
    this.isAlertError = esError;
    this.showSaveAlert = true;
    setTimeout(() => {
      this.showSaveAlert = false;
    }, 4500);
  }

  closeModal(): void {
    this.planAccionSrv.closeModal();
  }

  getProgresoCumplimiento(): number {
    if (!this.actividades || this.actividades.length === 0) return 0;
    const cumplidas = this.actividades.filter(a => a.estado_cumplimiento === 'CUMPLE').length;
    return Math.round((cumplidas / this.actividades.length) * 100);
  }

  getCumplidasCount(): number {
    return this.actividades.filter(a => a.estado_cumplimiento === 'CUMPLE').length;
  }

  isCumplida(): boolean {
    const rec = this.recomendacion as any;
    const cod = rec?.recomendaciones?.estado_individual?.arees_codigo
      ?? rec?.estado_individual?.arees_codigo
      ?? rec?.recomendaciones?.estado_seguimiento?.arees_codigo
      ?? rec?.estado_seguimiento?.arees_codigo
      ?? 0;
    return cod === 2;
  }

  isVencida(): boolean {
    const rec = this.recomendacion as any;
    const plazo = rec?.recomendaciones?.plazo_individual ?? rec?.recomendaciones?.plazo ?? rec?.plazo ?? 0;
    return plazo < 0 && !this.isCumplida();
  }

  getRiesgo(): string {
    const rec = this.recomendacion as any;
    const riesgo = rec?.recomendaciones?.arere_riesgo_verificado || rec?.arere_riesgo_verificado || '';
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
}
