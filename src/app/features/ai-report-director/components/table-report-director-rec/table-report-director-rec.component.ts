import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ReportsDirectorService } from '../../services/reports-director.service';
import { ReportDirector } from '../../models/report-director';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { RecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/recomendaciones.service';
import { ResponsableView } from '@features/ai-seguim-auditor-operativo/models/recomendacion';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import * as XLSX from 'xlsx';
import { FilterStateService } from '@core/services/filter-state.service';

export interface ResponsableItem {
  nombre: string;
  estado: string;
}

export interface PopoverData {
  title: string;
  text?: string;
  items?: ResponsableItem[];
  x: number;
  y: number;
}

@Component({
  selector: 'app-table-report-director-rec',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginationComponent, StatusColorPipe],
  templateUrl: './table-report-director-rec.component.html',
  styleUrl: './table-report-director-rec.component.css'
})
export class TableReportDirectorRecComponent implements OnInit {
  // Services
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportsService = inject(ReportsDirectorService);
  private readonly auxiliarSrv = inject(AuxiliaryService);
  private readonly recomendacionesSrv = inject(RecomendacionesService);
  private responsablesCache = new Map<number, string>();
  private readonly filterStateService = inject(FilterStateService);

  // Forms
  protected filterForm: FormGroup;
  protected startDateControl: FormControl;
  protected endDateControl: FormControl;
  // Inicializar con 0 para seleccionar "Todos" por defecto
  protected orgCtrlControl = new FormControl(0);
  protected estadoSegControl = new FormControl(0);
  protected auditorControl = new FormControl('0'); // String para auditores
  protected searchTermControl = new FormControl('');
  // Data
  protected reports: ReportDirector[] = [];
  protected displayedReports: ReportDirector[] = [];
  protected filteredReports: ReportDirector[] = [];
  protected organismosControl: OrganismoControl[] = [];
  protected estadosSeguimiento: EstadoSeg[] = [];
  protected auditores: UsuarioAuditor[] = [];
  // Pagination
  protected currentPage = 1;
  protected itemsPerPage = 5;
  
  // States
  protected isLoading = false;
  protected hasData = false;

  constructor() {
    // Obtener fecha base 2022-01-01 para incluir todo el historial
    const firstDayOfYear = new Date(2022, 0, 1);
    
    // Obtener el día actual
    const today = new Date();
    
    // Formatear las fechas a ISO string (YYYY-MM-DD)
    const firstDayFormatted = this.formatDateToISO(firstDayOfYear);
    const todayFormatted = this.formatDateToISO(today);

    // Inicializar los controles con las fechas por defecto
    this.startDateControl = new FormControl(firstDayFormatted);
    this.endDateControl = new FormControl(todayFormatted);

    // Crear el formulario con todos los controles
    this.filterForm = this.formBuilder.group({
      startDate: this.startDateControl,
      endDate: this.endDateControl,
      orgCtrl: this.orgCtrlControl,
      estadoSeg: this.estadoSegControl,
      auditor: this.auditorControl,
      searchTerm: this.searchTermControl
    });
  }

  protected ordenRecAscendente: boolean = true;

  public ordenarPorNumero(): void {
    this.ordenRecAscendente = !this.ordenRecAscendente;
    this.filteredReports.sort((a, b) => {
      const numA = this.extractRecNumber(a);
      const numB = this.extractRecNumber(b);
      return this.ordenRecAscendente ? (numA - numB) : (numB - numA);
    });
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  public getRecCode(report: any): string {
    const num = this.extractRecNumber(report);
    if (num != null && num > 0 && num !== 999) {
      return `REC-${String(num).padStart(2, '0')}`;
    }
    return '—';
  }

  public matchesSearch(report: ReportDirector, rawSearchTerm: string): boolean {
    const term = rawSearchTerm.toLowerCase().trim();
    if (!term) return true;

    // Búsqueda multi-palabra (ej: "AI-115 rec 2" o "rmerino rec 5")
    const words = term.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 1) {
      return words.every(word => this.matchesSearch(report, word));
    }

    const numRec = this.extractRecNumber(report);
    const recCode = this.getRecCode(report).toLowerCase(); // ej: "rec-02" o "—"
    const numStr = numRec !== 999 ? String(numRec) : '';
    const numPadded = numStr ? numStr.padStart(2, '0') : '';

    // 1. Coincidencia directa con Código o Número de Recomendación
    // Si el usuario escribe: "rec 2", "rec-2", "rec-02", "rec. 2", "recomendacion 2", "rec 02", "r2", etc.
    const recQueryMatch = term.match(/^(?:rec(?:omendaci[oó]n)?|r|n[°o.]*)[\s\-#°.]*(\d{1,3})$/i);
    if (recQueryMatch) {
      const searchedNum = parseInt(recQueryMatch[1], 10);
      if (numRec === searchedNum) return true;
    }

    // Si el término coincide con el código de recomendación (ej: "rec-02", "rec-", "02")
    if (recCode !== '—' && (recCode.includes(term) || term.includes(recCode))) {
      return true;
    }

    // Si el término contiene o coincide con patrones de número de recomendación
    if (numStr) {
      const patterns = [
        `rec ${numStr}`,
        `rec ${numPadded}`,
        `rec-${numStr}`,
        `rec-${numPadded}`,
        `rec.${numStr}`,
        `rec. ${numStr}`,
        `recomendacion ${numStr}`,
        `recomendación ${numStr}`,
        `recomendacion ${numPadded}`,
        `recomendación ${numPadded}`,
        `n° ${numStr}`,
        `n°${numStr}`
      ];
      if (patterns.some(p => p.includes(term) || term.includes(p))) {
        return true;
      }
      // Si el término es exactamente el número (ej: busca "2" o "02")
      if (term === numStr || term === numPadded) {
        return true;
      }
    }

    // 2. Coincidencia con campos textuales del reporte
    const auditorCompleto = this.auditores.find(aud => aud.dsgus_cuenta === report.auditorInforme);
    const auditorNombre = auditorCompleto?.nombre_completo?.toLowerCase() || '';

    return (
      (report.tituloInforme?.toLowerCase().includes(term) ?? false) ||
      (report.conclusion?.toLowerCase().includes(term) ?? false) ||
      (report.recomendacion?.toLowerCase().includes(term) ?? false) ||
      (report.memorandoAuditoria?.toLowerCase().includes(term) ?? false) ||
      (report.memoAprobacion?.toLowerCase().includes(term) ?? false) ||
      (report.auditorInforme?.toLowerCase().includes(term) ?? false) ||
      auditorNombre.includes(term) ||
      (report.organismoControl?.toLowerCase().includes(term) ?? false) ||
      (report.estadoSeguimiento?.toLowerCase().includes(term) ?? false) ||
      (report.responsables?.toLowerCase().includes(term) ?? false) ||
      (report.listaResponsables?.toLowerCase().includes(term) ?? false) ||
      (report.fechaEmision?.toLowerCase().includes(term) ?? false) ||
      (report.fechaACumplir?.toLowerCase().includes(term) ?? false)
    );
  }

  private applySearchFilter(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase().trim() || '';
    if (!searchTerm) {
      this.filteredReports = [...this.reports];
    } else {
      this.filteredReports = this.reports.filter(report => this.matchesSearch(report, searchTerm));
    }
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  // Función auxiliar para formatear fecha a YYYY-MM-DD
  private formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_director_rec');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.loadInitialData();
    this.setupFormSubscription();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_director_rec', val);
    });
  }

  clearFilters(): void {
    const firstDayOfYear = new Date(2022, 0, 1);
    const today = new Date();
    
    const firstDayFormatted = this.formatDateToISO(firstDayOfYear);
    const todayFormatted = this.formatDateToISO(today);

    this.filterForm.setValue({
      startDate: firstDayFormatted,
      endDate: todayFormatted,
      orgCtrl: 0,
      estadoSeg: 0,
      auditor: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_director_rec');
    
    this.currentPage = 1;
    this.reports = [];
    this.filteredReports = [];
    this.displayedReports = [];
    this.hasData = false;
    this.loadReportData();
  }

  private loadInitialData(): void {
    // Cargar las opciones para los selectores
    this.loadOrganismosControl();
    this.loadEstadosSeguimiento();
    this.loadAuditores();
    
    // Cargar datos iniciales con los filtros por defecto
    this.loadReportData();
  }

  private loadOrganismosControl(): void {
    this.reportsService.getOrganismos().subscribe({
      next: (response) => {
        if (response) {
          this.organismosControl = response.datos;
        }
      },
      error: (error) => console.error('Error al cargar organismos de control:', error)
    });
  }

  private loadEstadosSeguimiento(): void {
    this.reportsService.getEstadoSeg().subscribe({
      next: (response) => {
        if (response && response.datos) {
          this.estadosSeguimiento = response.datos;
        }
      },
      error: (error) => console.error('Error al cargar estados de seguimiento:', error)
    });
  }

  private loadAuditores(): void {
    this.reportsService.getAuditores().subscribe({
      next: (response) => {
        if (response && response.datos) {
          this.auditores = response.datos.usuarios;
        }
      },
      error: (error) => console.error('Error al cargar auditores:', error)
    });
  }

  private setupFormSubscription(): void {
    // Controles que disparan recarga desde el backend
    this.startDateControl.valueChanges.subscribe(() => this.onBackendFilterChange());
    this.endDateControl.valueChanges.subscribe(() => this.onBackendFilterChange());
    this.orgCtrlControl.valueChanges.subscribe(() => this.onBackendFilterChange());
    this.estadoSegControl.valueChanges.subscribe(() => this.onBackendFilterChange());
    this.auditorControl.valueChanges.subscribe(() => this.onBackendFilterChange());

    // Filtro por palabra clave aplicado reactivamente en memoria
    this.searchTermControl.valueChanges.subscribe(() => {
      this.applySearchFilter();
    });
  }

  private onBackendFilterChange(): void {
    if (this.filterForm.valid && this.startDateControl.value && this.endDateControl.value) {
      this.currentPage = 1;
      this.loadReportData();
    }
  }

  private getRecomendacionKey(memorando: string | undefined, recomendacion: string | undefined): string {
    const memClean = (memorando || '').trim().toLowerCase();
    const recClean = (recomendacion || '').trim().toLowerCase().replace(/[\s\r\n]+/g, ' ');
    return `${memClean}___${recClean.slice(0, 80)}`;
  }

  private loadReportData(): void {
    this.isLoading = true;
    this.hasData = false;

    const departamento = this.auxiliarSrv.getUserInfo().departamento;
    const startDate = this.startDateControl.value!;
    const endDate = this.endDateControl.value!;
    const orgCtrl = this.orgCtrlControl.value!;
    const estadoSeg = this.estadoSegControl.value!;
    const auditor = this.auditorControl.value!;

    forkJoin({
      reportDirectorRes: this.reportsService.getReportForDirector(startDate, endDate, orgCtrl, estadoSeg, auditor, departamento),
      fechasVencidasRes: this.reportsService.getReportDepartamentoFechasVencidas(startDate, endDate, orgCtrl, 0, auditor, departamento).pipe(
        catchError(() => of(null))
      )
    }).subscribe({
      next: ({ reportDirectorRes, fechasVencidasRes }) => {
        if (reportDirectorRes && reportDirectorRes.datos) {
          this.reports = reportDirectorRes.datos;

          const lookupMap = new Map<string, { responsables: string; arereCodigo: number }>();
          if (fechasVencidasRes && fechasVencidasRes.datos) {
            fechasVencidasRes.datos.forEach(fv => {
              const key = this.getRecomendacionKey(fv.memorando, fv.recomendacion);
              if (key && (fv.responsables || fv.arereCodigo)) {
                lookupMap.set(key, {
                  responsables: fv.responsables || '',
                  arereCodigo: fv.arereCodigo
                });
              }
            });
          }

          this.reports.forEach(rep => {
            const anyRep = rep as any;
            const key = this.getRecomendacionKey(rep.memorandoAuditoria, rep.recomendacion);
            const match = lookupMap.get(key);
            if (match) {
              if (!anyRep.responsables && !anyRep.listaResponsables) {
                rep.responsables = match.responsables;
              }
              if (!anyRep.arereCodigo && !anyRep.arere_codigo && !anyRep.idRec) {
                rep.arereCodigo = match.arereCodigo;
              }
            }
          });

          this.reports = this.sortReports(this.reports);
          this.hasData = this.reports.length > 0;
          this.applySearchFilter();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar el reporte:', error);
        this.isLoading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedReports();
  }

  onItemsPerPageChange(items: number): void {
    this.itemsPerPage = items;
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private parseReportDate(dateStr?: string): number {
    if (!dateStr) return 0;
    try {
      const parts = dateStr.trim().split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY-MM-DD
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        } else { // DD-MM-YYYY
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        }
      }
      const d = new Date(dateStr).getTime();
      return isNaN(d) ? 0 : d;
    } catch {
      return 0;
    }
  }

  public extractRecNumber(report: any): number {
    if (report.numRec != null && !isNaN(Number(report.numRec)) && Number(report.numRec) > 0) {
      return Number(report.numRec);
    }
    if (report.arereNumRec != null && !isNaN(Number(report.arereNumRec)) && Number(report.arereNumRec) > 0) {
      return Number(report.arereNumRec);
    }
    const text = (report.recomendacion || '').trim();

    // 1. Número seguido de punto en los primeros 120 caracteres:
    // Ej: "Al Presidente Ejecutivo 2.", "A la Presidencia Ejecutiva 7.", "1.", "Recomendación 5."
    const matchDot = text.slice(0, 120).match(/(?:^|[^\d])(\d{1,3})\s*\./);
    if (matchDot && matchDot[1]) {
      return parseInt(matchDot[1], 10);
    }

    // 2. Patrones con "Recomendación N° X" o "Recomendación X"
    const matchPrefix = text.slice(0, 120).match(/recomendaci[oó]n\s*(?:n[°o.]*\s*)?(\d{1,3})/i);
    if (matchPrefix && matchPrefix[1]) {
      return parseInt(matchPrefix[1], 10);
    }

    // 3. Dígito al inicio del texto
    const matchLeading = text.match(/^(\d{1,3})/);
    if (matchLeading && matchLeading[1]) {
      return parseInt(matchLeading[1], 10);
    }

    // 4. Cualquier primer número aislado en los primeros 100 caracteres
    const matchAny = text.slice(0, 100).match(/\b(\d{1,3})\b/);
    if (matchAny && matchAny[1]) {
      return parseInt(matchAny[1], 10);
    }

    return 999;
  }

  private sortReports(reports: ReportDirector[]): ReportDirector[] {
    return [...reports].sort((a, b) => {
      // 1. Fecha del informe: del más antiguo al más actual
      const dateA = this.parseReportDate(a.fechaEmision);
      const dateB = this.parseReportDate(b.fechaEmision);
      if (dateA !== dateB) {
        return dateA - dateB;
      }

      // 2. Agrupar por informe
      const infA = `${a.codigoInforme ?? ''}_${a.memorandoAuditoria ?? ''}_${a.memoAprobacion ?? ''}_${a.tituloInforme ?? ''}`.trim().toLowerCase();
      const infB = `${b.codigoInforme ?? ''}_${b.memorandoAuditoria ?? ''}_${b.memoAprobacion ?? ''}_${b.tituloInforme ?? ''}`.trim().toLowerCase();
      if (infA !== infB) {
        return infA.localeCompare(infB);
      }

      // 3. Recomendaciones en orden del 1 en adelante
      const numA = this.extractRecNumber(a);
      const numB = this.extractRecNumber(b);
      if (numA !== numB) {
        return numA - numB;
      }

      const idA = a.arereCodigo ?? a.arere_codigo ?? 0;
      const idB = b.arereCodigo ?? b.arere_codigo ?? 0;
      return idA - idB;
    });
  }

  private updateDisplayedReports(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(start, end);
    this.prefetchDisplayedResponsables();
  }

  private prefetchDisplayedResponsables(): void {
    const userDpto = this.auxiliarSrv.getUserInfo()?.departamento;
    const cleanUserDpto = (userDpto || '').toUpperCase().replace(/DPTO\.|DEPARTAMENTO|DIRECCION/g, '').trim();

    this.displayedReports.forEach(rep => {
      const anyReport = rep as any;
      const recId: number | undefined =
        anyReport.arereCodigo ||
        anyReport.arere_codigo ||
        anyReport.idRec ||
        anyReport.id_rec ||
        anyReport.codigoRecomendacion ||
        anyReport.codigo_recomendacion ||
        anyReport.idRecomendacion ||
        anyReport.id_recomendacion ||
        anyReport.id;

      if (recId && !this.responsablesItemsCache.has(recId)) {
        this.recomendacionesSrv.getResponsables(recId).subscribe({
          next: (res) => {
            const datos = res?.datos || [];
            const pendingResps = datos.filter((r: ResponsableView) => {
              const anyR = r as any;
              const isActual = r.arers_estado !== '0' && anyR.arers_estado !== 0 && anyR.aredr_estado !== 0 && anyR.aredr_estado !== '0';
              if (!isActual) return false;

              if (cleanUserDpto) {
                const respDpto = (r.arers_departamento || anyR.departamento || anyR.arers_departamento_abrev || '').toUpperCase().replace(/DPTO\.|DEPARTAMENTO|DIRECCION/g, '').trim();
                if (respDpto && !respDpto.includes(cleanUserDpto) && !cleanUserDpto.includes(respDpto)) {
                  return false;
                }
              }

              const state = (r.areev_descripcion || r.estadoVerificableReporte7 || '').trim().toUpperCase();
              if (!state) return true;
              return state !== 'JUSTIFICA' && state !== 'CUMPLIDA' && state !== 'CUMPLIDO';
            });

            const items: ResponsableItem[] = pendingResps.map((r: ResponsableView) => {
              const anyR = r as any;
              return {
                nombre: (r.nombre_completo || `${anyR.arers_nombre || ''} ${anyR.arers_apellido || ''}`).trim(),
                estado: (r.areev_descripcion || r.estadoVerificableReporte7 || 'PENDIENTE DE ATENCIÓN').trim()
              };
            }).filter(item => item.nombre.length > 0);

            this.responsablesItemsCache.set(recId, items);
          },
          error: () => {}
        });
      }
    });
  }

  exportToExcel(): void {
    try {
      // Preparar los datos para el reporte
      const reportData: any[] = [];

      // 1. Agregar encabezado con información de filtros
      reportData.push([
        'REPORTE DE RECOMENDACIONES PARA DIRECTOR',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);
      reportData.push(['', '', '', '', '', '', '', '', '', '']); // Línea en blanco
      reportData.push(['Fecha de generación:', new Date().toLocaleString(), '', '', '', '', '', '', '', '']);
      reportData.push(['Período:', `${this.startDateControl.value} al ${this.endDateControl.value}`, '', '', '', '', '', '', '', '']);

      // Agregar información de filtros aplicados
      const organismoSeleccionado = this.organismosControl.find(org => 
        Number(org.ainoc_codigo) === Number(this.orgCtrlControl.value)
      );
      const organismoTexto = Number(this.orgCtrlControl.value) === 0 ? 'Todos' : (organismoSeleccionado?.ainoc_descripcion || 'Todos');
      reportData.push(['Organismo de Control:', organismoTexto, '', '', '', '', '', '', '', '']);

      const estadoSeleccionado = this.estadosSeguimiento.find(est => 
        Number(est.arees_codigo) === Number(this.estadoSegControl.value)
      );
      const estadoTexto = Number(this.estadoSegControl.value) === 0 ? 'Todos' : (estadoSeleccionado?.arees_descripcion || 'Todos');
      reportData.push(['Estado de Seguimiento:', estadoTexto, '', '', '', '', '', '', '', '']);

      const auditorSeleccionado = this.auditores.find(aud => 
        aud.dsgus_cuenta === this.auditorControl.value
      );
      const auditorTexto = this.auditorControl.value === '0' ? 'Todos' : (auditorSeleccionado?.nombre_completo || 'Todos');
      reportData.push(['Auditor:', auditorTexto, '', '', '', '', '', '', '', '']);

      const departamento = this.auxiliarSrv.getUserInfo().departamento;
      reportData.push(['Departamento:', departamento, '', '', '', '', '', '', '', '']);

      reportData.push(['', '', '', '', '', '', '', '', '', '']); // Línea en blanco

      // 2. Agregar encabezados de columnas
      reportData.push([
        'TÍTULO INFORME',
        'CÓDIGO REC',
        'N° REC',
        'CONCLUSIÓN',
        'RECOMENDACIÓN',
        'MEMORANDO AUDITORÍA',
        'MEMORANDO APROBACIÓN',
        'FECHA EMISIÓN',
        'FECHA A CUMPLIR',
        'ESTADO SEGUIMIENTO',
        'AUDITOR',
        'ORGANISMO CONTROL',
      ]);

      // 3. Agregar datos
      this.filteredReports.forEach(report => {
        // Buscar el nombre completo del auditor
        const auditorCompleto = this.auditores.find(aud => 
          aud.dsgus_cuenta === report.auditorInforme
        );
        const nombreAuditor = auditorCompleto ? auditorCompleto.nombre_completo : report.auditorInforme;
        const recNum = this.extractRecNumber(report);
        const recCode = this.getRecCode(report);

        reportData.push([
          report.tituloInforme,
          recCode,
          recNum !== 999 ? recNum : '',
          report.conclusion,
          report.recomendacion,
          report.memorandoAuditoria,
          report.memoAprobacion,
          report.fechaEmision,
          report.fechaACumplir,
          report.estadoSeguimiento,
          nombreAuditor, // Usar el nombre completo en lugar de report.auditor
          report.organismoControl,
        ]);
      });

      // 4. Crear el libro de trabajo
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(reportData);

      // 5. Configurar estilos
      // Establecer ancho de columnas
      ws['!cols'] = [
        { wch: 50 }, // Título Informe
        { wch: 15 }, // Código Rec
        { wch: 10 }, // N° Rec
        { wch: 50 }, // Conclusión
        { wch: 50 }, // Recomendación
        { wch: 25 }, // Memorando Auditoría
        { wch: 25 }, // Memorando Aprobación
        { wch: 25 }, // Fecha Emisión
        { wch: 25 }, // Fecha a Cumplir
        { wch: 25 }, // Estado Seguimiento
        { wch: 40 }, // Auditor
        { wch: 40 }, // Organismo Control
      ];

      // Establecer alto de filas para el encabezado
      ws['!rows'] = [
        { hpt: 30 }, // Altura para el título
      ];

      // 6. Aplicar estilos a las celdas
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellRef]) continue;

          // Asegurarse de que la celda tenga una propiedad de estilo
          if (!ws[cellRef].s) ws[cellRef].s = {};

          // Estilos para el título principal (primera fila)
          if (R === 0) {
            ws[cellRef].s = {
              font: { bold: true, size: 14 },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
          }
          // Estilos para los encabezados de la tabla
          else if (R === 9) {
            ws[cellRef].s = {
              font: { bold: true },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              fill: { fgColor: { rgb: "CCCCCC" } }
            };
          }
          // Estilos para el resto de las celdas
          else {
            ws[cellRef].s = {
              alignment: { vertical: 'top', wrapText: true }
            };
          }
        }
      }

      // 7. Agregar la hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte Director');

      // 8. Generar el nombre del archivo con la fecha actual
      const fecha = new Date().toISOString().split('T')[0];
      const fileName = `reporte_director_${fecha}.xlsx`;

      // 9. Guardar el archivo
      XLSX.writeFile(wb, fileName);

    } catch (error) {
      console.error('Error al exportar a Excel:', error);
    }
  }

  protected activePopover: PopoverData | null = null;
  private responsablesItemsCache = new Map<number, ResponsableItem[]>();
  private hidePopoverTimeout: any = null;

  protected showPopover(event: MouseEvent, title: string, textOrItems: string | ResponsableItem[]): void {
    if (!textOrItems) return;
    this.cancelHidePopover();

    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const popoverWidth = 440;
    const popoverHeight = 300;

    // Posicionar verticalmente (y) alineado con la fila sobre la que está el puntero
    let y = rect.top - 6;
    if (y + popoverHeight > window.innerHeight - 20) {
      y = Math.max(10, window.innerHeight - popoverHeight - 20);
    }
    if (y < 10) {
      y = 10;
    }

    // Posicionar horizontalmente (x) al lado de la celda de la fila
    let x = rect.left - popoverWidth - 12;
    if (x < 10) {
      x = Math.max(10, rect.left + rect.width + 12);
    }
    if (x + popoverWidth > window.innerWidth - 10) {
      x = Math.max(10, window.innerWidth - popoverWidth - 10);
    }

    if (typeof textOrItems === 'string') {
      this.activePopover = { title, text: textOrItems, x, y };
    } else {
      this.activePopover = { title, items: textOrItems, x, y };
    }
  }

  protected hidePopover(): void {
    this.hidePopoverTimeout = setTimeout(() => {
      this.activePopover = null;
    }, 150);
  }

  protected cancelHidePopover(): void {
    if (this.hidePopoverTimeout) {
      clearTimeout(this.hidePopoverTimeout);
      this.hidePopoverTimeout = null;
    }
  }

  protected showEstadoSeguimientoPopover(event: MouseEvent, report: ReportDirector): void {
    const anyReport = report as any;
    const estadoSeg = (report.estadoSeguimiento || anyReport.estado_seguimiento || anyReport.estado || '').trim().toUpperCase();

    if (estadoSeg === 'CUMPLIDA' || estadoSeg === 'CUMPLIDO') {
      this.showPopover(event, 'Estado de la Recomendación', 'La recomendación se encuentra cumplida, no hay responsables pendientes de cumplimiento.');
      return;
    }

    const recId: number | undefined =
      anyReport.arereCodigo ||
      anyReport.arere_codigo ||
      anyReport.idRec ||
      anyReport.id_rec ||
      anyReport.codigoRecomendacion ||
      anyReport.codigo_recomendacion ||
      anyReport.idRecomendacion ||
      anyReport.id_recomendacion ||
      anyReport.id;

    // 1. Respuesta instantánea (0ms) si ya está en caché
    if (recId && this.responsablesItemsCache.has(recId)) {
      const cachedItems = this.responsablesItemsCache.get(recId)!;
      if (cachedItems.length > 0) {
        this.showPopover(event, 'Responsables Pendientes', cachedItems);
        return;
      } else if (estadoSeg === 'NO CUMPLIDA') {
        this.showPopover(event, 'Estado de la Recomendación', 'La recomendación se encuentra registrada como NO CUMPLIDA.');
        return;
      } else {
        this.showPopover(event, 'Estado de la Recomendación', 'La recomendación se encuentra cumplida, no hay responsables pendientes de cumplimiento.');
        return;
      }
    }

    // 2. Consulta estructurada al servicio Backend para obtener NOMBRES REALES DE PERSONAS
    if (recId) {
      this.recomendacionesSrv.getResponsables(recId).subscribe({
        next: (res) => {
          const datos = res?.datos || [];
          const userDpto = this.auxiliarSrv.getUserInfo().departamento;
          const cleanUserDpto = (userDpto || '').toUpperCase().replace(/DPTO\.|DEPARTAMENTO|DIRECCION/g, '').trim();

          const pendingResps = datos.filter((r: ResponsableView) => {
            const anyR = r as any;
            // 1. Excluir responsables reasignados / anteriores
            const isActual = r.arers_estado !== '0' && anyR.arers_estado !== 0 && anyR.aredr_estado !== 0 && anyR.aredr_estado !== '0';
            if (!isActual) return false;

            // 2. Filtrar únicamente los pertenecientes al departamento del Director logueado
            if (cleanUserDpto) {
              const respDpto = (r.arers_departamento || anyR.departamento || anyR.arers_departamento_abrev || '').toUpperCase().replace(/DPTO\.|DEPARTAMENTO|DIRECCION/g, '').trim();
              if (respDpto && !respDpto.includes(cleanUserDpto) && !cleanUserDpto.includes(respDpto)) {
                return false;
              }
            }

            // 3. Excluir los que ya justificaron / cumplieron
            const state = (r.areev_descripcion || r.estadoVerificableReporte7 || '').trim().toUpperCase();
            if (!state) return true;
            return state !== 'JUSTIFICA' && state !== 'CUMPLIDA' && state !== 'CUMPLIDO';
          });

          const items: ResponsableItem[] = pendingResps.map((r: ResponsableView) => {
            const anyR = r as any;
            return {
              nombre: (r.nombre_completo || `${anyR.arers_nombre || ''} ${anyR.arers_apellido || ''}`).trim(),
              estado: (r.areev_descripcion || r.estadoVerificableReporte7 || 'PENDIENTE DE ATENCIÓN').trim()
            };
          }).filter(item => item.nombre.length > 0);

          this.responsablesItemsCache.set(recId, items);
          if (items.length > 0) {
            this.showPopover(event, 'Responsables Pendientes', items);
          } else if (estadoSeg === 'NO CUMPLIDA') {
            this.showPopover(event, 'Estado de la Recomendación', 'La recomendación se encuentra registrada como NO CUMPLIDA.');
          } else {
            this.showPopover(event, 'Estado de la Recomendación', 'La recomendación se encuentra cumplida, no hay responsables pendientes de cumplimiento.');
          }
        },
        error: () => {
          this.showPopover(event, 'Responsables', 'No se pudieron cargar los responsables.');
        }
      });
      return;
    }

    if (estadoSeg === 'NO CUMPLIDA') {
      this.showPopover(event, 'Estado de la Recomendación', 'La recomendación se encuentra registrada como NO CUMPLIDA.');
    } else {
      this.showPopover(event, 'Estado de la Recomendación', 'La recomendación se encuentra cumplida, no hay responsables pendientes de cumplimiento.');
    }
  }

  private parseResponsablesList(responsablesStr: string): ResponsableItem[] {
    if (!responsablesStr || !responsablesStr.trim()) return [];

    const userDpto = this.auxiliarSrv.getUserInfo()?.departamento;
    const cleanUserDpto = (userDpto || '').toUpperCase().replace(/DPTO\.|DEPARTAMENTO|DIRECCION/g, '').trim();

    const rawItems = responsablesStr
      .replace(/[\r\n]+/g, ' ')
      .split(/\s*(?:\||;)\s*/)
      .filter((item: string) => item.trim().length > 0);

    const itemsToProcess = rawItems.length > 1 ? rawItems : responsablesStr.split(/\s*,\s*/);
    const result: ResponsableItem[] = [];

    for (let rawItem of itemsToProcess) {
      let text = rawItem.trim();
      if (!text) continue;

      const upperText = text.toUpperCase();

      if (upperText.includes('REASIGNADO') || upperText.includes('ANTERIOR')) {
        continue;
      }

      if (cleanUserDpto) {
        const dptoMatch = upperText.match(/\[([^\]]+)\]/);
        if (dptoMatch) {
          const dptoInside = dptoMatch[1].replace(/DPTO\.|DEPARTAMENTO|DIRECCION/g, '').trim();
          if (dptoInside && !dptoInside.includes(cleanUserDpto) && !cleanUserDpto.includes(dptoInside)) {
            continue;
          }
        }
      }

      let estado = '';
      const statusMatch = text.match(/\(([^)]+)\)/);
      if (statusMatch) {
        estado = statusMatch[1].trim();
      } else {
        if (upperText.includes('VERIFICABLE NO CREADO')) estado = 'VERIFICABLE NO CREADO';
        else if (upperText.includes('NO JUSTIFICA')) estado = 'NO JUSTIFICA';
        else if (upperText.includes('PENDIENTE')) estado = 'PENDIENTE';
        else if (upperText.includes('JUSTIFICA') || upperText.includes('CUMPLIDA')) estado = 'JUSTIFICA';
        else estado = 'PENDIENTE DE ATENCIÓN';
      }

      const upperEstado = estado.toUpperCase();
      if (upperEstado === 'JUSTIFICA' || upperEstado === 'CUMPLIDO' || upperEstado === 'CUMPLIDA') {
        continue;
      }
      if (upperText.includes('(JUSTIFICA)') || upperText.includes('(CUMPLIDO)') || upperText.includes('(CUMPLIDA)')) {
        continue;
      }

      const obsPrefixMatch = text.match(/(?:-\s*(?:ObsAll|DescAll|Obs|Desc):|\s+-\s+)([\s\S]*)$/i);
      if (obsPrefixMatch) {
        text = text.substring(0, obsPrefixMatch.index).trim();
      }

      let cleanName = text
        .replace(/\([^)]*\)/g, '')   // Remove parenthetical status
        .replace(/\[[^\]]*\]/g, '')  // Remove department brackets
        .replace(/\[V:\d+\]/gi, '')
        .replace(/-\s*(?:VERIFICABLE NO CREADO|PENDIENTE|NO JUSTIFICA|JUSTIFICA|ObsAll|DescAll|Obs|Desc).*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanName && !cleanName.startsWith('-') && cleanName.length < 60) {
        if (!result.some(r => r.nombre === cleanName)) {
          result.push({
            nombre: cleanName,
            estado: estado
          });
        }
      }
    }

    return result;
  }
}
