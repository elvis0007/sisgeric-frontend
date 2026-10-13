import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReporteRecomendacionesFechaCorte } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { PeriodoEvaluacionService } from '@features/ai-seguim-auditor-general/services/periodo-evaluacion.service';
import { RecomendacionesVerificablesService } from '@features/ai-rec-verificables/services/recomendaciones/recomendaciones-verificables.service';
import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';
import { FileService } from '@shared/services/file.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import * as XLSX from 'xlsx';

export interface ResponsableReporteItem {
  nombre: string;
  departamento: string;
  estadoVerificable: string;
  verificableCodigo?: number;
  descripcionVerificable?: string;
  observaciones?: string;
  descripcionVerificableAll?: string;
  observacionesAll?: string;
  fechaIndividual?: string;
  plazoIndividual?: string;
  estadoIndividual?: string;
}

export interface RecomendacionReporteItem {
  idRec?: string | number;
  codigo: string;
  descripcion: string;
  riesgoVerificado?: string | null;
  evidenciaRequerida?: string | null;
  evidenciasRequeridas: string[];
  riesgoOculto?: boolean;
  evidenciasOcultas?: boolean;
  conclusion?: string;
  estadoRecomendacion: string;
  fechaMaximaCumplimiento: string;
  progresoPercent: number;
  responsables: ResponsableReporteItem[];
}

export interface InformeReporteItem {
  idInforme?: string | number;
  tituloInforme: string;
  organismoControl: string;
  memoAuditoria: string;
  memoAprobacion: string;
  auditorAsignado: string;
  fechaEmision: string;
  anioEmision: number;
  fechaAprobacionPresidencia: string;
  progresoGlobal: number;
  esArrastreHistorico: boolean;
  recomendaciones: RecomendacionReporteItem[];
  expanded?: boolean;
}

export interface VerificableVisorData {
  responsableNombre: string;
  departamento: string;
  estadoVerificable: string;
  observaciones: string;
  codigoRec: string;
  idRec: number;
  idInforme?: number | string;
  memoAuditoria: string;
  tituloInforme: string;
  verificableObj?: any;
  fileRuta?: string;
  fileBase64?: string;
  fileType?: 'pdf' | 'image' | 'other';
  isLoadingFile?: boolean;
  fileError?: string | null;
}

import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';

@Component({
  selector: 'app-table-report-fecha-corte',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusColorPipe, ReportLoadingComponent],
  templateUrl: './table-report-fecha-corte.component.html',
  styleUrl: './table-report-fecha-corte.component.css'
})
export class TableReportFechaCorteComponent implements OnInit {

  protected filterForm: FormGroup;
  protected dateEmisionControl: FormControl;
  protected dateEstadoControl: FormControl;
  protected timeEstadoControl: FormControl;
  protected dateControl: FormControl;

  // Raw data from backend
  protected rawReports: ReporteRecomendacionesFechaCorte[] = [];

  // Structured hierarchical data
  protected allInformes: InformeReporteItem[] = [];
  protected filteredInformes: InformeReporteItem[] = [];

  // Dropdown options
  protected organismosControl: OrganismoControl[] = [];
  protected departamentosDisponibles: string[] = [];
  protected aniosDisponibles: number[] = [];
  protected aniosSeleccionados: number[] = [];
  protected organismosSeleccionados: number[] = [];
  protected periodosEvaluacion: any[] = [];
  protected informesIDsDelPeriodoSeleccionado: Set<number> | null = null;
  protected recomendacionesIncluidasDelPeriodoSeleccionado: Set<string> | null = null;
  protected responsablesIncluidosDelPeriodoSeleccionado: Set<string> | null = null;
  protected responsablesPorRecMap: Map<string, string[]> | null = null;

  // KPI Indicators
  protected totalInformesPendientes = 0;
  protected totalInformesCumplidos = 0;
  protected totalRecomendacionesPendientes = 0;
  protected totalRecomendacionesCumplidas = 0;
  protected totalArrastreHistorico = 0;
  protected totalAsignaciones = 0;

  // States
  protected isLoading = false;
  protected isVerificableModalOpen = false;
  protected currentVerificableData: VerificableVisorData | null = null;
  protected safePdfUrl: SafeResourceUrl | null = null;

  private readonly filterStateService = inject(FilterStateService);
  private readonly periodoSrv = inject(PeriodoEvaluacionService);
  private readonly recomVerificablesSrv = inject(RecomendacionesVerificablesService);
  private readonly verificablesRespSrv = inject(VerificablesResponsablesService);
  private readonly fileSrv = inject(FileService);
  private readonly sanitizer = inject(DomSanitizer);

  constructor(
    private fb: FormBuilder,
    private reportsService: ReportsAuditorGenService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const formattedToday = this.formatDateForInput(today);

    this.dateEmisionControl = new FormControl(formattedToday);
    this.dateEstadoControl = new FormControl(formattedToday);
    this.timeEstadoControl = new FormControl('');
    this.dateControl = this.dateEstadoControl;

    this.filterForm = this.fb.group({
      dateEmision: this.dateEmisionControl,
      dateEstado: this.dateEstadoControl,
      timeEstado: this.timeEstadoControl,
      date: this.dateEstadoControl,
      periodoId: ['0'],
      orgCtrl: ['0'],
      departamento: ['0'],
      soloVerificablesPendientes: [false],
      incluirCompletados: [true],
      searchTerm: ['']
    });
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_fecha_corte');
    if (savedFilters) {
      if (savedFilters.aniosSeleccionados) {
        this.aniosSeleccionados = savedFilters.aniosSeleccionados;
      }
      if (savedFilters.periodosSeleccionados) {
        this.periodosSeleccionados = savedFilters.periodosSeleccionados;
      }
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.loadInitialData();
    this.configureFormChanges();
  }

  private loadInitialData(): void {
    this.loadOrganismosControl();
    this.loadDepartamentos();
    this.loadPeriodosEvaluacion();
    if (this.periodosSeleccionados.length > 0) {
      this.cargarInformesDePeriodosSeleccionados();
    }
    this.fetchBackendReport();
  }

  private loadPeriodosEvaluacion(): void {
    this.periodoSrv.getPeriodos().subscribe({
      next: (res) => {
        this.periodosEvaluacion = res.datos || this.getPeriodosDefaultList();
      },
      error: () => {
        this.periodosEvaluacion = this.getPeriodosDefaultList();
      }
    });
  }

  private getPeriodosDefaultList(): any[] {
    const anio = new Date().getFullYear();
    return [
      { arcev_codigo: 1, arcev_nombre: `I Trimestre ${anio}`, arcev_fecha_corte: `${anio}-03-31` },
      { arcev_codigo: 2, arcev_nombre: `II Trimestre ${anio}`, arcev_fecha_corte: `${anio}-06-30` },
      { arcev_codigo: 3, arcev_nombre: `III Trimestre ${anio}`, arcev_fecha_corte: `${anio}-09-30` },
      { arcev_codigo: 4, arcev_nombre: `IV Trimestre ${anio}`, arcev_fecha_corte: `${anio}-12-31` },
      { arcev_codigo: 5, arcev_nombre: `Cierre de Año ${anio}`, arcev_fecha_corte: `${anio}-12-31` },
    ];
  }

  protected periodosSeleccionados: number[] = [];
  protected mostrarTodosPeriodos = false;

  getVisiblePeriodos(): any[] {
    if (this.mostrarTodosPeriodos) return this.periodosEvaluacion;
    const currentYear = new Date().getFullYear();
    const anioActual = this.periodosEvaluacion.filter(p =>
      p.arcev_anio === currentYear ||
      (p.arcev_nombre && p.arcev_nombre.toString().includes(currentYear.toString()))
    );
    return anioActual.length > 0 ? anioActual : this.periodosEvaluacion;
  }

  getPeriodosSeleccionadosLabel(): string {
    if (this.periodosSeleccionados.length === 0) {
      return '-- Todos los Periodos --';
    }
    if (this.periodosSeleccionados.length === 1) {
      const p = this.periodosEvaluacion.find(item => item.arcev_codigo === this.periodosSeleccionados[0]);
      return p ? p.arcev_nombre : '1 periodo';
    }
    return `${this.periodosSeleccionados.length} periodos seleccionados`;
  }

  toggleAllPeriodos(): void {
    this.periodosSeleccionados = [];
    this.informesIDsDelPeriodoSeleccionado = null;
    this.recomendacionesIncluidasDelPeriodoSeleccionado = null;
    this.responsablesIncluidosDelPeriodoSeleccionado = null;
    this.responsablesPorRecMap = null;
    this.applyLocalFilters();
  }

  togglePeriodo(arcevCodigo: number): void {
    const idx = this.periodosSeleccionados.indexOf(arcevCodigo);
    if (idx >= 0) {
      this.periodosSeleccionados.splice(idx, 1);
    } else {
      this.periodosSeleccionados.push(arcevCodigo);
    }
    this.cargarInformesDePeriodosSeleccionados();
  }

  private cargarInformesDePeriodosSeleccionados(): void {
    if (this.periodosSeleccionados.length === 0) {
      this.informesIDsDelPeriodoSeleccionado = null;
      this.recomendacionesIncluidasDelPeriodoSeleccionado = null;
      this.responsablesIncluidosDelPeriodoSeleccionado = null;
      this.responsablesPorRecMap = null;
      this.applyLocalFilters();
      return;
    }

    this.isLoading = true;
    const promisesInf = this.periodosSeleccionados.map(id =>
      firstValueFrom(this.periodoSrv.getInformesPorPeriodo(id))
    );
    const promisesRec = this.periodosSeleccionados.map(id =>
      firstValueFrom(this.periodoSrv.getRecomendacionesPorPeriodo(id))
    );
    const promisesResp = this.periodosSeleccionados.map(id =>
      firstValueFrom(this.periodoSrv.getResponsablesPorPeriodo(id))
    );

    Promise.all([Promise.all(promisesInf), Promise.all(promisesRec), Promise.all(promisesResp)])
      .then(([responsesInf, responsesRec, responsesResp]) => {
        // 1. INFORMES PERTENECIENTES A LOS PERIODOS SELECCIONADOS
        const setOfInformeIds = new Set<number>();
        responsesInf.forEach(res => {
          (res.datos || []).forEach((i: any) => {
            const infId = i.ainin_codigo ?? i.aininCodigo;
            if (infId !== undefined && infId !== null) {
              setOfInformeIds.add(Number(infId));
            }
          });
        });

        // 2. RECOMENDACIONES INCLUIDAS EN LOS PERIODOS SELECCIONADOS
        const setOfIncludedRecs = new Set<string>();
        responsesRec.forEach(res => {
          (res.datos || []).forEach((r: any) => {
            const isInc = r.incluido === 1 || r.incluido === '1' || r.incluido === true || r.incluido == null;
            if (isInc) {
              const recId = r.arere_codigo ?? r.arereCodigo;
              if (recId !== undefined && recId !== null) {
                setOfIncludedRecs.add(`ID_${recId}`);
              }
              const infId = r.ainin_codigo ?? r.aininCodigo;
              const numRec = r.numero_recomendacion ?? r.numeroRecomendacion;
              if (infId !== undefined && numRec !== undefined && numRec !== null) {
                setOfIncludedRecs.add(`${infId}_${numRec}`);
                const parsedNum = parseInt(String(numRec), 10);
                if (!isNaN(parsedNum)) {
                  setOfIncludedRecs.add(`${infId}_${parsedNum}`);
                }
              }
            }
          });
        });

        // 3. RESPONSABLES INCLUIDOS EN LOS PERIODOS SELECCIONADOS
        const setOfIncludedResps = new Set<string>();
        const mapRespPorRec = new Map<string, string[]>();

        responsesResp.forEach(res => {
          (res.datos || []).forEach((resp: any) => {
            const isInc = resp.incluido === 1 || resp.incluido === '1' || resp.incluido === true || resp.incluido == null;
            const rawName = resp.nombre_completo || resp.nombreCompleto;
            if (isInc && rawName) {
              const nameClean = this.normalizeText(String(rawName));
              const recId = resp.arere_codigo ?? resp.arereCodigo;
              const infId = resp.ainin_codigo ?? resp.aininCodigo;
              const numRec = resp.numero_recomendacion ?? resp.numeroRecomendacion;

              if (recId !== undefined && recId !== null) {
                const recKey = String(recId).trim();
                setOfIncludedResps.add(`${recKey}_${nameClean}`);
                if (!mapRespPorRec.has(recKey)) {
                  mapRespPorRec.set(recKey, []);
                }
                mapRespPorRec.get(recKey)!.push(nameClean);
              }

              if (infId !== undefined && numRec !== undefined && numRec !== null) {
                const infNumKey = `${infId}_${numRec}`;
                setOfIncludedResps.add(`${infNumKey}_${nameClean}`);
                if (!mapRespPorRec.has(infNumKey)) {
                  mapRespPorRec.set(infNumKey, []);
                }
                mapRespPorRec.get(infNumKey)!.push(nameClean);

                const parsedNum = parseInt(String(numRec), 10);
                if (!isNaN(parsedNum)) {
                  const infNumIntKey = `${infId}_${parsedNum}`;
                  setOfIncludedResps.add(`${infNumIntKey}_${nameClean}`);
                  if (!mapRespPorRec.has(infNumIntKey)) {
                    mapRespPorRec.set(infNumIntKey, []);
                  }
                  mapRespPorRec.get(infNumIntKey)!.push(nameClean);
                }
              }
            }
          });
        });

        this.informesIDsDelPeriodoSeleccionado = setOfInformeIds;
        this.recomendacionesIncluidasDelPeriodoSeleccionado = setOfIncludedRecs;
        this.responsablesIncluidosDelPeriodoSeleccionado = setOfIncludedResps;
        this.responsablesPorRecMap = mapRespPorRec;
        this.applyLocalFilters();
        this.isLoading = false;
      })
      .catch(err => {
        console.error('Error al cargar informes, recomendaciones y responsables de los periodos seleccionados:', err);
        this.isLoading = false;
      });
  }



  private loadDepartamentos(): void {
    this.reportsService.getDepartamentos().subscribe({
      next: (response) => {
        this.departamentosDisponibles = (response?.datos || []).sort();
      },
      error: () => {
        this.alertsService.showAlert('Error al cargar departamentos', 'error');
      }
    });
  }

  private loadOrganismosControl(): void {
    this.reportsService.getOrganismos().subscribe({
      next: (response) => {
        this.organismosControl = response?.datos || [];
      },
      error: (error) => {
        console.error('Error al cargar organismos de control:', error);
      }
    });
  }

  private configureFormChanges(): void {
    this.filterForm.valueChanges.subscribe((val) => {
      const stateToSave = {
        ...val,
        aniosSeleccionados: this.aniosSeleccionados,
        periodosSeleccionados: this.periodosSeleccionados
      };
      this.filterStateService.setFilters('rep_fecha_corte', stateToSave);

      // Si la fecha de emisión, fecha de estado, hora o selectores backend cambiaron, recargamos
      if (
        this.filterForm.get('dateEmision')?.dirty ||
        this.filterForm.get('dateEstado')?.dirty ||
        this.filterForm.get('timeEstado')?.dirty ||
        this.filterForm.get('date')?.dirty ||
        this.filterForm.get('orgCtrl')?.dirty ||
        this.filterForm.get('departamento')?.dirty
      ) {
        this.fetchBackendReport();
        this.filterForm.get('dateEmision')?.markAsPristine();
        this.filterForm.get('dateEstado')?.markAsPristine();
        this.filterForm.get('timeEstado')?.markAsPristine();
        this.filterForm.get('date')?.markAsPristine();
        this.filterForm.get('orgCtrl')?.markAsPristine();
        this.filterForm.get('departamento')?.markAsPristine();
      } else {
        this.applyLocalFilters();
      }
    });
  }

  protected fetchBackendReport(): void {
    if (!this.dateEmisionControl.value || !this.dateEstadoControl.value) return;

    this.isLoading = true;
    const dateEmisionFormatted = this.formatDateForService(this.dateEmisionControl.value);
    let dateEstadoFormatted = this.formatDateForService(this.dateEstadoControl.value);
    
    // Si la persona escogió una hora en el filtro opcional de hora (ej: "14:30"), la adjuntamos
    const timeVal = this.timeEstadoControl.value;
    if (timeVal && timeVal.trim() !== '') {
      dateEstadoFormatted = `${dateEstadoFormatted} ${timeVal.trim()}:00`;
    }

    const departamento = this.filterForm.get('departamento')?.value || '0';
    const orgCtrl = parseInt(this.filterForm.get('orgCtrl')?.value, 10) || 0;

    this.reportsService.getReportFechaCorte(dateEmisionFormatted, departamento, orgCtrl, dateEstadoFormatted).subscribe({
      next: (response) => {
        this.rawReports = response?.datos || [];
        this.transformRawDataToHierarchical();
        this.extractAvailableYears();
        this.applyLocalFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al consultar el reporte de fecha de corte:', error);
        this.rawReports = [];
        this.allInformes = [];
        this.filteredInformes = [];
        this.calculateKPIs();
        this.isLoading = false;
        this.alertsService.showAlert('Error al consultar el reporte de fecha de corte', 'error');
      }
    });
  }

  private transformRawDataToHierarchical(): void {
    if (!this.rawReports || this.rawReports.length === 0) {
      this.allInformes = [];
      return;
    }

    const cutoffDate = this.dateEstadoControl.value ? new Date(this.dateEstadoControl.value) : new Date();
    const cutoffYear = cutoffDate.getFullYear();

    // Grouping uniquely by idInforme or (memoAuditoria + auditorInforme + tituloInforme)
    const groupedMap = new Map<string, ReporteRecomendacionesFechaCorte[]>();

    this.rawReports.forEach(row => {
      const idKey = (row.idInforme !== undefined && row.idInforme !== null) ? String(row.idInforme).trim() : '';
      const memoKey = (row.memoAuditoria && row.memoAuditoria.trim() !== '') ? row.memoAuditoria.trim() : '';
      const auditorKey = (row.auditorInforme && row.auditorInforme.trim() !== '') ? row.auditorInforme.trim() : '';
      const tituloKey = (row.tituloInforme && row.tituloInforme.trim() !== '') ? row.tituloInforme.trim() : '';

      const key = idKey
        ? idKey
        : `${memoKey}___${auditorKey}___${tituloKey}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, []);
      }
      groupedMap.get(key)!.push(row);
    });

    const result: InformeReporteItem[] = [];

    groupedMap.forEach((rows, memoKey) => {
      const sample = rows[0];
      // Año tomado de Fecha de Aprobación de Presidencia, Fecha Memo, Memo Auditoría o Memo Aprobación
      const anioEmision = this.extractYearFromSample(sample);

      // Deduplicar recomendaciones dentro de un mismo informe por número de recomendación o descripción
      const uniqueRecRowsMap = new Map<string, ReporteRecomendacionesFechaCorte>();
      rows.forEach(r => {
        const recKey = (r.numeroRecomendacion !== undefined && r.numeroRecomendacion !== null && String(r.numeroRecomendacion).trim() !== '')
          ? `NUM_${String(r.numeroRecomendacion).trim()}`
          : `DESC_${(r.recomendacion || '').trim().toLowerCase()}`;
        if (!uniqueRecRowsMap.has(recKey)) {
          uniqueRecRowsMap.set(recKey, r);
        }
      });

      const uniqueRows = Array.from(uniqueRecRowsMap.values());

      const recomendaciones: RecomendacionReporteItem[] = uniqueRows.map((recRow, idx) => {
        const recEstado = (recRow.estadoRecomendacion || 'EN PROCESO').trim().toUpperCase();

        const responsablesList = this.parseResponsables(
          recRow.listaResponsables,
          recRow.listaDepartamentos,
          recEstado,
          recRow.fechaMaximaCumplimiento
        );

        let recProgreso = 0;
        if (recRow.progresoRecomendacion !== undefined && recRow.progresoRecomendacion !== null) {
          recProgreso = Number(Number(recRow.progresoRecomendacion).toFixed(2));
        } else if (recEstado === 'CUMPLIDA' || recEstado === 'NO APLICA') {
          recProgreso = 100;
        } else {
          const totalResp = responsablesList.length;
          const justificaResp = responsablesList.filter(r => r.estadoVerificable === 'JUSTIFICA').length;
          recProgreso = totalResp > 0 ? Number(((justificaResp / totalResp) * 100).toFixed(2)) : 0;
        }

        let numRec: number | null = null;
        if (recRow.numeroRecomendacion !== undefined && recRow.numeroRecomendacion !== null && String(recRow.numeroRecomendacion).trim() !== '') {
          const parsed = parseInt(String(recRow.numeroRecomendacion), 10);
          if (!isNaN(parsed)) {
            numRec = parsed;
          }
        }
        if (!numRec && recRow.recomendacion) {
          const match = recRow.recomendacion.match(/(?:^|\s|^Recomendaci[oó]n\s*)(\d{1,3})\s*[\.\-\)]/i);
          if (match) {
            numRec = parseInt(match[1], 10);
          }
        }
        const codigoFormatted = numRec ? `REC-${String(numRec).padStart(2, '0')}` : `REC-${String(idx + 1).padStart(2, '0')}`;

        return {
          idRec: (recRow as any).arereCodigo || (recRow as any).arere_codigo || (recRow as any).idRecomendacion,
          codigo: codigoFormatted,
          descripcion: recRow.recomendacion || 'Sin descripción de recomendación registrada.',
          riesgoVerificado: recRow.riesgoVerificado?.trim().toUpperCase() || null,
          evidenciaRequerida: recRow.evidenciaRequerida || null,
          evidenciasRequeridas: this.desglosarEvidenciaRequerida(recRow.evidenciaRequerida),
          riesgoOculto: true,
          evidenciasOcultas: true,
          conclusion: recRow.conclusion || '—',
          estadoRecomendacion: recEstado,
          fechaMaximaCumplimiento: recRow.fechaMaximaCumplimiento || '',
          progresoPercent: recProgreso,
          responsables: responsablesList
        };
      });

      // Progreso global del informe calculado dinámicamente según sus recomendaciones
      const progresoGlobal = recomendaciones.length > 0
        ? Number(((recomendaciones.filter(r => r.estadoRecomendacion === 'CUMPLIDA' || r.estadoRecomendacion === 'NO APLICA').length / recomendaciones.length) * 100).toFixed(2))
        : 0;

      result.push({
        idInforme: sample.idInforme,
        tituloInforme: (sample.tituloInforme || 'Examen Especial de Auditoría Interna').replace(/\s*\([^)]*\)\s*$/, '').trim(),
        organismoControl: sample.organismoControl || 'Auditoría Interna EEASA S.A.',
        memoAuditoria: sample.memoAuditoria || '—',
        memoAprobacion: sample.memoAprobacion || '—',
        auditorAsignado: sample.auditorInforme || 'Equipo de Auditoría Interna',
        fechaEmision: sample.fechaMemo || '',
        anioEmision: anioEmision,
        fechaAprobacionPresidencia: sample.fechaAprobacion || '',
        progresoGlobal: progresoGlobal,
        esArrastreHistorico: anioEmision < cutoffYear,
        recomendaciones: recomendaciones,
        expanded: true
      });
    });

    this.allInformes = result;
  }

  private parseResponsables(rawRespString: string, rawDeptString: string, recStatus: string, recFechaMax?: string): ResponsableReporteItem[] {
    if (!rawRespString || rawRespString.trim() === '' || rawRespString === 'null') {
      return [{
        nombre: 'Por Asignar',
        departamento: rawDeptString || '—',
        estadoVerificable: recStatus === 'CUMPLIDA' ? 'JUSTIFICA' : 'VERIFICABLE NO CREADO',
        estadoIndividual: recStatus,
        fechaIndividual: recFechaMax || '',
        plazoIndividual: '',
        observaciones: '—'
      }];
    }

    // Reemplazar saltos de línea dentro del texto para evitar falsos cortes
    const sanitizedString = rawRespString.replace(/[\r\n]+/g, ' ');
    const items = sanitizedString.split(/\s*\|\s*/).filter(s => s.trim().length > 0);
    const result: ResponsableReporteItem[] = [];

    items.forEach(item => {
      let rawText = item.trim();
      if (!rawText || rawText === '...' || rawText.startsWith('...(') || rawText.startsWith('...')) {
        return;
      }
      let departamento = rawDeptString || '—';
      let estadoVerificable = recStatus === 'CUMPLIDA' ? 'JUSTIFICA' : 'VERIFICABLE NO CREADO';
      let estadoIndividual = recStatus;
      let fechaIndividual = recFechaMax || '';
      let plazoIndividual = '';
      let observaciones = '—';
      let descripcionVerificable = '';
      let observacionesAll = '';
      let descripcionVerificableAll = '';
      let verificableCodigo: number | undefined;

      // Extraer código del verificable vigente a la fecha de corte (ej. [V:123])
      const codigoMatch = rawText.match(/\[V:(\d+)\]/);
      if (codigoMatch) {
        verificableCodigo = Number(codigoMatch[1]);
        rawText = rawText.replace(codigoMatch[0], '').trim();
      }

      // Extraer Fecha Individual [F:...]
      const fechaMatch = rawText.match(/\[F:([^\]]+)\]/);
      if (fechaMatch) {
        const fVal = fechaMatch[1].trim();
        if (fVal && fVal !== '—') {
          fechaIndividual = fVal;
        }
        rawText = rawText.replace(fechaMatch[0], '').trim();
      }

      // Extraer Plazo Individual [P:...]
      const plazoMatch = rawText.match(/\[P:([^\]]+)\]/);
      if (plazoMatch) {
        const pVal = plazoMatch[1].trim();
        if (pVal && pVal !== '—') {
          plazoIndividual = pVal;
        }
        rawText = rawText.replace(plazoMatch[0], '').trim();
      }

      // Extraer Estado Individual [E:...]
      const estadoIndMatch = rawText.match(/\[E:([^\]]+)\]/);
      if (estadoIndMatch) {
        const eVal = estadoIndMatch[1].trim().toUpperCase();
        if (eVal && eVal !== '—') {
          estadoIndividual = eVal;
        }
        rawText = rawText.replace(estadoIndMatch[0], '').trim();
      }

      const deptMatch = rawText.match(/\[(.*?)\]/);
      const statusMatch = rawText.match(/\(([^)]+)\)/);

      // Si el trozo de texto no tiene depto [...] ni estado (...) y ya existe un responsable previo en la lista,
      // corresponde a la continuación de la observación de ese responsable anterior
      if (!deptMatch && !statusMatch && result.length > 0) {
        const lastResp = result[result.length - 1];
        lastResp.observaciones = (lastResp.observaciones && lastResp.observaciones !== '—')
          ? `${lastResp.observaciones} ${rawText}`
          : rawText;
        return;
      }

      // 1. Extraer Departamento entre corchetes [...]
      if (deptMatch) {
        departamento = deptMatch[1].trim();
        rawText = rawText.replace(deptMatch[0], '').trim();
      }

      // 2. Extraer Estado Verificable entre paréntesis (...)
      if (statusMatch) {
        estadoVerificable = statusMatch[1].trim().toUpperCase();
        rawText = rawText.replace(statusMatch[0], '').trim();
      }

      // 3. Extraer Observación Auditoría All (ej. - ObsAll: ...)
      const obsAllMatch = rawText.match(/(?:-\s*ObsAll:)\s*([\s\S]*?)(?=\s*-\s*(?:DescAll|Desc|Obs):|$)/i);
      if (obsAllMatch) {
        observacionesAll = obsAllMatch[1].trim();
        rawText = rawText.replace(obsAllMatch[0], '').trim();
      }

      // 4. Extraer Descripción del Verificable All (ej. - DescAll: ...)
      const descAllMatch = rawText.match(/(?:-\s*DescAll:)\s*([\s\S]*?)(?=\s*-\s*(?:Desc|ObsAll|Obs):|$)/i);
      if (descAllMatch) {
        descripcionVerificableAll = descAllMatch[1].trim();
        rawText = rawText.replace(descAllMatch[0], '').trim();
      }

      // 5. Extraer Observación Auditoría única/reciente (ej. - Obs: ...)
      const obsMatch = rawText.match(/(?:-\s*Obs:)\s*([\s\S]*?)(?=\s*-\s*(?:DescAll|Desc|ObsAll):|$)/i);
      if (obsMatch) {
        observaciones = obsMatch[1].trim();
        rawText = rawText.replace(obsMatch[0], '').trim();
      }

      // 6. Extraer Descripción del Verificable única/reciente (ej. - Desc: ...)
      const descMatch = rawText.match(/(?:-\s*Desc:)\s*([\s\S]*?)(?=\s*-\s*(?:DescAll|ObsAll|Obs):|$)/i);
      if (descMatch) {
        descripcionVerificable = descMatch[1].trim();
        rawText = rawText.replace(descMatch[0], '').trim();
      }

      // Salvaguarda UI: si 'observaciones' viene concatenado con ' ;;; ', asegurar que la vista en pantalla (UI y Visor)
      // muestre SOLO la observación del verificable más reciente (la última), y respaldar todo en 'observacionesAll' para Excel.
      if (observaciones && observaciones.includes(' ;;; ')) {
        if (!observacionesAll) {
          observacionesAll = observaciones;
        }
        const obsParts = observaciones.split(' ;;; ').map(s => s.trim()).filter(Boolean);
        observaciones = obsParts.length > 0 ? obsParts[obsParts.length - 1] : observaciones;
      }

      // Salvaguarda UI: igual para la descripción del verificable
      if (descripcionVerificable && descripcionVerificable.includes(' ;;; ')) {
        if (!descripcionVerificableAll) {
          descripcionVerificableAll = descripcionVerificable;
        }
        const descParts = descripcionVerificable.split(' ;;; ').map(s => s.trim()).filter(Boolean);
        descripcionVerificable = descParts.length > 0 ? descParts[descParts.length - 1] : descripcionVerificable;
      }

      const nombre = rawText.trim() || 'Responsable Asignado';

      result.push({
        nombre: nombre,
        departamento: departamento,
        estadoVerificable: estadoVerificable,
        estadoIndividual: estadoIndividual,
        fechaIndividual: fechaIndividual,
        plazoIndividual: plazoIndividual,
        verificableCodigo: verificableCodigo,
        descripcionVerificable: descripcionVerificable,
        observaciones: observaciones,
        descripcionVerificableAll: observacionesAll ? (descripcionVerificableAll || descripcionVerificable) : descripcionVerificableAll,
        observacionesAll: observacionesAll
      });
    });

    return result.length > 0 ? result : [{
      nombre: rawRespString,
      departamento: rawDeptString || '—',
      estadoVerificable: recStatus === 'CUMPLIDA' ? 'JUSTIFICA' : 'VERIFICABLE NO CREADO',
      estadoIndividual: recStatus,
      fechaIndividual: recFechaMax || '',
      plazoIndividual: '',
      observaciones: '—'
    }];
  }

  private extractAvailableYears(): void {
    const yearsSet = new Set<number>();
    this.allInformes.forEach(inf => {
      if (inf.anioEmision) yearsSet.add(inf.anioEmision);
    });
    this.aniosDisponibles = Array.from(yearsSet).sort((a, b) => a - b);
  }

  protected applyLocalFilters(): void {
    const { date, orgCtrl, departamento, soloVerificablesPendientes, incluirCompletados, searchTerm } = this.filterForm.value;

    const cutoffDate = date ? new Date(date) : new Date();
    cutoffDate.setHours(23, 59, 59, 999);
    const cutoffYear = cutoffDate.getFullYear();
    const termClean = (searchTerm || '').toLowerCase().trim();

    let result: InformeReporteItem[] = JSON.parse(JSON.stringify(this.allInformes));

    // Actualizar dinámicamente el indicador de arrastre histórico respecto al año de la fecha de corte seleccionada
    result.forEach(inf => {
      inf.esArrastreHistorico = inf.anioEmision < cutoffYear;
    });

    const dateEmisionVal = this.dateEmisionControl.value ? new Date(this.dateEmisionControl.value) : new Date();
    const cutoffEmisionYear = dateEmisionVal.getFullYear();

    // 0. Filtrar ÚNICAMENTE los informes pertenecientes al Periodo de Evaluación seleccionado
    if (this.informesIDsDelPeriodoSeleccionado !== null) {
      result = result.filter(inf =>
        this.informesIDsDelPeriodoSeleccionado!.has(Number(inf.idInforme))
      );
    }

    // 1. Multi-selección de Años Anteriores
    if (this.aniosSeleccionados.length > 0) {
      result = result.filter(inf => this.aniosSeleccionados.includes(inf.anioEmision));
    }

    // 2. Multi-selección de Organismos de Control
    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map((cod: number) => this.getOrganismoControlDescripcion(String(cod)))
        .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
        .map((desc: string) => this.normalizeText(desc));

      if (selectedDescs.length > 0) {
        result = result.filter(inf => selectedDescs.includes(this.normalizeText(inf.organismoControl)));
      }
    }

    // 3. Excluir Informes al 100% solo si incluirCompletados es explícitamente false
    if (incluirCompletados === false) {
      result = result.filter(inf => inf.progresoGlobal < 100);
    }

    // 4. Filtrar por Departamento del Responsable
    if (departamento && departamento !== '0') {
      result = result.filter(inf =>
        inf.recomendaciones.some(rec => rec.responsables.some(resp => resp.departamento === departamento))
      );
    }

    // 5. Filtrar recomendaciones y responsables
    result.forEach(inf => {
      if (incluirCompletados === false) {
        inf.recomendaciones = inf.recomendaciones.filter(rec => rec.estadoRecomendacion !== 'CUMPLIDA');
      }

      // Filtrar ÚNICAMENTE las recomendaciones que están incluidas en el periodo de evaluación seleccionado
      if (this.recomendacionesIncluidasDelPeriodoSeleccionado !== null) {
        inf.recomendaciones = inf.recomendaciones.filter(rec => {
          const numMatch = rec.codigo.match(/REC-(\d+)/i);
          const numRec = numMatch ? parseInt(numMatch[1], 10) : null;
          const recIdStr = rec.idRec ? String(rec.idRec).trim() : null;

          const isIncludedById = recIdStr !== null && this.recomendacionesIncluidasDelPeriodoSeleccionado!.has(`ID_${recIdStr}`);
          const isIncludedByNum = (numRec !== null && inf.idInforme) ? (
            this.recomendacionesIncluidasDelPeriodoSeleccionado!.has(`${inf.idInforme}_${numRec}`) ||
            this.recomendacionesIncluidasDelPeriodoSeleccionado!.has(`${inf.idInforme}_${String(numRec).padStart(2, '0')}`)
          ) : false;

          return isIncludedById || isIncludedByNum;
        });
      }

      inf.recomendaciones.forEach(rec => {
        if (soloVerificablesPendientes) {
          rec.responsables = rec.responsables.filter(resp => {
            const st = resp.estadoVerificable ? resp.estadoVerificable.trim().toUpperCase() : '';
            return st !== 'JUSTIFICA';
          });
        }

        // Filtrar ÚNICAMENTE los responsables que están incluidos en el periodo de evaluación seleccionado
        if (this.responsablesIncluidosDelPeriodoSeleccionado !== null) {
          rec.responsables = rec.responsables.filter(resp => {
            if (resp.nombre === 'Por Asignar') {
              return true;
            }

            const respNameClean = this.normalizeText(resp.nombre);
            const recIdKey = rec.idRec ? String(rec.idRec).trim() : null;
            const numMatch = rec.codigo.match(/REC-(\d+)/i);
            const numRec = numMatch ? parseInt(numMatch[1], 10) : null;
            const infRecKey = (inf.idInforme && numRec !== null) ? `${inf.idInforme}_${numRec}` : null;

            // 1. Verificación directa por clave ID_nombre o Informe_NumRec_nombre
            const directByRec = recIdKey ? this.responsablesIncluidosDelPeriodoSeleccionado!.has(`${recIdKey}_${respNameClean}`) : false;
            const directByInfRec = infRecKey ? this.responsablesIncluidosDelPeriodoSeleccionado!.has(`${infRecKey}_${respNameClean}`) : false;
            if (directByRec || directByInfRec) {
              return true;
            }

            // 2. Coincidencia de nombres asignados a esta recomendación en el periodo
            const candidateNames = (recIdKey && this.responsablesPorRecMap?.get(recIdKey))
              || (infRecKey && this.responsablesPorRecMap?.get(infRecKey))
              || [];

            return candidateNames.some(cand =>
              cand === respNameClean ||
              cand.includes(respNameClean) ||
              respNameClean.includes(cand)
            );
          });
        }

        if (departamento && departamento !== '0') {
          rec.responsables = rec.responsables.filter(resp => resp.departamento === departamento);
        }
      });

      // Si se filtró por periodo o departamento, remover recomendaciones que se hayan quedado sin responsables
      if (this.responsablesIncluidosDelPeriodoSeleccionado !== null || (departamento && departamento !== '0')) {
        inf.recomendaciones = inf.recomendaciones.filter(rec => rec.responsables.length > 0);
      }
    });

    // Remover informes que no contengan recomendaciones en este periodo
    result = result.filter(inf => inf.recomendaciones.length > 0);

    // 6. Palabra Clave
    if (termClean) {
      result = result.filter(inf =>
        inf.tituloInforme.toLowerCase().includes(termClean) ||
        inf.organismoControl.toLowerCase().includes(termClean) ||
        inf.memoAuditoria.toLowerCase().includes(termClean) ||
        inf.memoAprobacion.toLowerCase().includes(termClean) ||
        inf.auditorAsignado.toLowerCase().includes(termClean) ||
        inf.anioEmision.toString().includes(termClean) ||
        inf.recomendaciones.some(rec =>
          rec.codigo.toLowerCase().includes(termClean) ||
          rec.descripcion.toLowerCase().includes(termClean) ||
          rec.responsables.some(resp =>
            resp.nombre.toLowerCase().includes(termClean) ||
            resp.departamento.toLowerCase().includes(termClean)
          )
        )
      );
    }

    // 7. Ordenar desde el año más antiguo hasta el actual (ascendente)
    result.sort((a, b) => a.anioEmision - b.anioEmision);

    this.filteredInformes = result;
    this.calculateKPIs();
  }

  private calculateKPIs(): void {
    let infPendientesCount = 0;
    let infCumplidosCount = 0;
    let recPendientesCount = 0;
    let recCumplidasCount = 0;
    let arrastreCount = 0;
    let asignacionesCount = 0;

    this.filteredInformes.forEach(inf => {
      if (inf.progresoGlobal >= 100) {
        infCumplidosCount++;
      } else {
        infPendientesCount++;
      }

      if (inf.esArrastreHistorico) {
        arrastreCount++;
      }

      inf.recomendaciones.forEach(rec => {
        if (rec.estadoRecomendacion === 'CUMPLIDA') {
          recCumplidasCount++;
        } else {
          recPendientesCount++;
        }

        if (rec.responsables && rec.responsables.length > 0) {
          const realAsignaciones = rec.responsables.filter(r => r.nombre !== 'Por Asignar').length;
          asignacionesCount += realAsignaciones > 0 ? realAsignaciones : 1;
        }
      });
    });

    this.totalInformesPendientes = infPendientesCount;
    this.totalInformesCumplidos = infCumplidosCount;
    this.totalRecomendacionesPendientes = recPendientesCount;
    this.totalRecomendacionesCumplidas = recCumplidasCount;
    this.totalArrastreHistorico = arrastreCount;
    this.totalAsignaciones = asignacionesCount;
  }

  clearFilters(): void {
    const today = new Date();
    const formattedToday = this.formatDateForInput(today);
    this.aniosSeleccionados = [];
    this.periodosSeleccionados = [];
    this.informesIDsDelPeriodoSeleccionado = null;
    this.recomendacionesIncluidasDelPeriodoSeleccionado = null;
    this.responsablesIncluidosDelPeriodoSeleccionado = null;
    this.responsablesPorRecMap = null;
    this.organismosSeleccionados = [];
    this.filterForm.patchValue({
      dateEmision: formattedToday,
      dateEstado: formattedToday,
      timeEstado: '',
      date: formattedToday,
      periodoId: '0',
      orgCtrl: '0',
      departamento: '0',
      soloVerificablesPendientes: true,
      incluirCompletados: false,
      searchTerm: ''
    });

    this.filterStateService.clearFilters('rep_fecha_corte');
    this.fetchBackendReport();
  }

  toggleOrganismo(codigo: number | string): void {
    const numericCode = typeof codigo === 'string' ? parseInt(codigo, 10) : codigo;
    const idx = this.organismosSeleccionados.indexOf(numericCode);
    if (idx >= 0) {
      this.organismosSeleccionados.splice(idx, 1);
    } else {
      this.organismosSeleccionados.push(numericCode);
    }
    this.applyLocalFilters();
  }

  toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.applyLocalFilters();
  }

  getOrganismosSeleccionadosLabel(): string {
    if (!this.organismosSeleccionados || this.organismosSeleccionados.length === 0) {
      return 'Todos los Entes';
    }
    if (this.organismosSeleccionados.length === 1) {
      const org = this.organismosControl.find(o => Number(o.ainoc_codigo) === this.organismosSeleccionados[0]);
      return org ? org.ainoc_descripcion : '1 Ente Seleccionado';
    }
    return `${this.organismosSeleccionados.length} Entes Seleccionados`;
  }

  toggleAnio(anio: number): void {
    const idx = this.aniosSeleccionados.indexOf(anio);
    if (idx >= 0) {
      this.aniosSeleccionados.splice(idx, 1);
    } else {
      this.aniosSeleccionados.push(anio);
    }
    this.applyLocalFilters();
  }

  toggleAllAnios(): void {
    this.aniosSeleccionados = [];
    this.applyLocalFilters();
  }

  getAniosSeleccionadosLabel(): string {
    if (this.aniosSeleccionados.length === 0) {
      return 'Todos los Años';
    }
    const sorted = [...this.aniosSeleccionados].sort((a, b) => a - b);
    return sorted.join(', ');
  }

  toggleExpand(inf: InformeReporteItem): void {
    inf.expanded = !inf.expanded;
  }

  expandAll(): void {
    this.filteredInformes.forEach(inf => inf.expanded = true);
  }

  collapseAll(): void {
    this.filteredInformes.forEach(inf => inf.expanded = false);
  }

  protected desglosarEvidenciasRequeridas(texto?: string | null): string[] {
    const contenido = texto?.trim() || '';
    if (!contenido) return [];
    return /^1[.)]\s+/.test(contenido)
      ? contenido.split(/(?:\r?\n)+(?=\d+[.)]\s+)/).map(item => item.replace(/^\d+[.)]\s+/, ''))
      : [contenido];
  }

  private desglosarEvidenciaRequerida(texto?: string | null): string[] {
    const contenido = texto?.trim() || '';
    if (!contenido) return [];
    return /^1[.)]\s+/.test(contenido)
      ? contenido.split(/(?:\r?\n)+(?=\d+[.)]\s+)/).map(item => item.replace(/^\d+[.)]\s+/, ''))
      : [contenido];
  }

  exportToExcel(): void {
    if (!this.filteredInformes || this.filteredInformes.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      const headerData = [
        ['REPORTE DE SEGUIMIENTO DE RECOMENDACIONES A FECHA DE CORTE'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha de Corte:', this.formatDateToDisplay(this.dateControl.value)],
        ['Ente de Control:', this.getOrganismosSeleccionadosLabel()],
        ['Departamento:', this.filterForm.get('departamento')?.value === '0' ? 'Todos' : this.filterForm.get('departamento')?.value],
        ['Años Anteriores:', this.getAniosSeleccionadosLabel()],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        ['']
      ];

      const flatRows: any[] = [];

      this.filteredInformes.forEach(inf => {
        inf.recomendaciones.forEach(rec => {
          if (rec.responsables.length === 0) {
            flatRows.push({
              'Tipo Registro': inf.esArrastreHistorico ? 'INFORME EMITIDO' : 'AÑO ACTUAL',
              'Código del Informe': inf.idInforme !== undefined && inf.idInforme !== null ? inf.idInforme : '—',
              'Título del Informe': inf.tituloInforme,
              'Ente de Control': inf.organismoControl,
              'Memo Auditoría': inf.memoAuditoria,
              'Memo Aprobación Presidencia': inf.memoAprobacion,
              'Auditor Asignado': inf.auditorAsignado,
              'Fecha Emisión': this.formatDateToDisplay(inf.fechaEmision),
              'Fecha Aprobación': this.formatDateToDisplay(inf.fechaAprobacionPresidencia),
              'Progreso del Informe': `${inf.progresoGlobal || 0}%`,
              'Código Rec.': rec.codigo,
              'Conclusión': rec.conclusion || '—',
              'Recomendación': rec.descripcion,
              'Estado Recomendación': rec.estadoRecomendacion,
              'Progreso Recomendación': `${rec.progresoPercent || 0}%`,
              'Fecha Máxima Cumplimiento': this.formatDateToDisplay(rec.fechaMaximaCumplimiento),
              'Responsable Asignado': '—',
              'Departamento': '—',
              'Fecha Máxima Responsable': '—',
              'Plazo Responsable (días)': '—',
              'Estado Verificable': '—',
              'Estado Individual Responsable': '—',
              'Descripción del Verificable': '',
              'Observación Auditoría': '—',
                'Riesgo verificado': rec.riesgoVerificado || 'Sin registrar',
                'Evidencia requerida': rec.evidenciaRequerida || 'Sin registrar'
            });
          } else {
            rec.responsables.forEach(resp => {
              const descVerificable = this.formatearListaParaExcel(resp.descripcionVerificableAll || resp.descripcionVerificable, 'Verificable');
              const observacionAuditoria = this.formatearListaParaExcel(resp.observacionesAll || resp.observaciones, 'OBS');
              flatRows.push({
                'Tipo Registro': inf.esArrastreHistorico ? 'INFORME EMITIDO' : 'AÑO ACTUAL',
                'Código del Informe': inf.idInforme !== undefined && inf.idInforme !== null ? inf.idInforme : '—',
                'Título del Informe': inf.tituloInforme,
                'Ente de Control': inf.organismoControl,
                'Memo Auditoría': inf.memoAuditoria,
                'Memo Aprobación Presidencia': inf.memoAprobacion,
                'Auditor Asignado': inf.auditorAsignado,
                'Fecha Emisión': this.formatDateToDisplay(inf.fechaEmision),
                'Fecha Aprobación': this.formatDateToDisplay(inf.fechaAprobacionPresidencia),
                'Progreso del Informe': `${inf.progresoGlobal || 0}%`,
                'Código Rec.': rec.codigo,
                'Conclusión': rec.conclusion || '—',
                'Recomendación': rec.descripcion,
                'Estado Recomendación': rec.estadoRecomendacion,
                'Progreso Recomendación': `${rec.progresoPercent || 0}%`,
                'Fecha Máxima Cumplimiento': this.formatDateToDisplay(rec.fechaMaximaCumplimiento),
                'Responsable Asignado': resp.nombre,
                'Departamento': resp.departamento,
                'Fecha Máxima Responsable': this.formatDateToDisplay(resp.fechaIndividual || rec.fechaMaximaCumplimiento),
                'Plazo Responsable (días)': (resp.estadoIndividual === 'CUMPLIDA' || resp.estadoVerificable === 'JUSTIFICA' || resp.estadoIndividual === 'NO APLICA') ? '—' : ((resp.plazoIndividual !== undefined && resp.plazoIndividual !== null && resp.plazoIndividual !== '' && resp.plazoIndividual !== '—') ? resp.plazoIndividual : '—'),
                'Estado Verificable': resp.estadoVerificable,
                'Estado Individual Responsable': resp.estadoIndividual || rec.estadoRecomendacion,
                'Descripción del Verificable': descVerificable,
                'Observación Auditoría': observacionAuditoria || '—',
                'Riesgo verificado': rec.riesgoVerificado || 'Sin registrar',
                'Evidencia requerida': rec.evidenciaRequerida || 'Sin registrar'
              });
            });
          }
        });
      });

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);
      const worksheet = Object.assign({}, worksheetHeader);

      const headerRowCount = headerData.length;
      XLSX.utils.sheet_add_json(worksheet, flatRows, { origin: `A${headerRowCount + 1}` });

      worksheet['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 45 }, { wch: 30 }, { wch: 25 }, { wch: 22 },
        { wch: 28 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 45 }, { wch: 45 },
        { wch: 22 }, { wch: 20 }, { wch: 24 }, { wch: 30 }, { wch: 25 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 24 }, { wch: 40 }, { wch: 35 }, { wch: 20 }, { wch: 60 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Fecha_Corte');

      const dateStr = (this.dateControl.value || '').replace(/-/g, '');
      const fileName = `Reporte_Fecha_Corte_${dateStr || 'general'}.xlsx`;

      XLSX.writeFile(workbook, fileName, {
        bookType: 'xlsx',
        type: 'binary',
        cellStyles: true,
        compression: true
      });

      this.alertsService.showAlert('Reporte exportado a Excel con éxito', 'success');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      this.alertsService.showAlert('Error al generar el archivo Excel', 'error');
    }
  }

  private getOrganismoControlDescripcion(codigo: string | number): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';

    const organismo = this.organismosControl.find(org => Number(org.ainoc_codigo) === codigoNum);
    return organismo ? organismo.ainoc_descripcion : 'Todos';
  }

  private extractYearFromSample(sample: ReporteRecomendacionesFechaCorte): number {
    const candidates = [
      sample.fechaAprobacion,
      sample.fechaMemo,
      sample.memoAuditoria,
      sample.memoAprobacion,
      sample.tituloInforme
    ];

    for (const text of candidates) {
      if (!text) continue;
      const clean = text.trim();
      if (!clean || clean === 'null' || clean === 'undefined') continue;

      // 1. YYYY-MM-DD or YYYY/MM/DD
      const isoMatch = clean.match(/^(\d{4})[-/]/);
      if (isoMatch) return parseInt(isoMatch[1], 10);

      // 2. DD/MM/YYYY or DD-MM-YYYY
      const lat4Match = clean.match(/[-/](\d{4})\b/);
      if (lat4Match) return parseInt(lat4Match[1], 10);

      // 3. 4-digit year anywhere (e.g., 2023, 2024, 2025)
      const year4Match = clean.match(/\b(19\d{2}|20\d{2})\b/);
      if (year4Match) return parseInt(year4Match[1], 10);

      // 4. DD/MM/YY or DD-MM-YY or DD-MON-YY (e.g. 15-MAR-23 or 15/03/24)
      const lat2Match = clean.match(/[-/](\d{2})\b/);
      if (lat2Match) {
        const yy = parseInt(lat2Match[1], 10);
        return yy >= 80 ? 1900 + yy : 2000 + yy;
      }

      // 5. Code pattern with 2-digit year (e.g. MEM-23-015 or DAI-24-001)
      const memo2Match = clean.match(/[-/](\d{2})[-/]/);
      if (memo2Match) {
        const yy = parseInt(memo2Match[1], 10);
        return yy >= 80 ? 1900 + yy : 2000 + yy;
      }
    }

    return new Date().getFullYear();
  }

  private formatDateForInput(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateForService(dateStr: string): string {
    if (!dateStr) return '';
    const isoMatch = dateStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoMatch) {
      const [, year, month, day, hours, minutes, seconds] = isoMatch;
      if (hours !== undefined && minutes !== undefined && (hours !== '00' || minutes !== '00')) {
        const sec = seconds !== undefined ? seconds : '00';
        return `${day}/${month}/${year} ${hours}:${minutes}:${sec}`;
      }
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  }

  protected formatDateToDisplay(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '' || dateStr === 'null' || dateStr === 'undefined') return '—';
    const cleanStr = dateStr.trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(cleanStr)) return cleanStr.split(' ')[0];
    const isoMatch = cleanStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
    return cleanStr;
  }

  // Convierte la lista concatenada con ' ;;; ' (varios verificables/observaciones de un
  // responsable) en un texto con saltos de línea para mostrar en una sola celda.
  // Si se indica un prefijo, cada elemento se numera (ej. "Verificable 1: ...", "OBS 1: ...").
  protected formatearListaParaExcel(texto?: string, prefijo?: string): string {
    if (!texto || texto === '—') return '';
    const items = texto.split(' ;;; ').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return '';
    if (!prefijo) return items.join(' ; ');
    return items.map((item, i) => `${prefijo} ${i + 1}: ${item}`).join(' ; ');
  }

  protected formatearListaParaMostrar(texto?: string): string {
    if (!texto || texto === '—') return '—';
    return texto.split(' ;;; ').map(s => s.trim()).filter(Boolean).join('\n');
  }

  protected getPlazoBadgeClass(plazoStr?: string | number): string {
    if (plazoStr === undefined || plazoStr === null || plazoStr === '' || plazoStr === '—') {
      return 'badge-ghost text-base-content/60';
    }
    const num = parseInt(String(plazoStr), 10);
    if (isNaN(num)) {
      return 'badge-ghost text-base-content/60';
    }
    if (num < 0) {
      return 'badge-error text-white font-bold';
    }
    if (num <= 15) {
      return 'badge-warning text-warning-content font-bold';
    }
    return 'badge-success text-white font-bold';
  }

  private parseDateStringToObj(dateStr: string): Date {
    if (!dateStr || dateStr.trim() === '' || dateStr === 'null' || dateStr === 'undefined') {
      return new Date('2099-12-31');
    }
    const clean = dateStr.trim();

    // DD/MM/YYYY
    const latMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (latMatch) {
      const [, day, month, year] = latMatch;
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    }

    // YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    }

    const d = new Date(clean);
    return isNaN(d.getTime()) ? new Date('2099-12-31') : d;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  countByEstado(recs: RecomendacionReporteItem[], estado: string): number {
    return recs.filter(r => r.estadoRecomendacion === estado || r.estadoRecomendacion === 'NO APLICA').length;
  }

  countPendientes(recs: RecomendacionReporteItem[]): number {
    return recs.filter(r => r.estadoRecomendacion !== 'CUMPLIDA' && r.estadoRecomendacion !== 'NO APLICA').length;
  }

  protected abrirVisorVerificable(inf: InformeReporteItem, rec: RecomendacionReporteItem, resp: ResponsableReporteItem): void {
    let recId = rec.idRec ? Number(rec.idRec) : 0;
    const matchNum = rec.codigo.match(/\d+/);
    const numRec = matchNum ? parseInt(matchNum[0], 10) : 1;

    this.currentVerificableData = {
      responsableNombre: resp.nombre,
      departamento: resp.departamento,
      estadoVerificable: resp.estadoVerificable,
      observaciones: this.formatearListaParaMostrar(resp.observaciones),
      codigoRec: rec.codigo,
      idRec: recId,
      idInforme: inf.idInforme,
      memoAuditoria: inf.memoAuditoria,
      tituloInforme: inf.tituloInforme,
      isLoadingFile: true,
      fileError: null
    };

    this.safePdfUrl = null;
    this.isVerificableModalOpen = true;

    const loadDocForRec = (resolvedRecId: number) => {
      this.verificablesRespSrv.getVerificablesResp(resolvedRecId, '0').subscribe({
        next: (res) => {
          const list = res?.datos?.verificables || [];

          const mostrarSinDocumento = (mensaje: string) => {
            if (this.currentVerificableData) {
              this.currentVerificableData.isLoadingFile = false;
              this.currentVerificableData.fileError = mensaje;
            }
          };

          const cargarDocumento = (verif: any) => {
            const ruta = verif?.areve_adjunto || verif?.adjunto;
            if (ruta) {
              if (this.currentVerificableData) {
                this.currentVerificableData.verificableObj = verif;
                this.currentVerificableData.fileRuta = ruta;
              }
              this.cargarArchivoVerificable(ruta);
            } else {
              mostrarSinDocumento('No se encontró el documento verificable vigente a la fecha de corte.');
            }
          };

          // [V:0] => a la fecha de corte aún no existía verificable.
          if (resp.verificableCodigo === 0) {
            mostrarSinDocumento('A la fecha de corte seleccionada aún no existía un verificable para este responsable.');
            return;
          }

          // [V:codigo] => buscar el verificable vigente a la fecha de corte por su código.
          if (resp.verificableCodigo && resp.verificableCodigo > 0) {
            const matched = list.find((v: any) => Number(v.areve_codigo) === resp.verificableCodigo);
            if (matched) {
              cargarDocumento(matched);
            } else {
              mostrarSinDocumento('No se encontró el documento verificable vigente a la fecha de corte.');
            }
            return;
          }

          // Sin marcador [V:...] (procedimiento no actualizado): retroceder a búsqueda por nombre.
          let matchedVerif = list.find((v: any) => {
            const respName = (v.responsable || v.arers_nombre || v.usuario || '').toString().toLowerCase().trim();
            const targetName = resp.nombre.toLowerCase().trim();
            return respName && targetName && (respName.includes(targetName) || targetName.includes(respName));
          });
          if (!matchedVerif && list.length > 0) {
            matchedVerif = list[0];
          }
          if (matchedVerif) {
            cargarDocumento(matchedVerif);
          } else {
            mostrarSinDocumento('No se encontró un documento verificable para este responsable.');
          }
        },
        error: (err) => {
          console.error('Error al obtener verificables:', err);
          if (this.currentVerificableData) {
            this.currentVerificableData.isLoadingFile = false;
            this.currentVerificableData.fileError = 'Error al consultar la información del verificable en el servidor.';
          }
        }
      });
    };

    if (recId > 0) {
      loadDocForRec(recId);
    } else {
      const infId = inf.idInforme ? Number(inf.idInforme) : 0;
      if (infId > 0) {
        this.recomVerificablesSrv.getRecomendaciones(infId).subscribe({
          next: (res) => {
            const recsList = res?.datos?.recomendaciones || [];
            const matchedRec = recsList.find((r: any) =>
              Number(r.arere_num_rec || r.arere_codigo) === numRec ||
              (r.arere_descripcion && r.arere_descripcion.trim() === rec.descripcion.trim())
            );
            if (matchedRec?.arere_codigo) {
              rec.idRec = matchedRec.arere_codigo;
              if (this.currentVerificableData) {
                this.currentVerificableData.idRec = matchedRec.arere_codigo;
              }
              loadDocForRec(matchedRec.arere_codigo);
            } else {
              if (this.currentVerificableData) {
                this.currentVerificableData.isLoadingFile = false;
                this.currentVerificableData.fileError = 'No se pudo identificar la recomendación en la base de datos.';
              }
            }
          },
          error: () => {
            if (this.currentVerificableData) {
              this.currentVerificableData.isLoadingFile = false;
              this.currentVerificableData.fileError = 'Error al consultar los detalles del informe.';
            }
          }
        });
      } else {
        if (this.currentVerificableData) {
          this.currentVerificableData.isLoadingFile = false;
          this.currentVerificableData.fileError = 'No se pudo obtener el identificador de la recomendación.';
        }
      }
    }
  }

  private cargarArchivoVerificable(ruta: string): void {
    this.fileSrv.getFile(ruta).subscribe({
      next: (res) => {
        if (!this.currentVerificableData) return;
        this.currentVerificableData.isLoadingFile = false;

        const base64 = res?.datos?.archivo || (typeof res?.datos === 'string' ? res.datos : null);
        if (!base64) {
          this.currentVerificableData.fileError = 'El archivo no contiene datos legibles o fue eliminado del servidor.';
          return;
        }

        try {
          const cleanBase64 = base64.replace(/\s/g, '');
          const byteCharacters = atob(cleanBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);

          const lowerRuta = ruta.toLowerCase();
          let mimeType = 'application/pdf';
          if (lowerRuta.endsWith('.png')) mimeType = 'image/png';
          else if (lowerRuta.endsWith('.jpg') || lowerRuta.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else if (lowerRuta.endsWith('.txt')) mimeType = 'text/plain';

          const blob = new Blob([byteArray], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);

          this.currentVerificableData.fileBase64 = cleanBase64;
          this.currentVerificableData.fileType = mimeType.startsWith('image/') ? 'image' : (mimeType === 'application/pdf' ? 'pdf' : 'other');
          this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);
        } catch (e) {
          console.error('Error procesando archivo:', e);
          this.currentVerificableData.fileError = 'Error al decodificar el archivo adjunto.';
        }
      },
      error: (err) => {
        console.error('Error al obtener archivo FTP:', err);
        if (this.currentVerificableData) {
          this.currentVerificableData.isLoadingFile = false;
          this.currentVerificableData.fileError = 'Error de conexión con el servidor al descargar el archivo.';
        }
      }
    });
  }

  protected descargarDocVerificable(): void {
    if (!this.currentVerificableData || !this.currentVerificableData.fileBase64) return;
    const ruta = this.currentVerificableData.fileRuta || 'verificable.pdf';
    const fileName = ruta.substring(ruta.lastIndexOf('/') + 1) || 'verificable.pdf';

    try {
      const byteCharacters = atob(this.currentVerificableData.fileBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      this.alertsService.showAlert('Error al descargar el archivo.', 'error');
    }
  }

  protected cerrarVisorVerificable(): void {
    this.isVerificableModalOpen = false;
    this.currentVerificableData = null;
    this.safePdfUrl = null;
  }
}