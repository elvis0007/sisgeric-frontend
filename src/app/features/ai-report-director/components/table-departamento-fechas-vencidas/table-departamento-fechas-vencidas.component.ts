import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReportsDirectorService } from '../../services/reports-director.service';
import { ReportDepartamentoFechasVencidas } from '../../models/report-departamento-fechas-vencidas';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import * as XLSX from 'xlsx';
import { FilterStateService } from '@core/services/filter-state.service';

@Component({
  selector: 'app-table-departamento-fechas-vencidas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginationComponent, AbsPipe],
  templateUrl: './table-departamento-fechas-vencidas.component.html',
  styleUrl: './table-departamento-fechas-vencidas.component.css'
})
export class TableDepartamentoFechasVencidasComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportsService = inject(ReportsDirectorService);
  private readonly auxiliarSrv = inject(AuxiliaryService);
  private readonly modalResponsablesSrv: ModalResponsablesService = inject(ModalResponsablesService);
  private readonly filterStateService = inject(FilterStateService);
  private readonly route = inject(ActivatedRoute);

  protected filterForm: FormGroup;
  protected startDateControl: FormControl;
  protected endDateControl: FormControl;
  protected orgCtrlControl = new FormControl(0);
  protected auditorControl = new FormControl('0');
  // 0 = Todas, 1 = En proceso (plazo >= 0), 2 = Vencidas (plazo < 0)
  protected estadoPlazoControl = new FormControl(0);
  protected searchTermControl = new FormControl('');
  
  protected reports: ReportDepartamentoFechasVencidas[] = [];
  protected displayedReports: ReportDepartamentoFechasVencidas[] = [];
  protected filteredReports: ReportDepartamentoFechasVencidas[] = [];
  protected organismosControl: OrganismoControl[] = [];
  protected auditores: UsuarioAuditor[] = [];
  
  protected currentPage = 1;
  protected itemsPerPage = 5;
  
  protected isLoading = false;
  protected hasData = false;

  constructor() {
    const firstDayOfYear = new Date(2022, 0, 1);
    const today = new Date();
    
    const firstDayFormatted = this.formatDateToISO(firstDayOfYear);
    const todayFormatted = this.formatDateToISO(today);

    this.startDateControl = new FormControl(firstDayFormatted);
    this.endDateControl = new FormControl(todayFormatted);

    this.filterForm = this.formBuilder.group({
      startDate: this.startDateControl,
      endDate: this.endDateControl,
      orgCtrl: this.orgCtrlControl,
      auditor: this.auditorControl,
      estadoPlazo: this.estadoPlazoControl,
      searchTerm: this.searchTermControl
    });
  }

  /**
   * Métodos para código, ordenamiento y búsqueda de recomendaciones.
   */
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

  public matchesSearch(report: ReportDepartamentoFechasVencidas, rawSearchTerm: string): boolean {
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
    return (
      (report.tituloInforme?.toLowerCase().includes(term) ?? false) ||
      (report.recomendacion?.toLowerCase().includes(term) ?? false) ||
      (report.enteControl?.toLowerCase().includes(term) ?? false) ||
      (report.memorando?.toLowerCase().includes(term) ?? false) ||
      (report.memoAprobacion?.toLowerCase().includes(term) ?? false) ||
      (report.observacion?.toLowerCase().includes(term) ?? false) ||
      (report.auditor?.toLowerCase().includes(term) ?? false) ||
      (report.responsables?.toLowerCase().includes(term) ?? false) ||
      (report.fechaEmision?.toLowerCase().includes(term) ?? false) ||
      (report.fechaMaxima?.toLowerCase().includes(term) ?? false)
    );
  }

  /**
   * Aplica los filtros de búsqueda y estado (todas / en proceso / vencidas)
   * sobre la lista completa de reportes.
   */
  private applyAllFilters(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase().trim() || '';
    let result = [...this.reports];

    // Filtro por palabra clave
    if (searchTerm) {
      result = result.filter(report => this.matchesSearch(report, searchTerm));
    }

    // Filtro por estado de plazo (todas / en proceso / vencidas)
    // El valor del select llega como string, por eso se convierte explícitamente a número.
    const estadoPlazo = Number(this.estadoPlazoControl.value ?? 0);
    if (estadoPlazo === 1) {
      // En proceso: plazo >= 0 (vigentes que incluyen el día de hoy con 0 días)
      result = result.filter(report => (report.plazo ?? 0) >= 0);
    } else if (estadoPlazo === 2) {
      // Vencidas: plazo < 0 (días en contra / vencidas pasadas)
      result = result.filter(report => (report.plazo ?? 0) < 0);
    }

    this.filteredReports = result;
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_dpto_fechas_vencidas');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    const initialQueryState = this.route.snapshot.queryParams['estadoPlazo'];
    if (initialQueryState !== undefined) {
      const defaultStart = this.formatDateToISO(new Date(2022, 0, 1));
      if (!savedFilters || !savedFilters.startDate || savedFilters.startDate > '2022-01-01') {
        this.startDateControl.setValue(defaultStart, { emitEvent: false });
      }
      this.estadoPlazoControl.setValue(Number(initialQueryState), { emitEvent: false });
    }

    this.route.queryParams.subscribe(params => {
      if (params['estadoPlazo'] !== undefined) {
        const val = Number(params['estadoPlazo']);
        this.estadoPlazoControl.setValue(val);
      }
    });

    this.loadInitialData();
    this.setupFormSubscription();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_dpto_fechas_vencidas', val);
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
      auditor: '0',
      estadoPlazo: 0,
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_dpto_fechas_vencidas');
    
    this.currentPage = 1;
    this.reports = [];
    this.displayedReports = [];
    this.hasData = false;
    this.loadReportData();
  }

  private loadInitialData(): void {
    this.loadOrganismosControl();
    this.loadAuditores();
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
    this.filterForm.valueChanges.subscribe(() => {
      if (this.filterForm.valid && this.startDateControl.value && this.endDateControl.value) {
        this.loadReportData();
      }
    });

    // Filtro de búsqueda y estado se aplican en memoria sobre los datos cargados
    this.searchTermControl.valueChanges.subscribe(() => {
      this.applyAllFilters();
    });

    this.estadoPlazoControl.valueChanges.subscribe(() => {
      this.applyAllFilters();
    });
  }

  private loadReportData(): void {
    this.isLoading = true;
    this.hasData = false;

    const departamento = this.auxiliarSrv.getUserInfo().departamento;

    this.reportsService.getReportDepartamentoFechasVencidas(
      this.startDateControl.value!,
      this.endDateControl.value!,
      this.orgCtrlControl.value!,
      0, // Mantener 0 (todos) para estado de seguimiento en backend
      this.auditorControl.value!,
      departamento
    ).subscribe({
      next: (response) => {
        if (response) {
          this.reports = this.sortReports(response.datos || []);
          this.hasData = this.reports.length > 0;
          this.applyAllFilters();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar el reporte:', error);
        this.isLoading = false;
      }
    });
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

  private sortReports(reports: ReportDepartamentoFechasVencidas[]): ReportDepartamentoFechasVencidas[] {
    return [...reports].sort((a, b) => {
      // 1. Fecha del informe: del más antiguo al más actual
      const dateA = this.parseReportDate(a.fechaEmision);
      const dateB = this.parseReportDate(b.fechaEmision);
      if (dateA !== dateB) {
        return dateA - dateB;
      }

      // 2. Agrupar por informe
      const infA = `${a.aininCodigo ?? ''}_${a.memorando ?? ''}_${a.memoAprobacion ?? ''}_${a.tituloInforme ?? ''}`.trim().toLowerCase();
      const infB = `${b.aininCodigo ?? ''}_${b.memorando ?? ''}_${b.memoAprobacion ?? ''}_${b.tituloInforme ?? ''}`.trim().toLowerCase();
      if (infA !== infB) {
        return infA.localeCompare(infB);
      }

      // 3. Recomendaciones en orden del 1 en adelante
      const numA = this.extractRecNumber(a);
      const numB = this.extractRecNumber(b);
      if (numA !== numB) {
        return numA - numB;
      }

      return (a.arereCodigo ?? 0) - (b.arereCodigo ?? 0);
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

  private updateDisplayedReports(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(start, end);
  }

  exportToExcel(): void {
    try {
      const reportData: any[] = [];

      reportData.push([
        'REPORTE DE DEPARTAMENTO FECHAS VENCIDAS',
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
      reportData.push(['', '', '', '', '', '', '', '', '', '']);
      reportData.push(['Fecha de generación:', new Date().toLocaleString(), '', '', '', '', '', '', '', '']);
      reportData.push(['Período:', `${this.startDateControl.value} al ${this.endDateControl.value}`, '', '', '', '', '', '', '', '']);

      const organismoSeleccionado = this.organismosControl.find(org => 
        Number(org.ainoc_codigo) === Number(this.orgCtrlControl.value)
      );
      const organismoTexto = Number(this.orgCtrlControl.value) === 0 ? 'Todos' : (organismoSeleccionado?.ainoc_descripcion || 'Todos');
      reportData.push(['Organismo de Control:', organismoTexto, '', '', '', '', '', '', '', '']);


      const auditorSeleccionado = this.auditores.find(aud => 
        aud.dsgus_cuenta === this.auditorControl.value
      );
      const auditorTexto = this.auditorControl.value === '0' ? 'Todos' : (auditorSeleccionado?.nombre_completo || 'Todos');
      reportData.push(['Auditor:', auditorTexto, '', '', '', '', '', '', '', '']);

      const departamento = this.auxiliarSrv.getUserInfo().departamento;
      reportData.push(['Departamento:', departamento, '', '', '', '', '', '', '', '']);

      reportData.push(['', '', '', '', '', '', '', '', '', '']);

      reportData.push([
        'TÍTULO INFORME',
        'CÓDIGO REC',
        'N° REC',
        'RECOMENDACIÓN',
        'ENTE DE CONTROL',
        'MEMORANDO',
        'MEMO APROBACIÓN',
        'FECHA EMISIÓN',
        'FECHA MÁXIMA',
        'PLAZO (días)',
        'AUDITOR',
        'RESPONSABLES',
      ]);

      this.filteredReports.forEach(report => {
        const plazoAbs = Math.abs(report.plazo || 0);
        const plazoTexto = report.plazo < 0 ? `${plazoAbs} días vencidos` : `${plazoAbs} días vigentes`;
        const recNum = this.extractRecNumber(report);
        const recCode = this.getRecCode(report);

        reportData.push([
          report.tituloInforme,
          recCode,
          recNum !== 999 ? recNum : '',
          report.recomendacion,
          report.enteControl,
          report.memorando,
          report.memoAprobacion,
          report.fechaEmision,
          report.fechaMaxima,
          plazoTexto,
          report.auditor,
          report.responsables,
        ]);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(reportData);

      ws['!cols'] = [
        { wch: 50 },
        { wch: 15 },
        { wch: 10 },
        { wch: 50 },
        { wch: 50 },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
        { wch: 40 },
        { wch: 80 },
      ];

      ws['!rows'] = [
        { hpt: 30 },
      ];

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellRef]) continue;

          if (!ws[cellRef].s) ws[cellRef].s = {};

          if (R === 0) {
            ws[cellRef].s = {
              font: { bold: true, size: 14 },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
          }
          else if (R === 9) {
            ws[cellRef].s = {
              font: { bold: true },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              fill: { fgColor: { rgb: "CCCCCC" } }
            };
          }
          else {
            ws[cellRef].s = {
              alignment: { vertical: 'top', wrapText: true }
            };
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Departamento_Fechas_Vencidas');

      const fecha = new Date().toISOString().split('T')[0];
      const fileName = `reporte_departamento_fechas_vencidas_${fecha}.xlsx`;

      XLSX.writeFile(wb, fileName);

    } catch (error) {
      console.error('Error al exportar a Excel:', error);
    }
  }

  protected getResponsablesCount(responsables: string): number {
    if (!responsables || responsables.trim() === '') return 0;
    
    const upperResponsables = responsables.toUpperCase();
    
    let count = 0;
    
    if (upperResponsables.includes('(VERIFICABLE NO CREADO)')) {
      count += (upperResponsables.match(/\(VERIFICABLE NO CREADO\)/g) || []).length;
    }
    if (upperResponsables.includes('(PENDIENTE)')) {
      count += (upperResponsables.match(/\(PENDIENTE\)/g) || []).length;
    }
    if (upperResponsables.includes('(NO JUSTIFICA)')) {
      count += (upperResponsables.match(/\(NO JUSTIFICA\)/g) || []).length;
    }
    if (upperResponsables.includes('(JUSTIFICA)')) {
      count += (upperResponsables.match(/\(JUSTIFICA\)/g) || []).length;
    }
    
    return count > 0 ? count : 1;
  }

  protected openModalResponsables(arereCodigo: number): void {
    if (arereCodigo) {
      const departamento = this.auxiliarSrv.getUserInfo().departamento;
      this.modalResponsablesSrv.openModal({
        id_rec: arereCodigo,
        filterNoJustificados: true,
        departamento: departamento
      });
    }
  }

  protected activePopover: { title: string; text: string; x: number; y: number } | null = null;

  protected showPopover(event: MouseEvent, title: string, text: string): void {
    if (!text) return;
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const popoverWidth = 380;
    const popoverMaxHeight = 220;

    const spaceBelow = window.innerHeight - rect.bottom;
    let y: number;
    if (spaceBelow < popoverMaxHeight + 20) {
      y = Math.max(10, rect.top - popoverMaxHeight - 8);
    } else {
      y = rect.bottom + 6;
    }

    let x = rect.left;
    if (x + popoverWidth > window.innerWidth - 20) {
      x = Math.max(10, window.innerWidth - popoverWidth - 20);
    }

    this.activePopover = { title, text, x, y };
  }

  protected hidePopover(): void {
    this.activePopover = null;
  }
}

