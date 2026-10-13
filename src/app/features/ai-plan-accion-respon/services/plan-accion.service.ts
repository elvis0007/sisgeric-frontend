import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, shareReplay, throwError } from 'rxjs';
import * as XLSX from 'xlsx';
import { environment } from '@environments/environment.development';
import { ResponseReadSimple } from '@shared/models/response-read';
import { RecomendacionVerificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import {
  ActividadPlanAccion,
  PlanAccionRecomendacion,
  PlanAccionDTO,
  GuardarPlanAccionDTO,
  EvidenciaRequeridaDTO,
  EvidenciaCotejoDTO,
  GuardarCotejoDTO
} from '../models/plan-accion.model';

export interface ValidacionPlanVerificable {
  puedeSubir: boolean;
  motivo?: 'SIN_PLAN' | 'ACTIVIDAD_EXCEDE_MAXIMA' | 'REQUIERE_REESTRUCTURAR_PRORROGA' | 'CRONOGRAMA_FUTURO' | 'VENCIDA' | 'VALIDO';
  mensaje: string;
  fechaUltimaActividad?: string;
  fechaMaximaIndividual?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlanAccionService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = environment.url;
  private readonly STORAGE_PREFIX = 'sisrec_plan_accion_';

  // Modal state
  private isModalOpenSubject = new BehaviorSubject<boolean>(false);
  public isModalOpen$ = this.isModalOpenSubject.asObservable();

  private selectedRecomendacionSubject = new BehaviorSubject<RecomendacionVerificable | null>(null);
  public selectedRecomendacion$ = this.selectedRecomendacionSubject.asObservable();

  private isReadOnlySubject = new BehaviorSubject<boolean>(false);
  public isReadOnly$ = this.isReadOnlySubject.asObservable();

  // Observable for plan changes so cards can reflect activity counts / status
  private planChangedSubject = new BehaviorSubject<{ arere_codigo: number } | null>(null);
  public planChanged$ = this.planChangedSubject.asObservable();

  // =========================================================================
  // HTTP REST API (Oracle Backend)
  // =========================================================================

  obtenerPlanAccionApi(arereCodigo: number, aredrCodigo: number): Observable<ResponseReadSimple<PlanAccionDTO>> {
    const url = `${this.apiUrl}plan-accion/recomendacion/${arereCodigo}/responsable/${aredrCodigo}`;
    return this.http.get<ResponseReadSimple<PlanAccionDTO>>(url);
  }

  guardarPlanAccionApi(dto: GuardarPlanAccionDTO): Observable<ResponseReadSimple<any>> {
    const url = `${this.apiUrl}plan-accion`;
    return this.http.post<ResponseReadSimple<any>>(url, dto);
  }

  obtenerEvidenciasRequeridasApi(arereCodigo: number): Observable<ResponseReadSimple<EvidenciaRequeridaDTO[]>> {
    const url = `${this.apiUrl}evidencias-requeridas/recomendacion/${arereCodigo}`;
    return this.http.get<ResponseReadSimple<EvidenciaRequeridaDTO[]>>(url);
  }

  obtenerCotejoEvidenciasApi(arereCodigo: number, aredrCodigo: number): Observable<ResponseReadSimple<EvidenciaCotejoDTO[]>> {
    const url = `${this.apiUrl}evidencias-requeridas/cotejo/recomendacion/${arereCodigo}/responsable/${aredrCodigo}`;
    return this.http.get<ResponseReadSimple<EvidenciaCotejoDTO[]>>(url);
  }

  guardarCotejoEvidenciasApi(dto: GuardarCotejoDTO): Observable<ResponseReadSimple<any>> {
    const url = `${this.apiUrl}evidencias-requeridas/cotejo`;
    return this.http.post<ResponseReadSimple<any>>(url, dto);
  }

  openModal(recomendacion: RecomendacionVerificable, isReadOnly = false): void {
    this.selectedRecomendacionSubject.next(recomendacion);
    this.isReadOnlySubject.next(isReadOnly);
    this.isModalOpenSubject.next(true);
  }

  closeModal(): void {
    this.isModalOpenSubject.next(false);
  }

  isModalOpen(): boolean {
    return this.isModalOpenSubject.value;
  }

  isReadOnly(): boolean {
    return this.isReadOnlySubject.value;
  }

  getSelectedRecomendacion(): RecomendacionVerificable | null {
    return this.selectedRecomendacionSubject.value;
  }

  /**
   * Normaliza una fecha a formato ISO YYYY-MM-DD
   */
  normalizeDateToIso(dateVal: any): string {
    if (!dateVal) return '';
    const str = String(dateVal).trim();
    const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
      return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
    }
    const matchSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchSlash) {
      const d = matchSlash[1].padStart(2, '0');
      const m = matchSlash[2].padStart(2, '0');
      const y = matchSlash[3];
      return `${y}-${m}-${d}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  }

  /**
   * Parsea la evidencia requerida (texto multilínea, numeración, viñetas, punto y coma, oraciones con punto seguido)
   * en una lista de evidencias para que el usuario y el auditor las gestionen individualmente.
   */
  parseListaEvidencias(evidenciaStr?: string): string[] {
    if (!evidenciaStr || !evidenciaStr.trim()) {
      return [];
    }

    const raw = evidenciaStr.trim();

    // Separar exhaustivamente por saltos de línea, punto y coma, viñetas,
    // o punto seguido cuando inicia una nueva oración en mayúscula/número, o numeraciones (1., a))
    const items = raw
      .split(/(?:;|\r?\n|•|(?<=[.?!])\s+(?=[A-ZÁÉÍÓÚÑ0-9])|(?<=\s|^)(?:\d+[\.\)]|[a-zA-Z][\.\)])\s+)/)
      .map(s => s
        .replace(/^[0-9]+\s*[\.\-\)]\s*/, '')
        .replace(/^[•\-\*\s]+/, '')
        .replace(/[;\.]+\s*$/, '')
        .trim()
      )
      .filter(item => item.length > 0);

    return items;
  }

  /**
   * Obtiene la clave de almacenamiento por recomendación y opcionalmente por responsable (aredr_codigo).
   */
  getStorageKey(arere_codigo: number, aredr_codigo?: number | string): string {
    if (aredr_codigo && String(aredr_codigo) !== '0') {
      return `${this.STORAGE_PREFIX}${arere_codigo}_${aredr_codigo}`;
    }
    return `${this.STORAGE_PREFIX}${arere_codigo}`;
  }

  /**
   * Obtiene las actividades del plan de acción para una recomendación dada y responsable.
   * Si no existen registradas, retorna arreglo vacío.
   */
  getActividades(arere_codigo: number, fechaMaximaIndividual?: string, aredr_codigo?: number | string): ActividadPlanAccion[] {
    try {
      if (aredr_codigo && String(aredr_codigo) !== '0') {
        const primaryKey = this.getStorageKey(arere_codigo, aredr_codigo);
        const data = localStorage.getItem(primaryKey);
        if (data) {
          const parsed: PlanAccionRecomendacion = JSON.parse(data);
          if (parsed && Array.isArray(parsed.actividades) && parsed.actividades.length > 0) {
            return parsed.actividades;
          }
        }
        // Jamás recurrir al plan de otro responsable asignado a la misma recomendación
        return [];
      }

      // Si no se especificó aredr_codigo
      const data = localStorage.getItem(`${this.STORAGE_PREFIX}${arere_codigo}`);
      if (data) {
        const parsed: PlanAccionRecomendacion = JSON.parse(data);
        if (parsed && Array.isArray(parsed.actividades) && parsed.actividades.length > 0) {
          return parsed.actividades;
        }
      }
    } catch (e) {
      console.warn('Error al leer plan de acción de localStorage:', e);
    }

    return [];
  }

  /**
   * Guarda las actividades del plan de acción para una recomendación y responsable.
   */
  saveActividades(
    arere_codigo: number,
    actividades: ActividadPlanAccion[],
    fechaMaximaReferencia?: string,
    aredr_codigo?: number | string,
    arers_codigo?: number,
    arers_codigo_per?: string
  ): Observable<any> {
    try {
      // Re-enumerar las actividades de forma secuencial
      const ordenadas = actividades.map((act, index) => ({
        ...act,
        num_actividad: index + 1
      }));

      const plan: PlanAccionRecomendacion = {
        arere_codigo,
        actividades: ordenadas,
        fecha_actualizacion: new Date().toISOString(),
        fecha_maxima_referencia: fechaMaximaReferencia ? this.normalizeDateToIso(fechaMaximaReferencia) : undefined
      };

      const key = this.getStorageKey(arere_codigo, aredr_codigo);
      localStorage.setItem(key, JSON.stringify(plan));
      // Limpiar cualquier clave compartida previa para evitar que otro responsable la tome por error
      try {
        localStorage.removeItem(`${this.STORAGE_PREFIX}${arere_codigo}`);
      } catch {}
      this.planChangedSubject.next({ arere_codigo });

      const aredrNum = aredr_codigo && !isNaN(Number(aredr_codigo)) ? Number(aredr_codigo) : 0;
      const dto: GuardarPlanAccionDTO = {
        arere_codigo,
        aredr_codigo: aredrNum,
        arers_codigo: arers_codigo ? Number(arers_codigo) : undefined,
        arers_codigo_per: arers_codigo_per ? String(arers_codigo_per) : (aredr_codigo && isNaN(Number(aredr_codigo)) ? String(aredr_codigo) : undefined),
        fecha_maxima_ref: fechaMaximaReferencia ? this.normalizeDateToIso(fechaMaximaReferencia) : undefined,
        actividades: ordenadas.map(a => ({
          num_actividad: a.num_actividad,
          actividad: a.actividad || '',
          fecha_ejecucion: this.normalizeDateToIso(a.fecha_ejecucion) || '',
          entregable_esperado: a.entregable_esperado || '',
          arer_codigo: a.arer_codigo
        }))
      };

      const obs$ = this.guardarPlanAccionApi(dto).pipe(
        tap(() => {
          this.planChangedSubject.next({ arere_codigo });
        }),
        shareReplay(1)
      );

      // Auto-subscribe para compatibilidad con llamadas síncronas/desatendidas
      obs$.subscribe({
        next: () => {},
        error: (err) => console.warn('Error al persistir plan de acción en el backend:', err)
      });

      return obs$;
    } catch (e) {
      console.error('Error al guardar plan de acción:', e);
      return throwError(() => e);
    }
  }

  /**
   * Obtiene la estructura completa del plan guardado (incluyendo fecha de actualización y referencia)
   */
  getPlanGuardado(arere_codigo: number, aredr_codigo?: number | string): PlanAccionRecomendacion | null {
    try {
      if (aredr_codigo && String(aredr_codigo) !== '0') {
        const primaryKey = this.getStorageKey(arere_codigo, aredr_codigo);
        const data = localStorage.getItem(primaryKey);
        if (!data) return null;
        return JSON.parse(data);
      }
      const data = localStorage.getItem(`${this.STORAGE_PREFIX}${arere_codigo}`);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Determina si el responsable ya guardó explícitamente actividades válidas para esta recomendación.
   * Requiere que existan actividades registradas, con descripción y entregable esperado seleccionado.
   */
  hasPlanGuardado(arere_codigo: number, aredr_codigo?: number | string): boolean {
    try {
      const key = this.getStorageKey(arere_codigo, aredr_codigo);
      let data = localStorage.getItem(key);
      if (!data && (!aredr_codigo || String(aredr_codigo) === '0')) {
        data = localStorage.getItem(`${this.STORAGE_PREFIX}${arere_codigo}`);
      }
      if (!data) return false;
      const parsed: PlanAccionRecomendacion = JSON.parse(data);
      if (!parsed || !Array.isArray(parsed.actividades) || parsed.actividades.length === 0) return false;
      const validas = parsed.actividades.filter(a => !!a.actividad && a.actividad.trim().length > 0);
      if (validas.length === 0) return false;
      // Cada actividad registrada debe contar obligatoriamente con su entregable esperado / evidencia
      return validas.every(a => !!a.entregable_esperado && a.entregable_esperado.trim().length > 0);
    } catch {
      return false;
    }
  }

  /**
   * Obtiene las actividades guardadas en almacenamiento local sin generar plantilla por defecto
   */
  getActividadesGuardadas(arere_codigo: number, aredr_codigo?: number | string): ActividadPlanAccion[] | null {
    try {
      const key = this.getStorageKey(arere_codigo, aredr_codigo);
      let data = localStorage.getItem(key);
      if (!data && (!aredr_codigo || String(aredr_codigo) === '0')) {
        data = localStorage.getItem(`${this.STORAGE_PREFIX}${arere_codigo}`);
      }
      if (!data) return null;
      const parsed: PlanAccionRecomendacion = JSON.parse(data);
      if (!parsed || !Array.isArray(parsed.actividades)) return null;
      return parsed.actividades;
    } catch {
      return null;
    }
  }

  /**
   * Valida estrictamente si el Plan de Acción permite la subida del Verificable Final:
   * 1. Debe existir un Plan de Acción guardado con actividades para este responsable.
   * 2. Ninguna actividad (en particular la final) puede superar la fecha máxima individual.
   * 3. Si hubo ampliación de plazo, el responsable debe reestructurar sus actividades hasta la nueva fecha máxima.
   * 4. Si la fecha de la última actividad es futura (> hoy), no puede subirlo a menos que reestructure
   *    su plan anticipadamente (fijando fecha de culminación <= hoy).
   */
  validarPlanParaVerificable(recomendacion: any, fechaMaximaIndividualStr?: string, aredr_codigo?: number | string): ValidacionPlanVerificable {
    const cod = recomendacion?.recomendaciones?.arere_codigo || recomendacion?.arere_codigo;
    const aredr = aredr_codigo 
      || recomendacion?.recomendaciones?.aredr_codigo 
      || recomendacion?.aredr_codigo 
      || recomendacion?.responsableSeleccionado?.aredr_codigo;
    const fMaxStr = fechaMaximaIndividualStr || recomendacion?.recomendaciones?.fecha_maxima_individual || recomendacion?.arere_fecha_maxima;
    const fMaxIso = this.normalizeDateToIso(fMaxStr);

    const hoy = new Date();
    const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    // 1. Debe existir Plan de Acción guardado para este responsable
    if (!this.hasPlanGuardado(cod, aredr)) {
      return {
        puedeSubir: false,
        motivo: 'SIN_PLAN',
        mensaje: 'Debe estructurar y registrar su Plan de Acción previo a la entrega del verificable final.',
        fechaMaximaIndividual: fMaxIso
      };
    }

    const acts = this.getActividadesGuardadas(cod, aredr) || [];
    if (acts.length === 0) {
      return {
        puedeSubir: false,
        motivo: 'SIN_PLAN',
        mensaje: 'Debe registrar al menos una actividad en el Plan de Acción.',
        fechaMaximaIndividual: fMaxIso
      };
    }

    // Validar que todas las actividades tengan evidencia / entregable obligatorio
    const actSinEvidencia = acts.find(a => !a.entregable_esperado || !a.entregable_esperado.trim());
    if (actSinEvidencia) {
      return {
        puedeSubir: false,
        motivo: 'SIN_PLAN',
        mensaje: `La actividad N° ${actSinEvidencia.num_actividad} debe tener una evidencia / entregable seleccionado obligatoriamente en el Plan de Acción.`,
        fechaMaximaIndividual: fMaxIso
      };
    }

    const ultima = acts[acts.length - 1];
    const fUltimaIso = this.normalizeDateToIso(ultima?.fecha_ejecucion);

    // 2. Control mandatorio: La actividad final NUNCA debe pasarse de la fecha máxima individual
    const actividadExcedida = acts.find(a => {
      const fIso = this.normalizeDateToIso(a.fecha_ejecucion);
      return fIso && fMaxIso && fIso > fMaxIso;
    });

    if (actividadExcedida) {
      return {
        puedeSubir: false,
        motivo: 'ACTIVIDAD_EXCEDE_MAXIMA',
        mensaje: `La actividad final (${fUltimaIso}) excede su fecha máxima individual (${fMaxIso}). Debe reestructurar su Plan de Acción.`,
        fechaUltimaActividad: fUltimaIso,
        fechaMaximaIndividual: fMaxIso
      };
    }

    // 3. Control de ampliación de plazo:
    // Si la fecha máxima individual fue ampliada y el plan no ha sido reestructurado hasta la nueva fecha máxima
    const rec = recomendacion?.recomendaciones || recomendacion;
    const estadoSolicitud = rec?.estado_solicitud;
    const tieneProrrogaAprobada = estadoSolicitud === 'APROBADO' || estadoSolicitud === 'APROBADO_PARCIAL';

    // Control de recomendación vencida (plazo expirado sin prórroga aprobada)
    const estadoCod = rec?.estado_individual?.arees_codigo ?? rec?.estado_seguimiento?.arees_codigo ?? 0;
    const plazoInd = rec?.plazo_individual ?? rec?.plazo ?? (fMaxIso && fMaxIso < hoyIso ? -1 : 0);
    const esVencida = plazoInd < 0 && estadoCod !== 2;

    if (esVencida && !tieneProrrogaAprobada) {
      return {
        puedeSubir: false,
        motivo: 'VENCIDA',
        mensaje: 'La recomendación se encuentra vencida. Debe tramitar una ampliación de plazo y obtener aprobación de Auditoría para habilitar la edición del plan y la subida de verificables.',
        fechaUltimaActividad: fUltimaIso,
        fechaMaximaIndividual: fMaxIso
      };
    }

    const planGuardado = this.getPlanGuardado(cod);
    if (tieneProrrogaAprobada && fMaxIso) {
      // Si el plan no tiene como referencia la nueva fecha máxima o su actividad final quedó por debajo de la nueva fecha
      const noReestructurado = (!planGuardado?.fecha_maxima_referencia || planGuardado.fecha_maxima_referencia !== fMaxIso) && (fUltimaIso < fMaxIso);
      if (noReestructurado) {
        return {
          puedeSubir: false,
          motivo: 'REQUIERE_REESTRUCTURAR_PRORROGA',
          mensaje: `Se aprobó una ampliación de plazo hasta el ${fMaxIso}. Para subir el verificable, debe reestructurar sus actividades hasta la nueva fecha máxima.`,
          fechaUltimaActividad: fUltimaIso,
          fechaMaximaIndividual: fMaxIso
        };
      }
    }

    // 4. Control de culminación del cronograma (para entrega anticipada):
    // La actividad final marca el fin del plan. Si la fecha de la última actividad es futura (> hoy):
    // el cronograma aún está en ejecución. Para subir antes, el responsable DEBE reestructurar el plan de acción (fijar fecha <= hoy).
    if (fUltimaIso && fUltimaIso > hoyIso) {
      return {
        puedeSubir: false,
        motivo: 'CRONOGRAMA_FUTURO',
        mensaje: `El cronograma está en ejecución (actividad final programada para el ${fUltimaIso}). Si culminó las actividades antes de tiempo, debe reestructurar su Plan de Acción para habilitar la entrega.`,
        fechaUltimaActividad: fUltimaIso,
        fechaMaximaIndividual: fMaxIso
      };
    }

    return {
      puedeSubir: true,
      motivo: 'VALIDO',
      mensaje: 'Plan de acción completado y validado. Listo para subir verificable final.',
      fechaUltimaActividad: fUltimaIso,
      fechaMaximaIndividual: fMaxIso
    };
  }

  /**
   * Resumen para la tarjeta de recomendación.
   * Si no se ha guardado un plan válido, retorna total 0 (Pendiente de Registro).
   */
  getResumenPlan(arere_codigo: number, fechaMaximaIndividual?: string, aredr_codigo?: number | string): { total: number; cumplidas: number; porcentaje: number } {
    if (!this.hasPlanGuardado(arere_codigo, aredr_codigo)) {
      return { total: 0, cumplidas: 0, porcentaje: 0 };
    }
    const actividades = this.getActividadesGuardadas(arere_codigo, aredr_codigo) || [];
    const total = actividades.length;
    const cumplidas = actividades.filter(a => a.estado_cumplimiento === 'CUMPLE').length;
    const porcentaje = total > 0 ? Math.round((cumplidas / total) * 100) : 0;
    return { total, cumplidas, porcentaje };
  }

  /**
   * Normaliza una fecha a formato legible DD/MM/YYYY para documentos Excel
   */
  normalizeDateToDdmmyyyy(dateVal: any): string {
    if (!dateVal) return '';
    const str = String(dateVal).trim();
    const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
      return `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`;
    }
    const matchSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchSlash) {
      return `${matchSlash[1].padStart(2, '0')}/${matchSlash[2].padStart(2, '0')}/${matchSlash[3]}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return str;
  }

  /**
   * Exporta la matriz de plan de acción a formato Excel (.xlsx) para evidencia documental (Responsable)
   */
  exportarExcel(recomendacion: any, actividadesCustom?: ActividadPlanAccion[]): void {
    const recObj = recomendacion?.recomendaciones || recomendacion;
    const recCod = recObj?.arere_codigo;
    const fMaxInd = recObj?.fecha_maxima_individual || recObj?.arere_fecha_maxima || '';
    const actividades = actividadesCustom || this.getActividades(recCod, fMaxInd);

    if (!actividades || actividades.length === 0) {
      throw new Error('No hay actividades registradas en el plan de acción para exportar.');
    }

    const numRec = recObj?.arere_num_rec || recomendacion?.arere_num_rec || '';
    const descRec = recObj?.arere_descripcion || recomendacion?.arere_descripcion || '';
    const memo = recomendacion?.ainin_memorando || recObj?.ainin_memorando || 'S/N';
    const tituloInf = recomendacion?.ainin_titulo || recObj?.ainin_titulo || '';
    const fechaGen = new Date().toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Formatear evidencia requerida como lista en una sola casilla
    const rawEvidencias = recObj?.arere_evidencia_requerida || recomendacion?.arere_evidencia_requerida || '';
    const listaEvidencias = this.parseListaEvidencias(rawEvidencias);
    let textoEvidencias = 'No especificada';
    if (listaEvidencias.length > 0) {
      textoEvidencias = listaEvidencias.map((ev, i) => `${i + 1}. ${ev}`).join('\r\n');
    } else if (rawEvidencias && rawEvidencias.trim()) {
      textoEvidencias = rawEvidencias.trim();
    }

    const fMaxFormatted = this.normalizeDateToDdmmyyyy(fMaxInd) || (fMaxInd ? String(fMaxInd) : 'Sin fecha');
    let estadoInd = recObj?.estado_individual?.arees_descripcion
      || recObj?.estado_individual
      || recObj?.estado_plazo
      || recObj?.estado_seguimiento?.arees_descripcion
      || recomendacion?.estado_seguimiento?.arees_descripcion
      || 'EN PROCESO';
    if (recObj?.estado_plazo === 'CUMPLIDO') {
      estadoInd = 'CUMPLIDA';
    }

    // Encabezado institucional de la matriz
    const headerData: any[][] = [
      ['EMPRESA ELÉCTRICA AMBATO REGIONAL CENTRO NORTE S.A. - EEASA'],
      ['SISTEMA DE SEGUIMIENTO DE RECOMENDACIONES DE AUDITORÍA (SISREC)'],
      ['MATRIZ DE PLAN DE ACCIÓN DE RECOMENDACIÓN'],
      [''],
      ['DATOS DE LA RECOMENDACIÓN:'],
      ['Memorando / Informe:', memo],
      ['Título del Informe:', tituloInf || 'No especificado'],
      ['Recomendación a la que hace referencia:', numRec ? `Recomendación N° ${numRec}` : 'S/N'],
      ['Descripción de la Recomendación:', descRec || 'No especificada'],
      ['Evidencias Requeridas:', textoEvidencias],
      ['Fecha Máxima Individual:', fMaxFormatted, 'Estado Individual:', estadoInd],
      ['Fecha de Generación:', fechaGen],
      ['Total Actividades Planificadas:', String(actividades.length)],
      [''],
      ['MATRIZ DE ACTIVIDADES Y ENTREGABLES:']
    ];

    // Filas de datos (Solo las 4 columnas esenciales)
    const dataToExport = actividades.map(act => ({
      'N° Actividad': act.num_actividad,
      'Actividad Planificada': act.actividad || '',
      'Fecha de Ejecución': this.normalizeDateToDdmmyyyy(act.fecha_ejecucion),
      'Entregable Esperado': act.entregable_esperado || ''
    }));

    // Crear libro
    const workbook: XLSX.WorkBook = XLSX.utils.book_new();
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);

    // Agregar tabla de datos debajo del encabezado
    const headerRowCount = headerData.length;
    XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });

    // Anchos de columna recomendados
    worksheet['!cols'] = [
      { wch: 36 }, // N° Actividad / Etiquetas del encabezado
      { wch: 60 }, // Actividad Planificada / Valores del encabezado
      { wch: 24 }, // Fecha de Ejecución
      { wch: 50 }  // Entregable Esperado
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plan_de_Accion');

    // Nombre del archivo de evidencia
    const fechaFile = new Date().toISOString().split('T')[0];
    const fileName = `Plan_Accion_Rec_${numRec || 'General'}_${fechaFile}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  }

  /**
   * Exporta el plan de acción en formato Excel (.xlsx) para la vista del Auditor,
   * conteniendo con exactitud las 4 columnas que visualiza la auditora:
   * N° Actividad, Actividad Planificada, Fecha de Ejecución, Entregable Esperado.
   */
  exportarExcelAuditor(params: {
    recomendacion: any;
    responsable?: any;
    actividades: ActividadPlanAccion[];
    tituloInforme?: string;
    memorando?: string;
    fechaMaximaIndividual?: string;
    estadoIndividual?: string;
    listaEvidencias?: string[];
  }): void {
    const { recomendacion, responsable, actividades } = params;
    if (!actividades || actividades.length === 0) {
      throw new Error('No hay actividades registradas en el plan de acción para exportar.');
    }

    const recObj = recomendacion?.recomendaciones || recomendacion;
    const numRec = recObj?.arere_num_rec || recomendacion?.arere_num_rec || '';
    const descRec = recObj?.arere_descripcion || recomendacion?.arere_descripcion || '';
    const memo = params.memorando || recomendacion?.ainin_memorando || recObj?.ainin_memorando || 'S/N';
    const tituloInf = params.tituloInforme || recomendacion?.ainin_titulo || recObj?.ainin_titulo || '';
    const nombreResp = responsable?.nombre_completo || 'Responsable Asignado';
    const cargoResp = responsable?.arers_cargo || responsable?.cargo || '';
    const depResp = responsable?.arers_departamento || responsable?.departamento || '';
    const fechaGen = new Date().toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Formatear evidencias requeridas como lista en una sola casilla
    let listaEv: string[] = [];
    if (params.listaEvidencias && params.listaEvidencias.length > 0) {
      listaEv = params.listaEvidencias;
    } else {
      const rawEv = recObj?.arere_evidencia_requerida || recomendacion?.arere_evidencia_requerida || '';
      listaEv = this.parseListaEvidencias(rawEv);
    }
    let textoEvidencias = 'No especificada';
    if (listaEv.length > 0) {
      textoEvidencias = listaEv.map((ev, idx) => `${idx + 1}. ${ev}`).join('\r\n');
    } else if (recObj?.arere_evidencia_requerida && recObj.arere_evidencia_requerida.trim()) {
      textoEvidencias = recObj.arere_evidencia_requerida.trim();
    }

    // Fecha máxima individual y Estado individual al lado del responsable
    const fMaxInd = params.fechaMaximaIndividual
      || responsable?.aredr_fecha_maxima
      || (responsable as any)?.fecha_maxima_individual
      || recObj?.fecha_maxima_individual
      || recObj?.arere_fecha_maxima
      || recomendacion?.fecha_maxima_individual
      || recomendacion?.arere_fecha_maxima
      || '';
    const fechaMaxFormatted = this.normalizeDateToDdmmyyyy(fMaxInd) || (fMaxInd ? String(fMaxInd) : 'Sin fecha');

    let estadoInd = params.estadoIndividual
      || responsable?.estado_individual?.arees_descripcion
      || responsable?.estado_individual
      || responsable?.estado_plazo
      || responsable?.areev_descripcion
      || recObj?.estado_individual?.arees_descripcion
      || recObj?.estado_individual
      || recObj?.estado_seguimiento?.arees_descripcion
      || recomendacion?.estado_seguimiento?.arees_descripcion
      || 'EN PROCESO';

    if (responsable?.estado_plazo === 'CUMPLIDO') {
      estadoInd = 'CUMPLIDA';
    }

    // Encabezado institucional de auditoría
    const headerData: any[][] = [
      ['EMPRESA ELÉCTRICA AMBATO REGIONAL CENTRO NORTE S.A. - EEASA'],
      ['SISTEMA DE SEGUIMIENTO DE RECOMENDACIONES DE AUDITORÍA (SISREC)'],
      ['PLAN DE ACCIÓN DEL RESPONSABLE (VISTA DE AUDITORÍA)'],
      [''],
      ['DATOS DE LA RECOMENDACIÓN:'],
      ['Memorando / Informe:', memo],
      ['Título del Informe:', tituloInf || 'No especificado'],
      ['Recomendación a la que hace referencia:', numRec ? `Recomendación N° ${numRec}` : 'S/N'],
      ['Descripción de la Recomendación:', descRec || 'No especificada'],
      ['Evidencias Requeridas:', textoEvidencias],
      ['Responsable Asignado:', nombreResp, 'Fecha Máx. Individual:', fechaMaxFormatted],
      ['Cargo / Departamento:', `${cargoResp}${depResp ? ' - ' + depResp : ''}`, 'Estado Individual:', estadoInd],
      ['Fecha de Descarga:', fechaGen],
      ['Total Actividades Planificadas:', String(actividades.length)],
      [''],
      ['CRONOGRAMA DE ACTIVIDADES Y ENTREGABLES:']
    ];

    // Filas con exactamente las 4 columnas que ve la auditora
    const dataToExport = actividades.map(act => ({
      'N° Actividad': act.num_actividad,
      'Actividad Planificada': act.actividad || '',
      'Fecha de Ejecución': this.normalizeDateToDdmmyyyy(act.fecha_ejecucion),
      'Entregable Esperado': act.entregable_esperado || ''
    }));

    // Crear libro Excel
    const workbook: XLSX.WorkBook = XLSX.utils.book_new();
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);

    // Agregar tabla de datos debajo del encabezado
    const headerRowCount = headerData.length;
    XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });

    // Anchos de columna óptimos
    worksheet['!cols'] = [
      { wch: 36 }, // N° Actividad / Etiquetas del encabezado
      { wch: 60 }, // Actividad Planificada / Valores del encabezado
      { wch: 24 }, // Fecha de Ejecución / 'Fecha Máx. Individual:' y 'Estado Individual:'
      { wch: 50 }  // Entregable Esperado / Valores secundarios
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plan_Accion_Auditor');

    const cleanName = nombreResp.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_').substring(0, 30);
    const fechaFile = new Date().toISOString().split('T')[0];
    const fileName = `Plan_Accion_Rec_${numRec || 'General'}_${cleanName}_${fechaFile}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  }
}
