import { CommonModule } from '@angular/common';
import { Component, effect, EffectRef, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { RecomendacionesService } from '@features/ai-seguim-recomendaciones/services/recomendaciones.service';
import { ModalHistorialService, ModalHistorialData } from '@features/ai-seguim-recomendaciones/services/modal-historial.service';
import * as XLSX from 'xlsx';
import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';


import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SolicitudResponsableService } from '@features/ai-verificables-respon/services/solicitud/solicitud-responsable.service';
import { Solicitud } from '@features/ai-verificables-respon/models/solicitud_rec';
import { FileService } from '@shared/services/file.service';

export interface HistorialEvento {
  arehi_codigo: number;
  arehi_fecha: string;
  arehi_accion: string;
  arehi_detalle: string;
  arehi_responsable_ant?: string;
  arehi_responsable_nue?: string;
  arehi_fecha_max_ant?: string;
  arehi_fecha_max_nue?: string;
  arehi_auditor?: string;
  arehi_observacion?: string;
  arehi_usuario: string;
  // Campos añadidos para UI
  adjuntoRuta?: string;
  estadoReal?: string;
  directorNombre?: string;
  isGrouped?: boolean;
  subEventos?: HistorialEvento[];
}

@Component({
  selector: 'app-modal-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-historial.component.html',
  styleUrl: './modal-historial.component.css',
})
export class ModalHistorialComponent implements OnDestroy {
  private readonly alertSrv = inject(AlertsStateService);
  protected modalHistorialSrv = inject(ModalHistorialService);
  private readonly recomendacionesSrv = inject(RecomendacionesService);
  private readonly verificablesRespSrv = inject(VerificablesResponsablesService);
  private readonly solicitudRespSrv = inject(SolicitudResponsableService);
  private readonly fileSrv = inject(FileService);

  private historialSubs: Subscription[] = [];
  private requestToken = 0;
  private modalEffectRef: EffectRef;
  protected showContent = signal(false);

  protected recomendacionData: ModalHistorialData | null = null;
  protected eventos: HistorialEvento[] = [];
  protected eventosFiltrados: HistorialEvento[] = [];
  protected isLoading = false;
  protected riesgoOculto = true;
  protected evidenciasOcultas = true;
  protected today = new Date();
  protected responsiblesList: any[] = [];
  protected realDeliverablesList: any[] = [];
  protected realSolicitudesList: Solicitud[] = [];

  // Filtros
  protected filtroAccion = '';
  protected filtroTexto = '';
  protected filtroFechaInicio = '';
  protected filtroFechaFin = '';
  protected filtroResponsable = '';

  private cacheVersion = 0;
  private cacheResponsablesDisponibles: string[] | null = null;
  private cacheResponsablesVersion = -1;
  private cacheAgrupados: { key: string; eventos: HistorialEvento[] }[] | null = null;
  private cacheAgrupadosVersion = -1;
  private cacheParseResponsables: Map<string, { nombre: string; estado: string }[]> = new Map();

  // Tipos de acciones disponibles para el selector de filtro
  protected accionesDisponibles = [
    { value: 'CREACION', label: 'Creación de Recomendación' },
    { value: 'ASIGNACION_RESPONSABLE', label: 'Asignación de Responsable' },
    { value: 'ENVIO_VERIFICABLE', label: 'Envío de Verificable' },
    { value: 'VALIDACION_VERIFICABLE', label: 'Validación de Verificable' },
    { value: 'SOLICITUD_PRORROGA', label: 'Solicitud de Prórroga' },
    { value: 'APROBACION_PRORROGA', label: 'Validación de Solicitud de Prórroga' },
    { value: 'ELIMINACION_VERIFICABLE', label: 'Eliminación de Verificable' },
    { value: 'CAMBIO_ESTADO', label: 'Cambio de Estado' },
    { value: 'VENCIMIENTO', label: 'Vencimiento' }
  ];

  // Vista agrupada por responsable
  protected vistaAgrupada = false;

  // Expansión de texto largo en tarjetas de verificable
  protected expandedDetalleIds = new Set<number>();
  protected toggleDetalleExpanded(id: number): void {
    if (this.expandedDetalleIds.has(id)) {
      this.expandedDetalleIds.delete(id);
    } else {
      this.expandedDetalleIds.add(id);
    }
  }
  protected isDetalleExpanded(id: number): boolean {
    return this.expandedDetalleIds.has(id);
  }
  protected needsTruncation(texto: string | undefined): boolean {
    return !!texto && texto.length > 200;
  }
  protected getDetalleCorto(texto: string | undefined): string {
    if (!texto) return '';
    return texto.length > 200 ? texto.substring(0, 200) + '...' : texto;
  }

  protected get evidenciasRequeridas(): string[] {
    const texto = this.recomendacionData?.evidenciaRequerida?.trim() || '';
    if (!texto) return [];
    return /^1[.)]\s+/.test(texto)
      ? texto.split(/(?:\r?\n)+(?=\d+[.)]\s+)/).map(item => item.replace(/^\d+[.)]\s+/, ''))
      : [texto];
  }

  protected getAuditorName(): string {
    return this.recomendacionData?.auditor ||
      (this.eventos.find(e => e.arehi_auditor && e.arehi_auditor !== 'Auditor Encargado' && e.arehi_auditor !== 'Auditor Asignado')?.arehi_auditor) ||
      (this.eventos.length > 0 ? this.eventos[0].arehi_auditor : '') ||
      'No Asignado';
  }

  // Para VALIDACION_VERIFICABLE: simplificar el detalle ocultando el texto entre paréntesis
  protected getDetalleSimplificado(evento: HistorialEvento): string {
    const detalle = evento.arehi_detalle || '';
    if (evento.arehi_accion === 'VALIDACION_VERIFICABLE') {
      // El detalle dice "Evaluación de verificable por auditor. (Verificable: "...")"
      // Simplificamos: solo mostrar la parte antes del paréntesis
      const idx = detalle.indexOf('(Verificable:');
      if (idx > 0) return detalle.substring(0, idx).trim();
      const idx2 = detalle.indexOf('(');
      if (idx2 > 0 && idx2 < 80) return detalle.substring(0, idx2).trim();
    }
    return detalle;
  }
  protected isVerificableAccion(evento: HistorialEvento): boolean {
    return evento.arehi_accion === 'ENVIO_VERIFICABLE' || evento.arehi_accion === 'ELIMINACION_VERIFICABLE';
  }

  constructor() {
    this.modalEffectRef = effect(() => {
      const data = this.modalHistorialSrv.modalData();
      if (data) {
        this.recomendacionData = data;
        this.riesgoOculto = true;
        this.evidenciasOcultas = true;
        this.showContent.set(false);
        this.limpiarFiltros();
        this.cancelarPeticionesPendientes();
        requestAnimationFrame(() => {
          this.showContent.set(true);
          this.obtenerHistorial(data.id_rec);
        });
      }
    }, { allowSignalWrites: true });
  }

  private cancelarPeticionesPendientes() {
    this.historialSubs.forEach(sub => sub.unsubscribe());
    this.historialSubs = [];
  }

  ngOnDestroy(): void {
    this.cancelarPeticionesPendientes();
    this.modalEffectRef.destroy();
  }

  protected closeModal() {
    this.showContent.set(false);
    this.cacheVersion++;
    this.cacheResponsablesDisponibles = null;
    this.cacheResponsablesVersion = -1;
    this.cacheAgrupados = null;
    this.cacheAgrupadosVersion = -1;
    this.cacheParseResponsables.clear();
    this.cancelarPeticionesPendientes();
    this.modalHistorialSrv.closeModal();
    this.eventos = [];
    this.eventosFiltrados = [];
    this.recomendacionData = null;
  }

  protected descargarArchivo(ruta: string | undefined, fileNameFallback: string) {
    if (!ruta) return;
    const fileName = ruta.substring(ruta.lastIndexOf('/') + 1) || fileNameFallback;
    this.fileSrv.getFile(ruta).subscribe({
      next: (res: any) => {
        if (res && res.codigo === 1 && res.datos) {
          if (res.datos.archivo) {
            this.downloadBase64File(res.datos.archivo, fileName);
          } else if (typeof res.datos === 'string') {
            this.downloadBase64File(res.datos, fileName);
          }
        } else {
          this.alertSrv.showAlert(
            res?.mensaje || 'Error al obtener el archivo. Consulte con el administrador del sistema.',
            'error'
          );
        }
      },
      error: (error: any) => {
        console.error(error);
        const mensaje = error?.error?.mensaje || error?.message || 'Error al procesar la solicitud. Consulte con el administrador del sistema.';
        this.alertSrv.showAlert(mensaje, 'error');
      }
    });
  }

  private downloadBase64File(base64Data: string, fileName: string) {
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' }); // default to PDF for verificables/solicitudes
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error procesando el archivo para descarga:', e);
      this.alertSrv.showAlert('Error procesando el archivo.', 'error');
    }
  }

  protected obtenerHistorial(id_rec: number) {
    this.isLoading = true;
    const miToken = ++this.requestToken;
    let rawHistorial: HistorialEvento[] = [];

    const reejecutarSanitizacion = () => {
      if (miToken !== this.requestToken) return;
      this.eventos = this.sanitizarYOrdenarEventos(rawHistorial);
      this.aplicarFiltros();
    };

    // 1. Cargar historial principal (incluye solicitudes de prórroga integradas)
    const sub1 = this.recomendacionesSrv.getHistorialRecomendacion(id_rec).subscribe({
      next: (res) => {
        if (miToken !== this.requestToken) return;
        if (res && res.datos) {
          if (Array.isArray(res.datos)) {
            rawHistorial = res.datos;
          } else {
            rawHistorial = res.datos.historial || [];
            const solicitudes = res.datos.solicitudes || [];
            this.realSolicitudesList = solicitudes;
            // Pre-crear eventos sintéticos para solicitudes sin evento matching
            solicitudes.forEach((sol: Solicitud) => {
              const respNombre = sol.responsable ? sol.responsable.nombre_completo : '';
              const yaExiste = rawHistorial.some((e: any) =>
                e.arehi_accion === 'SOLICITUD_PRORROGA' &&
                (e.arehi_codigo === sol.areso_codigo || (respNombre && this.compararNombresFlex(e.arehi_responsable_nue, respNombre)))
              );
              if (!yaExiste) {
                const auditorDefault = this.recomendacionData?.auditor || (rawHistorial.find((e: any) => e.arehi_auditor)?.arehi_auditor) || 'Auditor Encargado';
                const estadoAprobRaw = sol.asero_estado_aprob !== undefined && sol.asero_estado_aprob !== null
                  ? String(sol.asero_estado_aprob).trim()
                  : ((sol as any).areso_estado_aprob !== undefined && (sol as any).areso_estado_aprob !== null ? String((sol as any).areso_estado_aprob).trim() : '');

                let estadoRealSol = 'PENDIENTE';
                if (['3', 'A', '3L'].includes(estadoAprobRaw)) {
                  estadoRealSol = 'APROBADA';
                } else if (['2', 'P', '2L'].includes(estadoAprobRaw)) {
                  estadoRealSol = 'PREAPROBADA';
                } else if (['4', 'R', '4L'].includes(estadoAprobRaw)) {
                  estadoRealSol = 'RECHAZADA';
                }

                rawHistorial.push({
                  arehi_codigo: sol.areso_codigo || (-666000 - Math.floor(Math.random() * 100000)),
                  arehi_fecha: sol.areso_fecha_carga || new Date().toISOString(),
                  arehi_accion: 'SOLICITUD_PRORROGA',
                  arehi_detalle: 'Solicitud de prórroga por fecha máxima de cumplimiento.',
                  arehi_responsable_nue: respNombre,
                  arehi_fecha_max_ant: sol.areso_fecha_max_ant,
                  arehi_fecha_max_nue: sol.areso_fecha_max_nue,
                  arehi_auditor: auditorDefault,
                  arehi_usuario: respNombre || 'Sistema',
                  arehi_observacion: sol.areso_descripcion,
                  adjuntoRuta: sol.areso_adjunto,
                  estadoReal: estadoRealSol
                } as HistorialEvento);
              }
            });
          }
        }
        reejecutarSanitizacion();
        this.isLoading = false;
      },
      error: (err) => {
        if (miToken !== this.requestToken) return;
        console.error('[Historial] Error obteniendo historial principal:', err);
        rawHistorial = [];
        reejecutarSanitizacion();
        this.isLoading = false;
      }
    });

    // 2. Cargar detalle de recomendación en segundo plano
    const sub2 = this.recomendacionesSrv.getRecomendacionDetail(id_rec).subscribe({
      next: (resDet) => {
        if (miToken !== this.requestToken) return;
        if (resDet && resDet.datos) {
          const detail = resDet.datos;
          const recActual = detail.recomendaciones || detail.recomendacion || detail;
          const evidencias = recActual.arere_evidencias_requeridas ?? recActual.arereEvidenciasRequeridas;
          const textoEvidencias = Array.isArray(evidencias)
            ? evidencias.map((e: any, index: number) => `${index + 1}. ${e.arer_descripcion ?? e.arerDescripcion ?? ''}`).join('\n')
            : undefined;
          if (this.recomendacionData) {
            const listResp = detail.lista_responsables || detail.listaResponsables;
            const progRec = detail.recomendaciones?.arere_progreso !== undefined ? detail.recomendaciones.arere_progreso : detail.recomendaciones?.arereProgreso;
            const estadoRec = detail.recomendaciones?.estado_seguimiento?.arees_descripcion || detail.recomendaciones?.estadoSeguimiento?.arees_descripcion;

            let progresoRec = estadoRec === 'CUMPLIDA' ? 100 : (progRec || 0) * 100;
            const progInf = detail.ainin_progreso !== undefined ? detail.ainin_progreso : detail.aininProgreso;
            const progresoInf = (progInf || 0) * 100;
            const fechaInicioControl = detail.recomendaciones?.arere_fecha_inicio_control || detail.recomendaciones?.arereFechaInicioControl;
            const fechaMaximaRec = detail.recomendaciones?.arere_fecha_maxima || detail.recomendaciones?.arereFechaMaxima;

            this.recomendacionData = {
              ...this.recomendacionData,
              riesgoVerificado: recActual.arere_riesgo_verificado ?? recActual.arereRiesgoVerificado ?? this.recomendacionData.riesgoVerificado ?? null,
              evidenciaRequerida: textoEvidencias ?? recActual.arere_evidencia_requerida ?? recActual.arereEvidenciaRequerida ?? this.recomendacionData.evidenciaRequerida ?? null,
              lista_responsables: listResp || this.recomendacionData.lista_responsables,
              progreso_rec: progresoRec,
              progreso_inf: progresoInf,
              arere_fecha_inicio_control: fechaInicioControl,
              arere_fecha_maxima: fechaMaximaRec || this.recomendacionData.arere_fecha_maxima,
              auditor: detail.ainin_usuario || detail.aininUsuario || this.recomendacionData.auditor
            };
          }
          this.cacheParseResponsables.clear();
          reejecutarSanitizacion();
        }
      },
      error: (err) => console.error('[Historial] Error ignorado en detalle:', err)
    });

    // 3. Cargar responsables completos en segundo plano
    const sub3 = this.recomendacionesSrv.getResponsables(id_rec).subscribe({
      next: (resResp) => {
        if (miToken !== this.requestToken) return;
        if (resResp && resResp.datos) {
          this.responsiblesList = resResp.datos;
          this.cacheParseResponsables.clear();
          reejecutarSanitizacion();
        }
      },
      error: (err) => console.error('[Historial] Error ignorado en responsables:', err)
    });

    // 4. Cargar verificables reales en segundo plano
    const sub4 = this.verificablesRespSrv.getVerificablesResp(id_rec, '0').subscribe({
      next: (resVerif) => {
        if (miToken !== this.requestToken) return;
        if (resVerif && resVerif.datos && resVerif.datos.verificables) {
          this.realDeliverablesList = resVerif.datos.verificables;
          this.cacheParseResponsables.clear();
          reejecutarSanitizacion();
        }
      },
      error: (err) => console.error('[Historial] Error ignorado en verificables:', err)
    });

    this.historialSubs.push(sub1, sub2, sub3, sub4);
  }

  private formatFechaBonita(fechaStr: string | undefined): string {
    if (!fechaStr) return '';
    try {
      const matchIso = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (matchIso) {
        return `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`;
      }
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return fechaStr;
      const dia = String(fecha.getUTCDate()).padStart(2, '0');
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const anio = fecha.getUTCFullYear();
      return `${dia}/${mes}/${anio}`;
    } catch {
      return fechaStr;
    }
  }

  private limpiarTextoUTF8(texto: string | undefined): string {
    if (!texto) return '';
    let res = texto
      .replace(/\b(\d{4})-(\d{2})-(\d{2})T[0-9:.+-]+\b/g, (m, y, mo, d) => `${d}/${mo}/${y}`)
      .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => `${d}/${mo}/${y}`)
      .replace(/\bSe asigno\b/g, 'Se asignó')
      .replace(/\bse asigno\b/g, 'se asignó')
      .replace(/\bSe reasigno\b/g, 'Se reasignó')
      .replace(/\bse reasigno\b/g, 'se reasignó')
      .replace(/\bSe cargo\b/g, 'Se cargó')
      .replace(/\bse cargo\b/g, 'se cargó')
      .replace(/\bSe creo\b/g, 'Se creó')
      .replace(/\bse creo\b/g, 'se creó')
      .replace(/\bSe elimino\b/g, 'Se eliminó')
      .replace(/\bse elimino\b/g, 'se eliminó')
      .replace(/\bvalido\b/g, 'validó')
      .replace(/\bValido\b/g, 'Validó')
      .replace(/\bCreacion\b/g, 'Creación')
      .replace(/\bcreacion\b/g, 'creación')
      .replace(/\bValidacion\b/g, 'Validación')
      .replace(/\bvalidacion\b/g, 'validación')
      .replace(/\bProrroga\b/g, 'Prórroga')
      .replace(/\bprorroga\b/g, 'prórroga')
      .replace(/\bAsignacion\b/g, 'Asignación')
      .replace(/\basignacion\b/g, 'asignación')
      .replace(/\bReasignacion\b/g, 'Reasignación')
      .replace(/\breasignacion\b/g, 'reasignación')
      .replace(/\bPreaprobacion\b/g, 'Preaprobación')
      .replace(/\bpreaprobacion\b/g, 'preaprobación')
      .replace(/\bInformacion\b/g, 'Información')
      .replace(/\binformacion\b/g, 'información')
      .replace(/\bEvaluacion\b/g, 'Evaluación')
      .replace(/\bevaluacion\b/g, 'evaluación')
      .replace(/\bEliminacion\b/g, 'Eliminación')
      .replace(/\beliminacion\b/g, 'eliminación');
    return res;
  }

  protected sanitizarYOrdenarEventos(datos: HistorialEvento[]): HistorialEvento[] {
    const listaInicial = datos || [];

    // Clonamos la lista para no mutar el original
    let copia = listaInicial.map(d => ({
      ...d,
      arehi_accion: this.limpiarTextoUTF8(d.arehi_accion),
      arehi_detalle: this.limpiarTextoUTF8(d.arehi_detalle)
    }));

    // Reclasificar PRORROGAS existentes que son en realidad actualizaciones de fecha directas
    copia.forEach(e => {
      if (e.arehi_accion === 'PRORROGA' && e.arehi_detalle &&
        e.arehi_detalle.toLowerCase().includes('modificaci')) {
        e.arehi_accion = 'ACTUALIZACION_FECHA';
        e.arehi_auditor = undefined;
      }
    });

    // Standardize all responsible names using responsiblesList canonical names
    if (this.responsiblesList && this.responsiblesList.length > 0) {
      copia.forEach(e => {
        if (e.arehi_responsable_nue) {
          const canon = this.responsiblesList.find(r => this.compararNombresFlex(r.nombre_completo, e.arehi_responsable_nue!));
          if (canon) {
            e.arehi_responsable_nue = canon.nombre_completo;
          }
        }
        if (e.arehi_responsable_ant) {
          const canonAnt = this.responsiblesList.find(r => this.compararNombresFlex(r.nombre_completo, e.arehi_responsable_ant!));
          if (canonAnt) {
            e.arehi_responsable_ant = canonAnt.nombre_completo;
          }
        }
      });
    }

    const auditorDefault = this.recomendacionData?.auditor || copia.find(e => e.arehi_auditor)?.arehi_auditor || 'Auditor Encargado';

    const esEventoAsignacion = (accion: string) => {
      if (!accion) return false;
      const accLower = accion.toLowerCase();
      return accion === 'ASIGNACION_RESPONSABLE' ||
        accLower.includes('asignacion') ||
        accLower.includes('asignación') ||
        accLower.includes('reasignacion') ||
        accLower.includes('reasignación');
    };

    const obtenerPredecesorReal = (respNombre: string): string | undefined => {
      if (!this.responsiblesList || this.responsiblesList.length === 0) return undefined;
      const prevResp = this.responsiblesList.find(r =>
        r.arers_estado === '0' &&
        r.arers_reemp_por &&
        this.compararNombresFlex(r.arers_reemp_por, respNombre)
      );
      return prevResp ? prevResp.nombre_completo : undefined;
    };

    // 0. Sincronizar fecha real y datos de asignación utilizando ARERS_FECHA de la base de datos (Fuente de Verdad)
    if (this.responsiblesList && this.responsiblesList.length > 0) {
      copia.forEach(e => {
        if (esEventoAsignacion(e.arehi_accion) && e.arehi_responsable_nue) {
          const respReal = this.responsiblesList.find(r =>
            this.compararNombresFlex(r.nombre_completo, e.arehi_responsable_nue!)
          );

          if (respReal && respReal.arers_fecha) {
            e.arehi_fecha = respReal.arers_fecha;
          }

          const predecesor = obtenerPredecesorReal(e.arehi_responsable_nue);
          if (predecesor) {
            e.arehi_responsable_ant = predecesor;
            e.arehi_accion = 'Reasignación de Responsable';
          } else {
            e.arehi_responsable_ant = undefined;
            e.arehi_accion = 'ASIGNACION_RESPONSABLE';
          }
        }
      });
    }

    // 0.5 Ajustar la fecha de las asignaciones/reasignaciones si hay actividades del mismo responsable registradas con fecha anterior (registro tardío en BD)
    copia.forEach(e => {
      if (esEventoAsignacion(e.arehi_accion) && e.arehi_responsable_nue) {
        const eventosResponsable = copia.filter(other =>
          other.arehi_codigo !== e.arehi_codigo &&
          !esEventoAsignacion(other.arehi_accion) &&
          other.arehi_accion !== 'CREACION' &&
          other.arehi_accion !== 'Creación de Recomendación' &&
          other.arehi_responsable_nue &&
          this.compararNombresFlex(other.arehi_responsable_nue, e.arehi_responsable_nue!)
        );

        if (eventosResponsable.length > 0) {
          let minFecha = this.parsearFechaJS(e.arehi_fecha).getTime();
          eventosResponsable.forEach(other => {
            const f = this.parsearFechaJS(other.arehi_fecha).getTime();
            if (f < minFecha) {
              minFecha = f;
            }
          });

          const fechaAsigOrig = this.parsearFechaJS(e.arehi_fecha).getTime();
          if (minFecha < fechaAsigOrig) {
            // Ajustamos la fecha de la asignación a 5 minutos antes de la primera actividad del responsable
            const nuevaFecha = new Date(minFecha - 5 * 60 * 1000);
            e.arehi_fecha = nuevaFecha.toISOString();
          }
        }
      }
    });

    // 0.8 Garantizar que CADA responsable (de responsiblesList o recomendacionData.lista_responsables) posea su evento real de Asignación / Reasignación en la línea de tiempo
    const todosRespNombres = new Set<string>();

    if (this.responsiblesList && this.responsiblesList.length > 0) {
      this.responsiblesList.forEach(r => {
        const n = r.nombre_completo;
        if (n && n.trim()) todosRespNombres.add(n.trim());
      });
    }

    if (this.recomendacionData?.lista_responsables) {
      const parsedResp = this.parseResponsables(this.recomendacionData.lista_responsables);
      parsedResp.forEach(p => {
        if (p.nombre && p.nombre.trim()) todosRespNombres.add(p.nombre.trim());
      });
    }

    todosRespNombres.forEach(respNombre => {
      const tieneAsignacion = copia.some(e =>
        esEventoAsignacion(e.arehi_accion) && e.arehi_responsable_nue && this.compararNombresFlex(e.arehi_responsable_nue, respNombre)
      );

      if (!tieneAsignacion) {
        const rCoincidente = this.responsiblesList?.find(r => r.nombre_completo && this.compararNombresFlex(r.nombre_completo, respNombre));
        const predecesor = obtenerPredecesorReal(respNombre);
        const esReasig = !!predecesor;
        const fechaAsigReal = rCoincidente?.arers_fecha || (copia.length > 0 ? copia[0].arehi_fecha : (this.recomendacionData?.arere_fecha_inicio_control || new Date().toISOString()));

        const asigSintetizada: HistorialEvento = {
          arehi_codigo: -777777 - Math.floor(Math.random() * 100000),
          arehi_fecha: fechaAsigReal,
          arehi_accion: esReasig ? 'Reasignación de Responsable' : 'ASIGNACION_RESPONSABLE',
          arehi_detalle: esReasig
            ? `Se reasignó el responsable. Nuevo: ${respNombre} (Anterior: ${predecesor}).`
            : `Se asignó como responsable a: ${respNombre}.`,
          arehi_responsable_nue: respNombre,
          arehi_responsable_ant: predecesor,
          arehi_auditor: auditorDefault,
          arehi_usuario: auditorDefault
        };
        copia.push(asigSintetizada);
      }
    });

    // 0.9 Deduplicar eventos de Asignación / Reasignación por responsable para evitar tarjetas repetidas
    const asigVistas = new Set<string>();
    copia = copia.filter(e => {
      if (esEventoAsignacion(e.arehi_accion)) {
        const key = (e.arehi_responsable_nue || '').trim().toLowerCase();
        if (asigVistas.has(key)) {
          return false; // Descartar asignación duplicada para el mismo funcionario
        }
        asigVistas.add(key);
      }
      return true;
    });

    // 1. Extraer todas las reasignaciones históricas reales para construir la cadena de reemplazos
    const reasignaciones: { ant: string, nue: string, fecha: string }[] = [];
    copia.forEach(e => {
      if (this.esReasignacion(e, copia)) {
        reasignaciones.push({
          ant: e.arehi_responsable_ant!.trim(),
          nue: e.arehi_responsable_nue!.trim(),
          fecha: e.arehi_fecha
        });
      }
    });
    // 1.5 Limpiar arehi_responsable_ant para eventos de asignación que NO son reasignación real
    copia.forEach(e => {
      if (esEventoAsignacion(e.arehi_accion) && !this.esReasignacion(e, copia)) {
        e.arehi_responsable_ant = undefined;
      }
    });
    // Función recursiva para obtener el sucesor activo en la fecha del evento
    const obtenerSucesorEnFecha = (nombre: string, fechaEv: Date): string => {
      if (!nombre || !nombre.trim()) return '';
      let actual = nombre.trim();
      const visitados = new Set<string>();
      let maxIter = 10;

      while (maxIter > 0) {
        maxIter--;
        const actualKey = actual.toLowerCase();
        if (visitados.has(actualKey)) break;
        visitados.add(actualKey);

        const reemplazo = reasignaciones.find(r =>
          r.ant && r.nue &&
          this.compararNombresFlex(r.ant, actual) &&
          !this.compararNombresFlex(r.ant, r.nue) &&
          this.parsearFechaJS(r.fecha).getTime() <= fechaEv.getTime()
        );

        if (reemplazo && reemplazo.nue) {
          actual = reemplazo.nue.trim();
        } else {
          break;
        }
      }
      return actual;
    };

    const getDeliverableResponsible = (v: any): string => {
      if (!v) return '';
      if (v.responsable?.nombre_completo) return v.responsable.nombre_completo;
      if (v.responsable_nombre) return v.responsable_nombre;
      if (v.arers_nombre) return v.arers_nombre;
      if (v.nombre_completo) return v.nombre_completo;

      if (this.responsiblesList && this.responsiblesList.length > 0) {
        if (v.arers_codigo_per) {
          const match = this.responsiblesList.find(r => r.arers_codigo_per === v.arers_codigo_per);
          if (match) return match.nombre_completo;
        }
        if (v.arers_codigo) {
          const match = this.responsiblesList.find(r => r.arers_codigo === v.arers_codigo);
          if (match) return match.nombre_completo;
        }
        const activo = this.responsiblesList.find(r => r.arers_estado === '1');
        if (activo) return activo.nombre_completo;
        return this.responsiblesList[0].nombre_completo;
      }

      if (this.recomendacionData?.lista_responsables) {
        const parsed = this.parseResponsables(this.recomendacionData.lista_responsables);
        if (parsed.length > 0) return parsed[0].nombre;
      }

      return '';
    };

    // 2. Corregir y normalizar responsables, adjuntos y detalles de los envíos de verificables
    const usedDeliverableIdsEnvio = new Set<number>();
    copia.forEach(evento => {
      if (evento.arehi_accion === 'ENVIO_VERIFICABLE') {
        let matchingRealVerif: any = null;
        if (this.realDeliverablesList && this.realDeliverablesList.length > 0) {
          matchingRealVerif = this.realDeliverablesList.find(v => {
            if (usedDeliverableIdsEnvio.has(v.areve_codigo)) return false;
            if (v.areve_adjunto) {
              const parts = v.areve_adjunto.split('/');
              const filename = parts[parts.length - 1];
              if (filename && filename.trim() !== '' && evento.arehi_detalle.toLowerCase().includes(filename.toLowerCase())) {
                return true;
              }
            }
            if (v.areve_descripcion && v.areve_descripcion.trim() !== '') {
              if (evento.arehi_detalle.toLowerCase().includes(v.areve_descripcion.toLowerCase().trim())) {
                return true;
              }
            }
            if (v.areve_fecha_carga) {
              const diffTime = Math.abs(this.parsearFechaJS(evento.arehi_fecha).getTime() - this.parsearFechaJS(v.areve_fecha_carga).getTime());
              if (diffTime <= 5 * 60 * 1000) {
                return true;
              }
            }
            return false;
          });

          // Fallback: Si no coincidió por nombre exacto ni por fecha de 5 min, buscar el siguiente entregable no usado del mismo responsable
          if (!matchingRealVerif) {
            matchingRealVerif = this.realDeliverablesList.find(v => {
              if (usedDeliverableIdsEnvio.has(v.areve_codigo)) return false;
              const respV = getDeliverableResponsible(v);
              if (respV && (
                (evento.arehi_responsable_nue && this.compararNombresFlex(respV, evento.arehi_responsable_nue)) ||
                (evento.arehi_usuario && this.compararNombresFlex(respV, evento.arehi_usuario))
              )) {
                return true;
              }
              return false;
            });
          }

          if (matchingRealVerif) {
            usedDeliverableIdsEnvio.add(matchingRealVerif.areve_codigo);
            (evento as any).areve_codigo = matchingRealVerif.areve_codigo;
            if (matchingRealVerif.areve_fecha_carga) {
              evento.arehi_fecha = matchingRealVerif.areve_fecha_carga;
            }
            const respOficial = getDeliverableResponsible(matchingRealVerif);
            if (respOficial) {
              evento.arehi_responsable_nue = respOficial;
            }
            if (matchingRealVerif.estado_seguimiento && matchingRealVerif.estado_seguimiento.areev_descripcion) {
              evento.estadoReal = matchingRealVerif.estado_seguimiento.areev_descripcion.toUpperCase().trim();
            }
            if (matchingRealVerif.areve_adjunto) {
              evento.adjuntoRuta = matchingRealVerif.areve_adjunto;
            }
            if (matchingRealVerif.areve_motivo_estado && matchingRealVerif.areve_motivo_estado.trim() !== '' && matchingRealVerif.areve_motivo_estado.trim().toLowerCase() !== 'ninguna') {
              evento.arehi_observacion = matchingRealVerif.areve_motivo_estado;
            }

            // Normalizar detalle si contiene placeholder genérico migrado "verificable original"
            const adjName = matchingRealVerif.areve_adjunto ? matchingRealVerif.areve_adjunto.substring(matchingRealVerif.areve_adjunto.lastIndexOf('/') + 1) : '';
            const nombreVerif = (matchingRealVerif.areve_descripcion || adjName || '').trim();

            if (nombreVerif && (evento.arehi_detalle.toLowerCase().includes('verificable original') || !evento.arehi_detalle.includes('"'))) {
              evento.arehi_detalle = `Se cargó el archivo verificable: "${nombreVerif}".`;
            }
          }
        }

        const usrNombre = (evento.arehi_usuario || '').trim();
        const audNombre = (evento.arehi_auditor || '').trim();

        if (!evento.arehi_responsable_nue || evento.arehi_responsable_nue.trim() === '') {
          if (usrNombre && usrNombre.toLowerCase() !== audNombre.toLowerCase() &&
            !usrNombre.toLowerCase().includes('auditor') && !usrNombre.toLowerCase().includes('sistema') && !usrNombre.toLowerCase().includes('system')) {
            evento.arehi_responsable_nue = usrNombre;
          }
        }

        if (!matchingRealVerif && evento.arehi_responsable_nue) {
          evento.arehi_responsable_nue = obtenerSucesorEnFecha(evento.arehi_responsable_nue, this.parsearFechaJS(evento.arehi_fecha));
        }

        const adjuntoMatch = evento.arehi_detalle.match(/\(Adjunto:\s*(.*?)\)/);
        if (adjuntoMatch && adjuntoMatch[1]) {
          evento.adjuntoRuta = adjuntoMatch[1].trim();
          evento.arehi_detalle = evento.arehi_detalle.replace(adjuntoMatch[0], '').trim();
        }
      }
    });

    // 2.5 Deduplicar eventos de ENVIO_VERIFICABLE que hacen referencia al mismo entregable para el mismo responsable
    const enviosVistos: HistorialEvento[] = [];
    copia = copia.filter(e => {
      if (e.arehi_accion === 'ENVIO_VERIFICABLE') {
        const duplicado = enviosVistos.find(prev => {
          if ((e as any).areve_codigo && (prev as any).areve_codigo) {
            return (e as any).areve_codigo === (prev as any).areve_codigo;
          }
          if (e.arehi_codigo > 0 && prev.arehi_codigo > 0) {
            return e.arehi_codigo === prev.arehi_codigo;
          }
          return false;
        });

        if (duplicado) {
          return false; // Descartar únicamente eventos verdaderamente idénticos por ID
        }
        enviosVistos.push(e);
      }
      return true;
    });

    // 2.8 Garantizar que CADA entregable real registrado en base de datos tenga su correspondiente evento ENVIO_VERIFICABLE en la bitácora
    if (this.realDeliverablesList && this.realDeliverablesList.length > 0) {
      this.realDeliverablesList.forEach(v => {
        const respNombre = getDeliverableResponsible(v);
        const adjName = v.areve_adjunto ? v.areve_adjunto.substring(v.areve_adjunto.lastIndexOf('/') + 1) : '';
        const descVerif = (v.areve_descripcion || adjName || '').trim();
        const estadoVerif = v.estado_seguimiento?.areev_descripcion ? v.estado_seguimiento.areev_descripcion.toUpperCase().trim() : 'PENDIENTE';

        const existeEnvio = copia.some(e => {
          if (e.arehi_accion !== 'ENVIO_VERIFICABLE') return false;
          if ((e as any).areve_codigo && (e as any).areve_codigo === v.areve_codigo) {
            return true;
          }
          if (v.areve_adjunto && e.adjuntoRuta && v.areve_adjunto === e.adjuntoRuta) {
            return true;
          }
          return false;
        });

        if (!existeEnvio) {
          const fBase = v.areve_fecha_carga || v.areve_fecha_validacion;
          const fechaEnvio = fBase
            ? (v.areve_fecha_carga
              ? v.areve_fecha_carga
              : new Date(this.parsearFechaJS(fBase).getTime() - 2 * 60 * 1000).toISOString())
            : new Date().toISOString();

          const envioSintetizado: HistorialEvento = {
            arehi_codigo: -777000 - Math.floor(Math.random() * 100000),
            arehi_fecha: fechaEnvio,
            arehi_accion: 'ENVIO_VERIFICABLE',
            arehi_detalle: `Se cargó el archivo verificable: "${descVerif}".`,
            arehi_responsable_nue: respNombre,
            arehi_auditor: auditorDefault,
            arehi_usuario: respNombre || 'Sistema',
            adjuntoRuta: v.areve_adjunto,
            estadoReal: estadoVerif,
            areve_codigo: v.areve_codigo
          } as any;
          copia.push(envioSintetizado);
        }
      });
    }

    // 3. Garantizar que solo los entregables realmente evaluados en BD tengan su correspondiente evento de validación en la línea de tiempo
    if (this.realDeliverablesList && this.realDeliverablesList.length > 0) {
      this.realDeliverablesList.forEach(v => {
        const respNombre = getDeliverableResponsible(v);
        const adjName = v.areve_adjunto ? v.areve_adjunto.substring(v.areve_adjunto.lastIndexOf('/') + 1) : '';
        const descVerif = (v.areve_descripcion || adjName || '').trim();
        const estadoVerif = v.estado_seguimiento?.areev_descripcion ? v.estado_seguimiento.areev_descripcion.toUpperCase().trim() : 'PENDIENTE';

        // Solo crear validación si el entregable YA fue evaluado o posee fecha de validación
        if (estadoVerif === 'PENDIENTE' && !v.areve_fecha_validacion) {
          return;
        }

        // Buscar si ya existe una validación que corresponda a este entregable específico
        const existeValidacion = copia.some(e => {
          if (e.arehi_accion !== 'VALIDACION_VERIFICABLE') return false;
          if ((e as any).areve_codigo && (e as any).areve_codigo === v.areve_codigo) {
            return true;
          }
          if (v.areve_adjunto && e.adjuntoRuta && v.areve_adjunto === e.adjuntoRuta) {
            return true;
          }
          return false;
        });

        if (!existeValidacion) {
          const fBase = v.areve_fecha_validacion || v.areve_fecha_carga;
          const fechaVal = fBase
            ? (v.areve_fecha_validacion || new Date(this.parsearFechaJS(fBase).getTime() + 2 * 60 * 1000).toISOString())
            : new Date().toISOString();

          const obsReal = (v.areve_motivo_estado && v.areve_motivo_estado.trim() !== '' && v.areve_motivo_estado.trim().toLowerCase() !== 'ninguna')
            ? v.areve_motivo_estado.trim()
            : undefined;

          const eventoSintetizado: HistorialEvento = {
            arehi_codigo: -888888 - Math.floor(Math.random() * 100000),
            arehi_fecha: fechaVal,
            arehi_accion: 'VALIDACION_VERIFICABLE',
            arehi_detalle: `Evaluación de verificable por auditor. (Verificable: "${descVerif}")`,
            arehi_responsable_nue: respNombre,
            arehi_auditor: auditorDefault,
            arehi_usuario: auditorDefault,
            arehi_observacion: obsReal,
            estadoReal: estadoVerif
          };
          copia.push(eventoSintetizado);
        }
      });
    }

    // 3.5 Garantizar que solo los eventos de envío cuyo entregable esté evaluado tengan validación sintetizada
    copia.forEach(envio => {
      if (envio.arehi_accion === 'ENVIO_VERIFICABLE') {
        const matchNombre = envio.arehi_detalle.match(/"([^"]+)"/);
        const nombreVerif = matchNombre && matchNombre[1] ? matchNombre[1].trim() : envio.arehi_detalle.trim();
        const respEnvio = (envio.arehi_responsable_nue || '').trim();

        const matchReal = this.realDeliverablesList?.find(v => {
          const adjName = v.areve_adjunto ? v.areve_adjunto.substring(v.areve_adjunto.lastIndexOf('/') + 1) : '';
          const dName = (v.areve_descripcion || adjName || '').trim();
          const normA = this.normalizarNombre(dName);
          const normB = this.normalizarNombre(nombreVerif);
          return normA && normB && (normA.includes(normB) || normB.includes(normA));
        });

        const estadoEnvio = matchReal?.estado_seguimiento?.areev_descripcion
          ? matchReal.estado_seguimiento.areev_descripcion.toUpperCase().trim()
          : (envio.estadoReal || 'PENDIENTE');

        // No sintetizar evento de validación si el entregable sigue en estado PENDIENTE y no hay fecha de validación
        if (estadoEnvio === 'PENDIENTE' && !matchReal?.areve_fecha_validacion) {
          return;
        }

        const tieneValidacionAsociada = copia.some(val => {
          if (val.arehi_accion !== 'VALIDACION_VERIFICABLE') return false;
          if (respEnvio && val.arehi_responsable_nue && !this.compararNombresFlex(val.arehi_responsable_nue, respEnvio)) {
            return false;
          }
          if (nombreVerif && val.arehi_detalle) {
            const normA = this.normalizarNombre(val.arehi_detalle);
            const normB = this.normalizarNombre(nombreVerif);
            if (normA && normB && (normA.includes(normB) || normB.includes(normA))) {
              return true;
            }
          }
          return false;
        });

        if (!tieneValidacionAsociada) {
          const fBase = matchReal?.areve_fecha_validacion || envio.arehi_fecha;
          const fEnvio = this.parsearFechaJS(fBase);
          const fechaVal = matchReal?.areve_fecha_validacion
            ? matchReal.areve_fecha_validacion
            : new Date(fEnvio.getTime() + 2 * 60 * 1000).toISOString();

          const obsVal = (matchReal?.areve_motivo_estado && matchReal.areve_motivo_estado.trim() !== '' && matchReal.areve_motivo_estado.trim().toLowerCase() !== 'ninguna')
            ? matchReal.areve_motivo_estado.trim()
            : undefined;

          const valSintetizada: HistorialEvento = {
            arehi_codigo: -999000 - Math.floor(Math.random() * 100000),
            arehi_fecha: fechaVal,
            arehi_accion: 'VALIDACION_VERIFICABLE',
            arehi_detalle: `Evaluación de verificable por auditor. (Verificable: "${nombreVerif}")`,
            arehi_responsable_nue: respEnvio,
            arehi_auditor: envio.arehi_auditor || auditorDefault,
            arehi_usuario: envio.arehi_auditor || auditorDefault,
            arehi_observacion: obsVal,
            estadoReal: estadoEnvio
          };
          copia.push(valSintetizada);
        }
      }
    });

    // 3.8 Garantizar que CADA solicitud de prórroga registrada en base de datos tenga su correspondiente evento en la bitácora
    if (this.realSolicitudesList && this.realSolicitudesList.length > 0) {
      this.realSolicitudesList.forEach(sol => {
        const respNombre = sol.responsable ? sol.responsable.nombre_completo : '';
        const eventoExistente = copia.find(e =>
          (e.arehi_accion === 'SOLICITUD_PRORROGA' || (e.arehi_accion && e.arehi_accion.toLowerCase().includes('prorrog'))) &&
          (e.arehi_codigo === sol.areso_codigo || (respNombre && this.compararNombresFlex(e.arehi_responsable_nue, respNombre)))
        );

        if (eventoExistente) {
          if (sol.areso_adjunto && !eventoExistente.adjuntoRuta) {
            eventoExistente.adjuntoRuta = sol.areso_adjunto;
          }
        } else {
          const solEvento: HistorialEvento = {
            arehi_codigo: sol.areso_codigo || (-666000 - Math.floor(Math.random() * 100000)),
            arehi_fecha: sol.areso_fecha_carga || new Date().toISOString(),
            arehi_accion: 'SOLICITUD_PRORROGA',
            arehi_detalle: `Solicitud de prórroga por fecha máxima de cumplimiento. Nueva: ${sol.areso_fecha_max_nue || ''} (Anterior: ${sol.areso_fecha_max_ant || ''}).`,
            arehi_responsable_nue: respNombre,
            arehi_fecha_max_ant: sol.areso_fecha_max_ant,
            arehi_fecha_max_nue: sol.areso_fecha_max_nue,
            arehi_auditor: auditorDefault,
            arehi_usuario: respNombre || 'Sistema',
            arehi_observacion: sol.areso_descripcion,
            adjuntoRuta: sol.areso_adjunto,
            estadoReal: sol.asero_estado_aprob ? String(sol.asero_estado_aprob).toUpperCase().trim() : 'PENDIENTE'
          };
          copia.push(solEvento);
        }
      });
    }

    // 4. Alinear y formatear exhaustivamente todas las validaciones de verificables (existentes y sintetizadas)
    const usedDeliverableIdsVal = new Set<number>();
    copia.forEach(evento => {
      if (evento.arehi_accion === 'VALIDACION_VERIFICABLE') {
        const fechaVal = this.parsearFechaJS(evento.arehi_fecha);
        const respVal = (evento.arehi_responsable_nue || '').trim();

        let nombreVerificable = '';

        // A. Buscar correspondencia en la lista de entregables reales de BD
        let matchedVerif: any = null;
        if (this.realDeliverablesList && this.realDeliverablesList.length > 0) {
          matchedVerif = this.realDeliverablesList.find(v => {
            if (usedDeliverableIdsVal.has(v.areve_codigo)) return false;

            if (v.areve_fecha_validacion) {
              const diffTime = Math.abs(this.parsearFechaJS(v.areve_fecha_validacion).getTime() - fechaVal.getTime());
              if (diffTime <= 12 * 60 * 60 * 1000) {
                return true;
              }
            }
            if (v.areve_motivo_estado && evento.arehi_observacion) {
              if (v.areve_motivo_estado.trim().toLowerCase() === evento.arehi_observacion.trim().toLowerCase()) {
                return true;
              }
            }
            if (v.estado_seguimiento && v.estado_seguimiento.areev_descripcion) {
              const estadoVerif = v.estado_seguimiento.areev_descripcion.toUpperCase().trim();
              if (evento.arehi_detalle && evento.arehi_detalle.toUpperCase().includes(estadoVerif)) {
                if (v.responsable && respVal && this.compararNombresFlex(v.responsable.nombre_completo, respVal)) {
                  return true;
                }
              }
            }
            return false;
          });
        }

        if (matchedVerif) {
          usedDeliverableIdsVal.add(matchedVerif.areve_codigo);
          if (matchedVerif.responsable) {
            evento.arehi_responsable_nue = matchedVerif.responsable.nombre_completo;
          }
          if (matchedVerif.estado_seguimiento && matchedVerif.estado_seguimiento.areev_descripcion) {
            evento.estadoReal = matchedVerif.estado_seguimiento.areev_descripcion.toUpperCase().trim();
          }
          const adjuntoName = matchedVerif.areve_adjunto ? matchedVerif.areve_adjunto.substring(matchedVerif.areve_adjunto.lastIndexOf('/') + 1) : '';
          nombreVerificable = (matchedVerif.areve_descripcion || adjuntoName || '').trim();
        }

        // B. Fallback: Buscar en los eventos ENVIO_VERIFICABLE de copia para el mismo responsable
        if (!nombreVerificable) {
          const enviosCandidatos = copia.filter(e =>
            e.arehi_accion === 'ENVIO_VERIFICABLE' &&
            (!respVal || !e.arehi_responsable_nue || this.compararNombresFlex(e.arehi_responsable_nue, respVal))
          );

          let envioCercano: HistorialEvento | null = null;
          let diffMinima = Infinity;

          enviosCandidatos.forEach(env => {
            const fechaEnv = this.parsearFechaJS(env.arehi_fecha).getTime();
            const diff = Math.abs(fechaVal.getTime() - fechaEnv);
            const penalty = fechaEnv <= fechaVal.getTime() ? 0 : 24 * 60 * 60 * 1000;
            if (diff + penalty < diffMinima) {
              diffMinima = diff + penalty;
              envioCercano = env;
            }
          });

          if (envioCercano) {
            if (!evento.arehi_responsable_nue && (envioCercano as HistorialEvento).arehi_responsable_nue) {
              evento.arehi_responsable_nue = (envioCercano as HistorialEvento).arehi_responsable_nue;
            }
            const matchNombre = (envioCercano as HistorialEvento).arehi_detalle.match(/"([^"]+)"/);
            if (matchNombre && matchNombre[1]) {
              nombreVerificable = matchNombre[1].trim();
            } else if ((envioCercano as HistorialEvento).adjuntoRuta) {
              const ruta = (envioCercano as HistorialEvento).adjuntoRuta!;
              nombreVerificable = ruta.substring(ruta.lastIndexOf('/') + 1);
            }
          }
        }

        // Extraer si el detalle original ya posee una etiqueta "(Verificable: ...)"
        const matchVerifExistente = evento.arehi_detalle.match(/\(Verificable:\s*"([^"]+)"\)/i);
        if (matchVerifExistente && matchVerifExistente[1]) {
          if (!nombreVerificable) {
            nombreVerificable = matchVerifExistente[1].trim();
          }
          evento.arehi_detalle = evento.arehi_detalle.replace(matchVerifExistente[0], '').trim();
        }

        // Limpiar patrones de estado de arehi_detalle (ej. "Estado: JUSTIFICA.")
        const estadoRegex = /Estado:\s*(JUSTIFICA|NO JUSTIFICA|PENDIENTE)\.?\s*/i;
        const matchEstado = evento.arehi_detalle.match(estadoRegex);
        if (matchEstado) {
          if (!evento.estadoReal) evento.estadoReal = matchEstado[1].toUpperCase();
          evento.arehi_detalle = evento.arehi_detalle.replace(matchEstado[0], '').trim();
        }

        if (!evento.estadoReal) {
          evento.estadoReal = 'PENDIENTE';
        }

        let baseDetalle = evento.arehi_detalle.trim();
        if (!baseDetalle || baseDetalle.toLowerCase().startsWith('evaluacion de verificable')) {
          baseDetalle = 'Evaluación de verificable por auditor.';
        }

        if (nombreVerificable) {
          evento.arehi_detalle = `${baseDetalle} (Verificable: "${nombreVerificable}")`;
        } else {
          evento.arehi_detalle = baseDetalle;
        }

        if (!matchedVerif && evento.arehi_responsable_nue) {
          evento.arehi_responsable_nue = obtenerSucesorEnFecha(evento.arehi_responsable_nue, fechaVal);
        }

        // Limpiar observaciones automáticas vacías o placeholders "Verificable pendiente..."
        if (matchedVerif?.areve_motivo_estado && matchedVerif.areve_motivo_estado.trim() !== '' && matchedVerif.areve_motivo_estado.trim().toLowerCase() !== 'ninguna') {
          evento.arehi_observacion = matchedVerif.areve_motivo_estado.trim();
        } else if (evento.arehi_observacion) {
          const obsLower = evento.arehi_observacion.toLowerCase();
          if (obsLower.includes('pendiente de evaluación') || obsLower.includes('evaluado por auditor') || obsLower === 'ninguna') {
            evento.arehi_observacion = undefined;
          }
        }
      }
    });

    // Busquemos si hay desajustes de fecha (carga >= validacion) para el mismo responsable y entregable
    copia.forEach(evento => {
      if (evento.arehi_accion === 'VALIDACION_VERIFICABLE') {
        const fechaVal = this.parsearFechaJS(evento.arehi_fecha);
        const respVal = (evento.arehi_responsable_nue || '').trim();

        const matchValNombre = evento.arehi_detalle.match(/\(Verificable:\s*"([^"]+)"\)/i);
        const nombreVal = matchValNombre && matchValNombre[1] ? matchValNombre[1].trim() : '';

        // Buscar un envío de verificable del mismo responsable y entregable con fecha mayor o igual a la validación
        const envioPosterior = copia.find(e => {
          if (e.arehi_accion !== 'ENVIO_VERIFICABLE') return false;
          if (respVal && e.arehi_responsable_nue && !this.compararNombresFlex(e.arehi_responsable_nue, respVal)) return false;

          if (nombreVal) {
            const normA = this.normalizarNombre(e.arehi_detalle);
            const normB = this.normalizarNombre(nombreVal);
            if (normA && normB && !(normA.includes(normB) || normB.includes(normA))) {
              return false;
            }
          }

          const fechaEnv = this.parsearFechaJS(e.arehi_fecha);
          return fechaEnv.getTime() >= fechaVal.getTime();
        });

        if (envioPosterior) {
          // Ajustamos la fecha del envío posterior para que sea 5 minutos antes de la validación
          const nuevaFecha = new Date(fechaVal.getTime() - 5 * 60 * 1000);
          envioPosterior.arehi_fecha = nuevaFecha.toISOString();
        }
      }
    });

    // 4.5 Deduplicar eventos de VALIDACION_VERIFICABLE que hacen referencia al mismo entregable para el mismo responsable
    const validacionesVistas: HistorialEvento[] = [];
    copia = copia.filter(e => {
      if (e.arehi_accion === 'VALIDACION_VERIFICABLE') {
        const matchNombre = e.arehi_detalle.match(/\(Verificable:\s*"([^"]+)"\)/i);
        const nombreVerif = matchNombre && matchNombre[1] ? matchNombre[1].trim() : e.arehi_detalle.trim();

        const duplicado = validacionesVistas.find(prev => {
          const respCoincide = (prev.arehi_responsable_nue && e.arehi_responsable_nue)
            ? this.compararNombresFlex(prev.arehi_responsable_nue, e.arehi_responsable_nue)
            : true;

          const matchPrevNombre = prev.arehi_detalle.match(/\(Verificable:\s*"([^"]+)"\)/i);
          const nombrePrev = matchPrevNombre && matchPrevNombre[1] ? matchPrevNombre[1].trim() : prev.arehi_detalle.trim();

          const normA = this.normalizarNombre(nombreVerif);
          const normB = this.normalizarNombre(nombrePrev);

          const verifCoincide = (normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA)));

          return respCoincide && verifCoincide;
        });

        if (duplicado) {
          if (e.arehi_observacion && (!duplicado.arehi_observacion || e.arehi_observacion.length > duplicado.arehi_observacion.length)) {
            duplicado.arehi_observacion = e.arehi_observacion;
          }
          return false; // Descartar validación duplicada
        }
        validacionesVistas.push(e);
      }
      return true;
    });

    // Ahora eliminamos los placeholders duplicados ("verificable original") si ya existe un envío real ajustado
    copia = copia.filter(evento => {
      if (evento.arehi_accion === 'ENVIO_VERIFICABLE' && (evento.arehi_detalle || '').toLowerCase().includes('verificable original')) {
        const fechaPlaceholder = this.parsearFechaJS(evento.arehi_fecha);
        const respPlaceholder = (evento.arehi_responsable_nue || '').trim();

        // Si ya hay otro ENVIO_VERIFICABLE del mismo responsable en una fecha muy cercana (menos de 10 minutos)
        // que contiene el nombre real del archivo, descartamos el placeholder
        const tieneEnvioReal = copia.some(e => {
          if (e.arehi_accion !== 'ENVIO_VERIFICABLE' || e.arehi_codigo === evento.arehi_codigo) return false;
          const respReal = (e.arehi_responsable_nue || '').trim();
          if (respReal.toLowerCase() !== respPlaceholder.toLowerCase()) return false;

          const fechaReal = this.parsearFechaJS(e.arehi_fecha);
          const diffMinutes = Math.abs(fechaReal.getTime() - fechaPlaceholder.getTime()) / (1000 * 60);

          return diffMinutes <= 10 && !((e.arehi_detalle || '').toLowerCase().includes('verificable original'));
        });

        if (tieneEnvioReal) {
          return false; // Descartamos este placeholder duplicado
        }
      }

      // Filtrar eliminaciones de verificables realizadas por auditor (conservar únicamente las realizadas por el responsable)
      const esEliminacion = evento.arehi_accion === 'ELIMINACION_VERIFICABLE' || (evento.arehi_accion && evento.arehi_accion.toLowerCase().includes('elimin'));
      if (esEliminacion) {
        const detalleLower = (evento.arehi_detalle || '').toLowerCase();
        if (detalleLower.includes('auditor') || detalleLower.includes('auditora')) {
          return false; // Ocultar si fue realizada por un auditor
        }
      }

      return true;
    });

    // 5. Encontrar la fecha en que se completó/cumplió la recomendación como un todo
    let completionDate: Date | null = null;

    // Buscar evento de cambio de estado a CUMPLIDA
    const cambioEstadoCumplida = copia.find(e =>
      e.arehi_accion === 'CAMBIO_ESTADO' &&
      e.arehi_detalle &&
      e.arehi_detalle.toLowerCase().includes('cumplida')
    );

    if (cambioEstadoCumplida) {
      completionDate = this.parsearFechaJS(cambioEstadoCumplida.arehi_fecha);
    } else {
      // Si la recomendación como un todo está cumplida (por ejemplo, progreso_rec === 100),
      // pero no hay evento de cambio de estado registrado en el historial:
      const estadoRec = this.recomendacionData?.lista_responsables;
      const todosJustifican = estadoRec && this.parseResponsables(estadoRec).every(r =>
        r.estado.toUpperCase().trim() === 'JUSTIFICA'
      );

      if (todosJustifican) {
        const validacionesJustifica = copia.filter(e =>
          e.arehi_accion === 'VALIDACION_VERIFICABLE' &&
          e.arehi_detalle &&
          e.arehi_detalle.includes('JUSTIFICA')
        );
        if (validacionesJustifica.length > 0) {
          const sorted = [...validacionesJustifica].sort((a, b) =>
            this.parsearFechaJS(a.arehi_fecha).getTime() - this.parsearFechaJS(b.arehi_fecha).getTime()
          );
          completionDate = this.parsearFechaJS(sorted[sorted.length - 1].arehi_fecha);
        }
      }
    }

    // Filtrar los eventos de prórroga y entregables excedentes
    copia = copia.filter(evento => {
      const fechaEvento = this.parsearFechaJS(evento.arehi_fecha);

      // Regla A: Si la recomendación como un todo ya está cumplida en la fecha del evento
      const esAccionProrroga =
        evento.arehi_accion === 'SOLICITUD_PRORROGA' ||
        evento.arehi_accion === 'PRORROGA' ||
        evento.arehi_accion === 'PREAPROBACION_PRORROGA' ||
        evento.arehi_accion === 'RECHAZO_PRORROGA';

      if (esAccionProrroga && completionDate && fechaEvento.getTime() > completionDate.getTime()) {
        return false;
      }

      // Regla B: Si el responsable de esta acción ya tiene su entregable evaluado como JUSTIFICA con fecha anterior, ocultar ÚNICAMENTE las prórrogas posteriores
      const esAccionProrrogaResp = (accion: string) => {
        if (!accion) return false;
        const accLower = accion.toLowerCase();
        return accLower.includes('prorrog') || accLower.includes('prórrog');
      };

      if (evento.arehi_responsable_nue && esAccionProrrogaResp(evento.arehi_accion)) {
        const yaTieneJustificado = copia.some(e => {
          if (e.arehi_codigo === evento.arehi_codigo) return false;
          if (e.arehi_accion !== 'VALIDACION_VERIFICABLE' || !e.arehi_responsable_nue) return false;

          if (!this.compararNombresFlex(e.arehi_responsable_nue, evento.arehi_responsable_nue)) return false;

          const esJustifica = (e.estadoReal === 'JUSTIFICA') ||
            (e.arehi_detalle && e.arehi_detalle.includes('JUSTIFICA') && !e.arehi_detalle.includes('NO JUSTIFICA'));

          if (!esJustifica) return false;

          const fechaVal = this.parsearFechaJS(e.arehi_fecha);
          return fechaVal.getTime() < fechaEvento.getTime();
        });

        if (yaTieneJustificado) {
          return false;
        }
      }

      return true;
    });

    // Finalmente, volvemos a ordenar cronológicamente
    copia.sort((a, b) => {
      const deA = this.parsearFechaJS(a.arehi_fecha).getTime();
      const deB = this.parsearFechaJS(b.arehi_fecha).getTime();
      if (deA !== deB) {
        return deA - deB;
      }
      // Si la fecha es exactamente igual, nos aseguramos que ENVIO_VERIFICABLE vaya antes que VALIDACION_VERIFICABLE
      if (a.arehi_accion === 'ENVIO_VERIFICABLE' && b.arehi_accion === 'VALIDACION_VERIFICABLE') return -1;
      if (a.arehi_accion === 'VALIDACION_VERIFICABLE' && b.arehi_accion === 'ENVIO_VERIFICABLE') return 1;
      return a.arehi_codigo - b.arehi_codigo;
    });

    // 8. Garantizar que exista el evento de Creación al principio de la cronología utilizando la fecha de aprobación del informe (arere_fecha_inicio_control)
    const fechaCreacion = this.recomendacionData?.arere_fecha_inicio_control;
    const eventoCreacionExistente = copia.find(e =>
      e.arehi_accion === 'Creación de Recomendación' ||
      e.arehi_accion === 'CREACION' ||
      (e.arehi_accion && e.arehi_accion.toLowerCase().includes('creacion'))
    );

    if (eventoCreacionExistente) {
      eventoCreacionExistente.arehi_accion = 'Creación de Recomendación';
      if (fechaCreacion) {
        eventoCreacionExistente.arehi_fecha = fechaCreacion;
      }
    } else {
      const auditor = copia.find(e => e.arehi_auditor)?.arehi_auditor || 'Auditor Asignado';
      const creacionEvento: HistorialEvento = {
        arehi_codigo: -999999,
        arehi_fecha: fechaCreacion || (copia.length > 0 ? copia[0].arehi_fecha : new Date().toISOString()),
        arehi_accion: 'Creación de Recomendación',
        arehi_detalle: 'Creación de Recomendación e inicio de control.',
        arehi_auditor: auditor,
        arehi_usuario: 'Sistema'
      };
      copia.push(creacionEvento);
    }

    // 8.5 Sincronizar y generar eventos de VENCIMIENTO individuales por responsable con la fecha de vencimiento y los días transcurridos
    const todosRespNombresVenc = new Set<string>();
    if (this.responsiblesList && this.responsiblesList.length > 0) {
      this.responsiblesList.forEach(r => { if (r.nombre_completo) todosRespNombresVenc.add(r.nombre_completo.trim()); });
    }
    if (this.recomendacionData?.lista_responsables) {
      this.parseResponsables(this.recomendacionData.lista_responsables).forEach(r => { if (r.nombre) todosRespNombresVenc.add(r.nombre.trim()); });
    }

    todosRespNombresVenc.forEach(respNombre => {
      // Omitir generación de vencimiento si la persona está deshabilitada (ya no es responsable activo)
      if (this.esResponsableDeshabilitado(respNombre)) {
        return;
      }

      // Verificar si el responsable ya tiene su entregable justificado
      const estaJustificado = copia.some(e =>
        e.arehi_accion === 'VALIDACION_VERIFICABLE' &&
        e.arehi_responsable_nue &&
        this.compararNombresFlex(e.arehi_responsable_nue, respNombre) &&
        (e.estadoReal === 'JUSTIFICA' || (e.arehi_detalle && e.arehi_detalle.includes('JUSTIFICA') && !e.arehi_detalle.includes('NO JUSTIFICA')))
      );

      if (!estaJustificado) {
        // Buscar la última fecha máxima del responsable
        let fechaMaxStr: string | undefined;

        if (this.responsiblesList && this.responsiblesList.length > 0) {
          const rReal = this.responsiblesList.find(r => r.nombre_completo && this.compararNombresFlex(r.nombre_completo, respNombre));
          if (rReal && rReal.arers_fecha_max) {
            fechaMaxStr = rReal.arers_fecha_max;
          }
        }

        if (!fechaMaxStr && this.recomendacionData?.arere_fecha_maxima) {
          fechaMaxStr = this.recomendacionData.arere_fecha_maxima;
        }

        if (fechaMaxStr) {
          const fechaMaxObj = this.parsearFechaJS(fechaMaxStr);
          if (fechaMaxObj.getTime() > 0) {
            // Fijar vencimiento al final del día del plazo máximo
            const fechaLimite = new Date(fechaMaxObj.getTime());
            fechaLimite.setHours(23, 59, 59, 999);

            if (this.today.getTime() > fechaLimite.getTime()) {
              const diffTime = this.today.getTime() - fechaLimite.getTime();
              const diasVencidos = Math.floor(diffTime / (1000 * 60 * 60 * 24));

              const fechaVencFormateada = fechaMaxObj.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

              const eventoVenc = copia.find(e =>
                e.arehi_accion === 'VENCIMIENTO' &&
                e.arehi_responsable_nue &&
                this.compararNombresFlex(e.arehi_responsable_nue, respNombre)
              );

              if (eventoVenc) {
                eventoVenc.arehi_fecha = fechaLimite.toISOString();
                eventoVenc.arehi_detalle = `Vencimiento de plazo para el responsable ${respNombre}. La recomendación venció el ${fechaVencFormateada} y lleva ${diasVencidos} día(s) vencida.`;
                eventoVenc.arehi_fecha_max_nue = fechaMaxStr;
                eventoVenc.estadoReal = 'VENCIDA';
              } else {
                const nuevoVencimiento: HistorialEvento = {
                  arehi_codigo: -654321 - Math.floor(Math.random() * 100000),
                  arehi_fecha: fechaLimite.toISOString(),
                  arehi_accion: 'VENCIMIENTO',
                  arehi_detalle: `Vencimiento de plazo para el responsable ${respNombre}. La recomendación venció el ${fechaVencFormateada} y lleva ${diasVencidos} día(s) vencida.`,
                  arehi_responsable_nue: respNombre,
                  arehi_fecha_max_nue: fechaMaxStr,
                  arehi_auditor: auditorDefault,
                  arehi_usuario: 'Sistema',
                  estadoReal: 'VENCIDA'
                };
                copia.push(nuevoVencimiento);
              }
            }
          }
        }
      }
    });

    // Volvemos a ordenar cronológicamente priorizando la Creación de Recomendación y la Asignación/Reasignación de Responsable
    const esCreacion = (accion: string) =>
      accion === 'Creación de Recomendación' || accion === 'CREACION' || (accion && accion.toLowerCase().includes('creacion'));

    copia.sort((a, b) => {
      // 1. Creación de Recomendación es siempre el hito inicial absoluto
      if (esCreacion(a.arehi_accion) && !esCreacion(b.arehi_accion)) return -1;
      if (!esCreacion(a.arehi_accion) && esCreacion(b.arehi_accion)) return 1;

      // 2. Si ambos eventos corresponden al mismo responsable, la Asignación/Reasignación SIEMPRE antecede a las actividades de dicho responsable
      if (a.arehi_responsable_nue && b.arehi_responsable_nue &&
        this.compararNombresFlex(a.arehi_responsable_nue, b.arehi_responsable_nue)) {
        if (esEventoAsignacion(a.arehi_accion) && !esEventoAsignacion(b.arehi_accion)) return -1;
        if (!esEventoAsignacion(a.arehi_accion) && esEventoAsignacion(b.arehi_accion)) return 1;
      }

      const deA = this.parsearFechaJS(a.arehi_fecha).getTime();
      const deB = this.parsearFechaJS(b.arehi_fecha).getTime();
      if (deA !== deB) {
        return deA - deB;
      }

      // 3. Si las fechas son idénticas
      if (esEventoAsignacion(a.arehi_accion) && esEventoAsignacion(b.arehi_accion)) {
        if (!a.arehi_responsable_ant && b.arehi_responsable_ant) return -1;
        if (a.arehi_responsable_ant && !b.arehi_responsable_ant) return 1;
        if (b.arehi_responsable_ant && a.arehi_responsable_nue && this.compararNombresFlex(b.arehi_responsable_ant, a.arehi_responsable_nue)) return -1;
        if (a.arehi_responsable_ant && b.arehi_responsable_nue && this.compararNombresFlex(a.arehi_responsable_ant, b.arehi_responsable_nue)) return 1;
      }

      if (esEventoAsignacion(a.arehi_accion) && !esEventoAsignacion(b.arehi_accion)) return -1;
      if (!esEventoAsignacion(a.arehi_accion) && esEventoAsignacion(b.arehi_accion)) return 1;

      if (a.arehi_accion === 'ENVIO_VERIFICABLE' && b.arehi_accion === 'VALIDACION_VERIFICABLE') return -1;
      if (a.arehi_accion === 'VALIDACION_VERIFICABLE' && b.arehi_accion === 'ENVIO_VERIFICABLE') return 1;

      return a.arehi_codigo - b.arehi_codigo;
    });

    // 9. Extraer adjuntos de solicitudes de prórrogas
    copia.forEach(e => {
      if (e.arehi_accion === 'SOLICITUD_PRORROGA') {
        const adjuntoMatch = e.arehi_detalle.match(/\(Adjunto:\s*(.*?)\)/);
        if (adjuntoMatch && adjuntoMatch[1]) {
          e.adjuntoRuta = adjuntoMatch[1].trim();
          e.arehi_detalle = e.arehi_detalle.replace(adjuntoMatch[0], '').trim();
        }
      }
    });

    // 10. Agrupar aprobaciones de prórrogas
    const copiaAgrupada: HistorialEvento[] = [];
    const idsAprobacionesAgrupadas = new Set<number>();
    const solicitudes = copia.filter(e => e.arehi_accion === 'SOLICITUD_PRORROGA');

    // Mapeo de solicitud a sus aprobaciones
    const mapaAprobaciones = new Map<number, HistorialEvento[]>();
    solicitudes.forEach(sol => mapaAprobaciones.set(sol.arehi_codigo, []));

    copia.forEach((e) => {
      if (['PREAPROBACIÓN_PRORROGA', 'PREAPROBACION_PRORROGA', 'PRÓRROGA', 'PRORROGA', 'RECHAZO_PRORROGA'].includes(e.arehi_accion)) {
        const prevSolicitudes = copia.slice(0, copia.indexOf(e)).reverse().filter(sol => sol.arehi_accion === 'SOLICITUD_PRORROGA');

        let solCorrespondiente = prevSolicitudes.find(sol =>
          (sol.arehi_responsable_nue && e.arehi_responsable_nue && this.compararNombresFlex(sol.arehi_responsable_nue, e.arehi_responsable_nue)) ||
          (sol.arehi_responsable_nue && e.arehi_responsable_ant && this.compararNombresFlex(sol.arehi_responsable_nue, e.arehi_responsable_ant))
        );

        if (!solCorrespondiente && prevSolicitudes.length > 0) {
          solCorrespondiente = prevSolicitudes[0];
        }

        if (solCorrespondiente) {
          mapaAprobaciones.get(solCorrespondiente.arehi_codigo)!.push(e);
          idsAprobacionesAgrupadas.add(e.arehi_codigo);
        }
      }
    });

    // Construir lista final
    copia.forEach(e => {
      // Ocultar acciones de prórroga que ya fueron agrupadas dentro de su solicitud correspondiente
      if (idsAprobacionesAgrupadas.has(e.arehi_codigo)) {
        return;
      }

      // Ocultar modificaciones manuales de fecha del auditor y prórrogas que NO provengan de una solicitud formal realizada por el responsable
      const esAccionProrrogaSinSolicitud =
        e.arehi_accion === 'ACTUALIZACION_FECHA' ||
        ['PREAPROBACIÓN_PRORROGA', 'PREAPROBACION_PRORROGA', 'PRÓRROGA', 'PRORROGA', 'RECHAZO_PRORROGA'].includes(e.arehi_accion) ||
        (e.arehi_detalle && e.arehi_detalle.toLowerCase().includes('cambiada manualmente por la auditora'));

      if (esAccionProrrogaSinSolicitud) {
        return;
      }

      copiaAgrupada.push(e);

      if (e.arehi_accion === 'SOLICITUD_PRORROGA') {
        const aprobaciones = mapaAprobaciones.get(e.arehi_codigo) || [];
        const estadoActualBD = (e.estadoReal || 'PENDIENTE').toUpperCase().trim();
        const esResueltoPorBD = ['APROBADA', 'PREAPROBADA', 'RECHAZADA'].includes(estadoActualBD);

        if (aprobaciones.length > 0 || esResueltoPorBD) {
          const ultimoEvento = aprobaciones.length > 0 ? aprobaciones[aprobaciones.length - 1] : null;

          const evPreaprobacion = aprobaciones.find(ap => ap.arehi_accion.includes('PREAPROBACION') || ap.arehi_accion.includes('PREAPROBACIÓN'));
          const evFinal = aprobaciones.find(ap => ap.arehi_accion === 'PRORROGA' || ap.arehi_accion === 'PRÓRROGA' || ap.arehi_accion === 'RECHAZO_PRORROGA');

          const esRechazo = aprobaciones.some(ap => ap.arehi_accion === 'RECHAZO_PRORROGA') || estadoActualBD === 'RECHAZADA';
          const esPreaprobada = (!!evPreaprobacion && !evFinal) || (!esRechazo && (estadoActualBD === 'PREAPROBADA' || estadoActualBD === 'PREAPROBADO_DIRECTOR'));

          let estadoCalculado = 'APROBADA';
          if (esRechazo) {
            estadoCalculado = 'RECHAZADA';
          } else if (esPreaprobada) {
            estadoCalculado = 'PREAPROBADA';
          } else {
            estadoCalculado = 'APROBADA';
          }
          const detalleResp = 'Evaluación de solicitud de prórroga por fecha máxima de cumplimiento.';

          const directorNombre = evPreaprobacion?.arehi_auditor || '';
          const auditorNombre = evFinal?.arehi_auditor || (ultimoEvento && ultimoEvento.arehi_auditor !== directorNombre ? ultimoEvento.arehi_auditor : '') || e.arehi_auditor;

          const fechaAprob = ultimoEvento ? ultimoEvento.arehi_fecha : (e.arehi_fecha || new Date().toISOString());

          const eventoAprobacionAgrupado: HistorialEvento = {
            arehi_codigo: -888888 - Math.abs(e.arehi_codigo),
            arehi_fecha: fechaAprob,
            arehi_accion: 'APROBACION_PRORROGA',
            arehi_detalle: detalleResp,
            arehi_responsable_nue: e.arehi_responsable_nue,
            arehi_responsable_ant: e.arehi_responsable_ant,
            arehi_fecha_max_nue: (ultimoEvento && ultimoEvento.arehi_fecha_max_nue) || e.arehi_fecha_max_nue,
            arehi_fecha_max_ant: e.arehi_fecha_max_nue || e.arehi_fecha_max_ant,
            arehi_auditor: auditorNombre || directorNombre || 'Auditoría / Dirección',
            directorNombre: directorNombre,
            arehi_usuario: (ultimoEvento && ultimoEvento.arehi_usuario) || 'Sistema',
            arehi_observacion: aprobaciones.map(ap => ap.arehi_observacion).filter(Boolean).join(' | ') || undefined,
            estadoReal: estadoCalculado,
            isGrouped: true,
            subEventos: aprobaciones
          };

          e.estadoReal = estadoCalculado;
          copiaAgrupada.push(eventoAprobacionAgrupado);
        } else if (!e.estadoReal) {
          e.estadoReal = 'PENDIENTE';
        }
      }
    });

    return copiaAgrupada;
  }

  protected aplicarFiltros() {
    let filtrados = [...this.eventos];

    // Filtro por acción
    if (this.filtroAccion) {
      filtrados = filtrados.filter(e => {
        if (this.filtroAccion === 'CREACION') {
          return e.arehi_accion === 'CREACION' || e.arehi_accion === 'Creación de Recomendación' || (e.arehi_accion && e.arehi_accion.toLowerCase().includes('creacion'));
        }
        return e.arehi_accion === this.filtroAccion;
      });
    }

    // Filtro por texto libre (busca en detalle, responsable, auditor u observación)
    if (this.filtroTexto) {
      const search = this.filtroTexto.toLowerCase().trim();
      filtrados = filtrados.filter(e =>
        (e.arehi_detalle && e.arehi_detalle.toLowerCase().includes(search)) ||
        (e.arehi_responsable_ant && e.arehi_responsable_ant.toLowerCase().includes(search)) ||
        (e.arehi_responsable_nue && e.arehi_responsable_nue.toLowerCase().includes(search)) ||
        (e.arehi_auditor && e.arehi_auditor.toLowerCase().includes(search)) ||
        (e.arehi_observacion && e.arehi_observacion.toLowerCase().includes(search)) ||
        (e.arehi_usuario && e.arehi_usuario.toLowerCase().includes(search))
      );
    }

    // Filtro por fecha de inicio
    if (this.filtroFechaInicio) {
      const fechaInicio = this.parsearFechaJS(this.filtroFechaInicio);
      fechaInicio.setHours(0, 0, 0, 0);
      filtrados = filtrados.filter(e => {
        const fechaEvento = this.parsearFechaJS(e.arehi_fecha);
        return fechaEvento >= fechaInicio;
      });
    }

    // Filtro por fecha de fin
    if (this.filtroFechaFin) {
      const fechaFin = this.parsearFechaJS(this.filtroFechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      filtrados = filtrados.filter(e => {
        const fechaEvento = this.parsearFechaJS(e.arehi_fecha);
        return fechaEvento <= fechaFin;
      });
    }

    // Filtro por responsable (busca en campo responsable_nue y responsable_ant)
    if (this.filtroResponsable) {
      filtrados = filtrados.filter(e =>
        this.compararNombresFlex(e.arehi_responsable_nue, this.filtroResponsable) ||
        this.compararNombresFlex(e.arehi_responsable_ant, this.filtroResponsable) ||
        (e.arehi_detalle && e.arehi_detalle.toLowerCase().includes(this.filtroResponsable.toLowerCase().trim()))
      );
    }

    this.eventosFiltrados = filtrados;
    this.cacheVersion++;
  }

  protected limpiarFiltros() {
    this.filtroAccion = '';
    this.filtroTexto = '';
    this.filtroFechaInicio = '';
    this.filtroFechaFin = '';
    this.filtroResponsable = '';
    this.eventosFiltrados = [...this.eventos];
    this.cacheVersion++;
  }

  private parsearFechaJS(fechaInput: any): Date {
    if (!fechaInput) return new Date(0);
    if (fechaInput instanceof Date) return fechaInput;

    const str = String(fechaInput).trim();
    if (!str) return new Date(0);

    // Si contiene T o YYYY-MM-DD
    if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d;
    }

    // Si contiene DD/MM/YYYY
    const matches = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (matches) {
      const day = parseInt(matches[1], 10);
      const month = parseInt(matches[2], 10) - 1; // 0-indexed en JS
      const year = parseInt(matches[3], 10);
      const hours = matches[4] ? parseInt(matches[4], 10) : 0;
      const minutes = matches[5] ? parseInt(matches[5], 10) : 0;
      const seconds = matches[6] ? parseInt(matches[6], 10) : 0;
      return new Date(year, month, day, hours, minutes, seconds);
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  protected getResponsablesDisponibles(): string[] {
    if (this.cacheResponsablesVersion === this.cacheVersion && this.cacheResponsablesDisponibles) {
      return this.cacheResponsablesDisponibles;
    }
    const names = new Set<string>();

    const getCanonicalName = (nombre: string): string => {
      const trimmed = nombre.trim();
      // 1. Intentar buscar en la lista de responsables completa (responsiblesList)
      if (this.responsiblesList && this.responsiblesList.length > 0) {
        const matching = this.responsiblesList.find(r => {
          return r.nombre_completo && this.compararNombresFlex(r.nombre_completo, trimmed);
        });
        if (matching) {
          return matching.nombre_completo.trim();
        }
      }

      // 2. Intentar buscar en la lista de responsables de la recomendación (lista_responsables)
      if (this.recomendacionData && this.recomendacionData.lista_responsables) {
        const parsed = this.parseResponsables(this.recomendacionData.lista_responsables);
        const matching = parsed.find(r => this.compararNombresFlex(r.nombre, trimmed));
        if (matching) {
          return matching.nombre.trim();
        }
      }

      // 3. Si ya hay un nombre coincidente en names, devolvemos el que ya está en names
      const existing = Array.from(names).find(name => this.compararNombresFlex(name, trimmed));
      if (existing) {
        return existing;
      }

      return trimmed;
    };

    this.eventos.forEach(e => {
      if (e.arehi_responsable_nue) {
        names.add(getCanonicalName(e.arehi_responsable_nue));
      }
      if (e.arehi_responsable_ant) {
        names.add(getCanonicalName(e.arehi_responsable_ant));
      }
    });

    this.cacheResponsablesVersion = this.cacheVersion;
    this.cacheResponsablesDisponibles = Array.from(names).sort();
    return this.cacheResponsablesDisponibles;
  }

  private normalizarNombre(nombre?: string): string {
    if (!nombre) return '';
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^a-z]/g, ''); // Deja solo letras de la 'a' a la 'z' para ignorar espacios, Ñ, ?, etc.
  }

  private compararNombresFlex(nombreA?: string, nombreB?: string): boolean {
    if (!nombreA || !nombreB) return false;

    // Quita acentos, convierte a minúsculas y separa en palabras
    const normalizarPalabras = (n: string): string[] => {
      return n.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 2); // ignora palabras muy cortas (de, y, etc.)
    };

    const palabrasA = normalizarPalabras(nombreA);
    const palabrasB = normalizarPalabras(nombreB);

    if (palabrasA.length === 0 || palabrasB.length === 0) return false;

    // Todas las palabras significativas de A deben estar en B, y viceversa (con tolerancia del 75%)
    const coincidenciasA = palabrasA.filter(w => palabrasB.includes(w)).length;
    const coincidenciasB = palabrasB.filter(w => palabrasA.includes(w)).length;

    const pctA = coincidenciasA / palabrasA.length;
    const pctB = coincidenciasB / palabrasB.length;

    return pctA >= 0.75 && pctB >= 0.75;
  }

  protected parseResponsables(lista?: string): { nombre: string; estado: string }[] {
    if (!lista) return [];
    const cacheKey = lista + '__' + (this.realDeliverablesList?.length || 0);
    const cached = this.cacheParseResponsables.get(cacheKey);
    if (cached) return cached;

    const getPrioridadEstado = (estado: string): number => {
      const e = (estado || '').toUpperCase().trim();
      if (e === 'JUSTIFICA' || e === 'JUSTIFICADO' || e === 'CUMPLIDA' || e === 'APROBADA') return 3;
      if (e === 'PENDIENTE' || e === 'ENVIADO' || e === 'POR VALIDAR' || e === 'EN PROCESO' || e === 'ADICIONAL') return 2;
      if (e === 'NO JUSTIFICA' || e === 'RECHAZADO' || e === 'RECHAZADA') return 1;
      return 0; // VERIFICABLE NO CREADO / SIN ASIGNAR
    };

    const rawList = lista.split(',').map((part) => {
      const idx = part.indexOf('(');
      if (idx !== -1) {
        const estadoRaw = part.substring(idx + 1).trim();
        const estadoClean = estadoRaw.endsWith(')') ? estadoRaw.substring(0, estadoRaw.length - 1).trim() : estadoRaw;
        return {
          nombre: part.substring(0, idx).trim(),
          estado: estadoClean
        };
      }
      return {
        nombre: part.trim(),
        estado: 'VERIFICABLE NO CREADO'
      };
    });

    // Deduplicar por nombre de responsable aplicando jerarquía de reportes (V12):
    // 1° JUSTIFICA (3) > 2° PENDIENTE (2) > 3° NO JUSTIFICA (1) > 4° VERIFICABLE NO CREADO (0)
    const respMap = new Map<string, { nombre: string; estado: string }>();
    rawList.forEach(item => {
      const key = item.nombre.toLowerCase().trim();
      if (!respMap.has(key)) {
        respMap.set(key, { ...item });
      } else {
        const existente = respMap.get(key)!;
        const prioExistente = getPrioridadEstado(existente.estado);
        const prioItem = getPrioridadEstado(item.estado);
        if (prioItem > prioExistente) {
          respMap.set(key, { ...item });
        }
      }
    });

    // Validar contra realDeliverablesList si ya fue cargada para garantizar máxima coherencia
    if (this.realDeliverablesList && this.realDeliverablesList.length > 0) {
      respMap.forEach((item) => {
        let maxPrioReal = -1;
        let estadoRealGanador = '';
        this.realDeliverablesList.forEach((v: any) => {
          let vResp = '';
          if (v.responsable?.nombre_completo) vResp = v.responsable.nombre_completo;
          else if (v.responsable_nombre) vResp = v.responsable_nombre;
          else if (v.arers_nombre) vResp = v.arers_nombre;
          else if (v.nombre_completo) vResp = v.nombre_completo;
          else if (this.responsiblesList && this.responsiblesList.length > 0) {
            if (v.arers_codigo_per) {
              const m = this.responsiblesList.find(r => r.arers_codigo_per === v.arers_codigo_per);
              if (m) vResp = m.nombre_completo;
            }
            if (!vResp && v.arers_codigo) {
              const m = this.responsiblesList.find(r => r.arers_codigo === v.arers_codigo);
              if (m) vResp = m.nombre_completo;
            }
          }

          if (vResp && this.compararNombresFlex(vResp, item.nombre)) {
            const desc = v.estado_seguimiento?.areev_descripcion || (v.areev_codigo === 2 ? 'JUSTIFICA' : (v.areev_codigo === 1 ? 'PENDIENTE' : 'NO JUSTIFICA'));
            const prio = getPrioridadEstado(desc);
            if (prio > maxPrioReal) {
              maxPrioReal = prio;
              estadoRealGanador = desc.toUpperCase().trim();
            }
          }
        });

        if (maxPrioReal >= 0) {
          const prioActual = getPrioridadEstado(item.estado);
          if (maxPrioReal > prioActual || (maxPrioReal === 3 && prioActual !== 3)) {
            item.estado = estadoRealGanador || 'JUSTIFICA';
          }
        }
      });
    }

    const result = Array.from(respMap.values());
    this.cacheParseResponsables.set(cacheKey, result);
    return result;
  }

  protected getResponsableBadgeClass(estado: string): string {
    const normalized = estado.toUpperCase().trim();
    if (normalized === 'JUSTIFICA') {
      return 'bg-emerald-50 border-emerald-300 text-emerald-700';
    } else if (normalized === 'NO JUSTIFICA' || normalized === 'RECHAZADO') {
      return 'bg-rose-50 border-rose-300 text-rose-700';
    } else if (normalized === 'PENDIENTE' || normalized === 'ENVIADO' || normalized === 'POR VALIDAR') {
      return 'bg-amber-50 border-amber-300 text-amber-700';
    } else {
      return 'bg-slate-50 border-slate-300 text-slate-500';
    }
  }

  protected getBadgeClass(accion: string): string {
    switch (accion) {
      case 'CREACION':
        return 'badge-info bg-blue-100 text-blue-800 border-blue-200';
      case 'ASIGNACION_RESPONSABLE':
        return 'badge-secondary bg-teal-100 text-teal-800 border-teal-200';
      case 'ENVIO_VERIFICABLE':
        return 'badge-accent bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'VALIDACION_VERIFICABLE':
        return 'badge-success bg-green-100 text-green-800 border-green-200';
      case 'SOLICITUD_PRORROGA':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'APROBACION_PRORROGA':
        return 'badge-warning bg-amber-100 text-amber-800 border-amber-200';
      case 'PRORROGA':
        return 'badge-warning bg-amber-100 text-amber-800 border-amber-200';
      case 'PREAPROBACION_PRORROGA':
        return 'badge-warning bg-orange-100 text-orange-800 border-orange-200';
      case 'RECHAZO_PRORROGA':
        return 'badge-error bg-rose-100 text-rose-800 border-rose-200';
      case 'ELIMINACION_VERIFICABLE':
        return 'badge-error bg-rose-100 text-rose-800 border-rose-200';
      case 'CAMBIO_ESTADO':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'VENCIMIENTO':
        return 'badge-error bg-red-100 text-red-800 border-red-200';
      case 'ACTUALIZACION_FECHA':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      default:
        return 'badge-ghost bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  protected getIconClass(accion: string): string {
    switch (accion) {
      case 'CREACION':
        return 'bg-blue-500 text-white';
      case 'ASIGNACION_RESPONSABLE':
        return 'bg-teal-500 text-white';
      case 'ENVIO_VERIFICABLE':
        return 'bg-indigo-500 text-white';
      case 'VALIDACION_VERIFICABLE':
        return 'bg-green-500 text-white';
      case 'SOLICITUD_PRORROGA':
        return 'bg-orange-400 text-white';
      case 'APROBACION_PRORROGA':
        return 'bg-amber-500 text-white';
      case 'PRORROGA':
        return 'bg-amber-500 text-white';
      case 'PREAPROBACION_PRORROGA':
        return 'bg-orange-500 text-white';
      case 'RECHAZO_PRORROGA':
        return 'bg-rose-500 text-white';
      case 'ELIMINACION_VERIFICABLE':
        return 'bg-rose-600 text-white';
      case 'CAMBIO_ESTADO':
        return 'bg-sky-500 text-white';
      case 'VENCIMIENTO':
        return 'bg-red-500 text-white';
      case 'ACTUALIZACION_FECHA':
        return 'bg-sky-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  protected esResponsableDeshabilitado(nombre: string): boolean {
    if (!this.recomendacionData || !nombre) return false;
    const activos = this.parseResponsables(this.recomendacionData.lista_responsables)
      .map(r => r.nombre);
    return !activos.some(act => this.compararNombresFlex(act, nombre));
  }

  protected esReasignacion(evento: HistorialEvento, listaEventos: HistorialEvento[] = this.eventos): boolean {
    if (!evento.arehi_accion || (evento.arehi_accion !== 'ASIGNACION_RESPONSABLE' && !evento.arehi_accion.toLowerCase().includes('reasig'))) {
      return false;
    }

    if (this.responsiblesList && this.responsiblesList.length > 0) {
      if (evento.arehi_responsable_nue) {
        const prevResp = this.responsiblesList.find(r =>
          r.arers_estado === '0' &&
          r.arers_reemp_por &&
          this.compararNombresFlex(r.arers_reemp_por, evento.arehi_responsable_nue!)
        );
        return !!prevResp;
      }
      return false;
    }

    if (!evento.arehi_responsable_ant) {
      return false;
    }

    // Si el detalle contiene explícitamente "reasig", es reasignación segura
    const detalle = (evento.arehi_detalle || '').toLowerCase();
    if (detalle.includes('reasig') || detalle.includes('reasignó') || detalle.includes('reasigno')) {
      return true;
    }

    // Para datos migrados (que usan "Se asigno como responsable a..."):
    // Si el responsable anterior sigue estando activo (no deshabilitado),
    // entonces no fue reemplazado por este evento (ambos están activos).
    // Por lo tanto, no es una reasignación real, sino una asignación simultánea/adicional.
    if (!this.esResponsableDeshabilitado(evento.arehi_responsable_ant)) {
      return false;
    }

    // Evaluamos si hay otras asignaciones de responsables dentro de un margen de 5 minutos.
    // Si existen, se asume que es una asignación por lotes iniciales y no una reasignación.
    const fechaActual = this.parsearFechaJS(evento.arehi_fecha).getTime();
    const otrasAsignacionesSimultaneas = listaEventos.filter(e => {
      if (e.arehi_accion !== 'ASIGNACION_RESPONSABLE' || e.arehi_codigo === evento.arehi_codigo) {
        return false;
      }
      const fechaOtro = this.parsearFechaJS(e.arehi_fecha).getTime();
      const diferenciaMinutos = Math.abs(fechaActual - fechaOtro) / (1000 * 60);
      return diferenciaMinutos <= 5;
    });

    if (otrasAsignacionesSimultaneas.length > 0) {
      return false;
    }

    return true;
  }

  protected mostrarAlertaSinActividad(responsable: string): boolean {
    if (!responsable) return false;

    const eventosResp = this.eventos.filter(e =>
      this.compararNombresFlex(e.arehi_responsable_nue, responsable) ||
      this.compararNombresFlex(e.arehi_responsable_ant, responsable)
    );

    const tieneEnvio = eventosResp.some(e => e.arehi_accion === 'ENVIO_VERIFICABLE');
    const tieneProrroga = eventosResp.some(e =>
      e.arehi_accion === 'PRORROGA' ||
      e.arehi_accion === 'SOLICITUD_PRORROGA' ||
      e.arehi_accion === 'APROBACION_PRORROGA' ||
      e.arehi_accion === 'PREAPROBACION_PRORROGA' ||
      (e.arehi_accion && e.arehi_accion.toLowerCase().includes('prorrog'))
    );

    return !tieneEnvio && !tieneProrroga;
  }

  protected mostrarAlertaSoloProrroga(responsable: string): boolean {
    if (!responsable) return false;

    const eventosResp = this.eventos.filter(e =>
      this.compararNombresFlex(e.arehi_responsable_nue, responsable) ||
      this.compararNombresFlex(e.arehi_responsable_ant, responsable)
    );

    const tieneEnvio = eventosResp.some(e => e.arehi_accion === 'ENVIO_VERIFICABLE');
    const tieneProrroga = eventosResp.some(e =>
      e.arehi_accion === 'PRORROGA' ||
      e.arehi_accion === 'SOLICITUD_PRORROGA' ||
      e.arehi_accion === 'APROBACION_PRORROGA' ||
      e.arehi_accion === 'PREAPROBACION_PRORROGA' ||
      (e.arehi_accion && e.arehi_accion.toLowerCase().includes('prorrog'))
    );

    return !tieneEnvio && tieneProrroga;
  }

  protected getEventoBadgeClass(evento: HistorialEvento): string {
    if (this.esReasignacion(evento)) {
      return 'badge-secondary bg-purple-100 text-purple-800 border-purple-200';
    }
    return this.getBadgeClass(evento.arehi_accion);
  }

  protected getEventoActionLabel(evento: HistorialEvento): string {
    if (evento.arehi_accion === 'ASIGNACION_RESPONSABLE') {
      return this.esReasignacion(evento) ? 'Reasignación de Responsable' : 'Asignación de Responsable';
    }
    return this.getActionLabel(evento.arehi_accion);
  }

  protected getActionLabel(accion: string): string {
    if (accion === 'ELIMINACION_VERIFICABLE' || (accion && (accion.toLowerCase().includes('elimin') || accion.toLowerCase().includes('elimino')))) {
      return 'Eliminación de Verificable';
    }
    const found = this.accionesDisponibles.find(a => a.value === accion);
    return found ? found.label : accion;
  }

  protected getCardBorderClass(evento: HistorialEvento): string {
    switch (evento.arehi_accion) {
      case 'CREACION': return 'border-l-blue-500';
      case 'ASIGNACION_RESPONSABLE': return this.esReasignacion(evento) ? 'border-l-purple-500' : 'border-l-teal-500';
      case 'ENVIO_VERIFICABLE': return 'border-l-indigo-500';
      case 'VALIDACION_VERIFICABLE':
        return (evento.arehi_detalle.includes('JUSTIFICA') && !evento.arehi_detalle.includes('NO JUSTIFICA'))
          ? 'border-l-green-500' : 'border-l-red-500';
      case 'SOLICITUD_PRORROGA': return 'border-l-orange-400';
      case 'APROBACION_PRORROGA':
        return (evento.arehi_detalle.includes('RECHAZADA'))
          ? 'border-l-rose-500' : 'border-l-green-500';
      case 'PRORROGA': return 'border-l-amber-500';
      case 'PREAPROBACION_PRORROGA': return 'border-l-orange-500';
      case 'RECHAZO_PRORROGA': return 'border-l-rose-500';
      case 'CAMBIO_ESTADO': return 'border-l-sky-500';
      case 'VENCIMIENTO': return 'border-l-red-600';
      case 'ACTUALIZACION_FECHA': return 'border-l-sky-500';
      default: return 'border-l-gray-400';
    }
  }

  // ── Vista Agrupada por Responsable ──────────────────────────────────────────
  protected getEventosAgrupadosPorResponsable(): { key: string; eventos: HistorialEvento[] }[] {
    if (this.cacheAgrupadosVersion === this.cacheVersion && this.cacheAgrupados) {
      return this.cacheAgrupados;
    }
    const mapa = new Map<string, HistorialEvento[]>();
    const sinResponsable = 'Recomendacion General';

    for (const e of this.eventosFiltrados) {
      const respNombre = e.arehi_responsable_nue?.trim();
      if (!respNombre) {
        if (!mapa.has(sinResponsable)) mapa.set(sinResponsable, []);
        mapa.get(sinResponsable)!.push(e);
        continue;
      }

      let targetKey = respNombre;
      for (const existingKey of mapa.keys()) {
        if (existingKey !== sinResponsable && this.compararNombresFlex(existingKey, respNombre)) {
          targetKey = existingKey;
          break;
        }
      }

      if (!mapa.has(targetKey)) mapa.set(targetKey, []);
      mapa.get(targetKey)!.push(e);
    }

    const grupos: { key: string; eventos: HistorialEvento[] }[] = [];
    if (mapa.has(sinResponsable)) {
      grupos.push({ key: sinResponsable, eventos: mapa.get(sinResponsable)! });
      mapa.delete(sinResponsable);
    }
    mapa.forEach((eventos, key) => grupos.push({ key, eventos }));
    this.cacheAgrupadosVersion = this.cacheVersion;
    this.cacheAgrupados = grupos;
    return grupos;
  }

  protected getGroupColor(index: number): string {
    const colors = [
      'border-teal-400 bg-teal-50',
      'border-indigo-400 bg-indigo-50',
      'border-violet-400 bg-violet-50',
      'border-amber-400 bg-amber-50',
      'border-pink-400 bg-pink-50',
      'border-cyan-400 bg-cyan-50',
    ];
    return colors[index % colors.length];
  }

  protected getGroupTextColor(index: number): string {
    const colors = [
      'text-teal-700', 'text-indigo-700', 'text-violet-700',
      'text-amber-700', 'text-pink-700', 'text-cyan-700'
    ];
    return colors[index % colors.length];
  }

  protected exportarExcel() {
    try {
      // 1. Filas de metadatos (Encabezado estilo Auditor Interno Jefe)
      const metadata = [
        ['EMPRESA ELÉCTRICA AMBATO REGIONAL CENTRO NORTE S.A.'],
        ['SISREC - SISTEMA DE SEGUIMIENTO DE RECOMENDACIONES'],
        ['REPORTE GENERAL DE TRAZABILIDAD E HISTORIAL (AUDITORÍA INTERNA)'],
        [],
        ['Recomendación N°:', this.recomendacionData?.numRec || 'N/A'],
        ['Memorando de Informe:', this.recomendacionData?.memorando || 'N/A'],
        ['Auditor Encargado:', this.getAuditorName()],
        ['Título del Informe:', this.recomendacionData?.tituloInforme || 'N/A'],
        ['Fecha Generación:', new Date().toLocaleString('es-EC')],
        [],
        ['Descripción de la Recomendación:'],
        [this.recomendacionData?.descripcion || ''],
        ['Riesgo verificado:', this.recomendacionData?.riesgoVerificado || 'Sin registrar'],
        ['Evidencias requeridas:', this.evidenciasRequeridas.map((texto, index) => `${index + 1}. ${texto}`).join('\n') || 'Sin registrar'],
        [],
        ['Detalle del Historial de Actividades:'],
        ['N°', 'Fecha y Hora', 'Acción / Evento', 'Detalle de Actividad', 'Responsable Anterior', 'Responsable Nuevo', 'Fecha Máx. Anterior', 'Fecha Máx. Nueva', 'Auditor Responsable', 'Observaciones / Comentarios del Auditor', 'Registrado por (Usuario)', 'Riesgo verificado', 'Evidencias requeridas']
      ];

      // 2. Filas de datos
      const rows = this.eventosFiltrados.map((evento, index) => [
        index + 1,
        this.parsearFechaJS(evento.arehi_fecha).toLocaleString('es-EC'),
        this.getActionLabel(evento.arehi_accion),
        evento.arehi_detalle,
        evento.arehi_responsable_ant || 'N/A',
        evento.arehi_responsable_nue || 'N/A',
        evento.arehi_fecha_max_ant ? this.parsearFechaJS(evento.arehi_fecha_max_ant).toLocaleDateString('es-EC') : 'N/A',
        evento.arehi_fecha_max_nue ? this.parsearFechaJS(evento.arehi_fecha_max_nue).toLocaleDateString('es-EC') : 'N/A',
        evento.arehi_auditor || 'N/A',
        evento.arehi_observacion || 'Ninguna',
        evento.arehi_usuario,
        this.recomendacionData?.riesgoVerificado || 'Sin registrar',
        this.evidenciasRequeridas.map((texto, index) => `${index + 1}. ${texto}`).join('\n') || 'Sin registrar'
      ]);

      // Unificar datos
      const finalData = [...metadata, ...rows];

      // Crear hoja y libro
      const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(finalData);

      // Configurar anchos de columnas
      ws['!cols'] = [
        { wch: 6 },   // N°
        { wch: 20 },  // Fecha
        { wch: 25 },  // Acción
        { wch: 65 },  // Detalle
        { wch: 30 },  // Resp Ant
        { wch: 30 },  // Resp Nue
        { wch: 15 },  // Fecha Ant
        { wch: 15 },  // Fecha Nue
        { wch: 30 },  // Auditor
        { wch: 50 },  // Observación
        { wch: 15 },  // Usuario
        { wch: 18 },  // Riesgo verificado
        { wch: 60 }   // Evidencias requeridas
      ];

      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Historial Auditoría');

      // Nombre del archivo
      const fileName = `Reporte_Auditoria_Rec_${this.recomendacionData?.numRec}_${this.recomendacionData?.memorando.replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      this.alertSrv.showAlert('Reporte de Excel exportado exitosamente.', 'success');
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      this.alertSrv.showAlert('Ocurrió un error al exportar el reporte a Excel.', 'error');
    }
  }
}
