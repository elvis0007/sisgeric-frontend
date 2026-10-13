import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportGeneralAIJ } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import * as XLSX from 'xlsx';

import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';

@Component({
  selector: 'app-table-report-general-aij',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-report-general-aij.component.html',
  styleUrl: './table-report-general-aij.component.css'
})
export class TableReportGeneralAijComponent implements OnInit {

  private readonly router = inject(Router);
  protected filterForm: FormGroup;
  protected reports: ReportGeneralAIJ[] = [];
  protected filteredReports: ReportGeneralAIJ[] = [];
  protected displayedReports: ReportGeneralAIJ[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;

  protected estadosSeguimiento: EstadoSeg[] = [];
  protected estadosVerificableDisponibles: string[] = [];
  protected organismos: OrganismoControl[] = [];
  protected auditores: UsuarioAuditor[] = [];
  protected departamentos: string[] = [];
  protected estadoRecDropdownOpen = false;
  protected estadoVerificableDropdownOpen = false;
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsAuditorGenService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    this.filterForm = this.formBuilder.group({
      startDate: [this.formatDate(firstDayOfYear)],
      endDate: [this.formatDate(today)],
      organismoControl: ['0'],
      estadoSeg: [[]],
      estadoVerificable: [[]],
      auditor: ['0'],
      departamento: ['0'],
      searchTerm: ['']
    });
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_general_aij');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarCombos();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_general_aij', val);
    });

    this.applyFilter();
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      organismoControl: '0',
      estadoSeg: [],
      estadoVerificable: [],
      auditor: '0',
      departamento: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.organismosSeleccionados = [];
    this.filterStateService.clearFilters('rep_general_aij');
    this.reloadReport();
  }

  protected organismosSeleccionados: number[] = [];

  toggleOrganismo(codigo: number | string): void {
    const numericCode = typeof codigo === 'string' ? parseInt(codigo, 10) : codigo;
    const idx = this.organismosSeleccionados.indexOf(numericCode);
    if (idx >= 0) {
      this.organismosSeleccionados.splice(idx, 1);
    } else {
      this.organismosSeleccionados.push(numericCode);
    }
    this.applySearchFilter();
  }

  toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.applySearchFilter();
  }

  getOrganismosSeleccionadosLabel(): string {
    if (!this.organismosSeleccionados || this.organismosSeleccionados.length === 0) {
      return 'Todos los Entes';
    }
    if (this.organismosSeleccionados.length === 1) {
      const org = this.organismos.find(o => Number(o.ainoc_codigo) === this.organismosSeleccionados[0]);
      return org ? org.ainoc_descripcion : '1 Ente Seleccionado';
    }
    return `${this.organismosSeleccionados.length} Entes Seleccionados`;
  }

  private cargarCombos(): void {
    this.reportsService.getEstadoSeg().subscribe({
      next: (response) => this.estadosSeguimiento = response.datos || [],
      error: () => this.alertsService.showAlert('Error al cargar estados de seguimiento', 'error')
    });

    this.reportsService.getOrganismos().subscribe({
      next: (response) => this.organismos = response.datos || [],
      error: () => this.alertsService.showAlert('Error al cargar organismos de control', 'error')
    });

    this.reportsService.getAuditores().subscribe({
      next: (response) => this.auditores = response.datos?.usuarios || [],
      error: () => this.alertsService.showAlert('Error al cargar auditores', 'error')
    });

    this.reportsService.getDepartamentos().subscribe({
      next: (response) => this.departamentos = response.datos || [],
      error: () => this.alertsService.showAlert('Error al cargar departamentos', 'error')
    });
  }

  private configureFormChanges(): void {
    this.startDateControl.valueChanges.subscribe(() => this.reloadReport());
    this.endDateControl.valueChanges.subscribe(() => this.reloadReport());
    this.organismoControlControl.valueChanges.subscribe(() => this.reloadReport());
    this.auditorControl.valueChanges.subscribe(() => this.reloadReport());
    this.departamentoControl.valueChanges.subscribe(() => this.reloadReport());

    this.estadoSegControl.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.applySearchFilter();
    });

    this.estadoVerificableControl.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.applySearchFilter();
    });

    this.searchTermControl.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.applySearchFilter();
    });
  }

  private reloadReport(): void {
    if (this.filterForm.valid) {
      this.currentPage = 1;
      this.applyFilter();
    }
  }

  protected toggleEstadoRecDropdown(): void {
    this.estadoRecDropdownOpen = !this.estadoRecDropdownOpen;
    if (this.estadoRecDropdownOpen) this.estadoVerificableDropdownOpen = false;
  }

  protected toggleEstadoVerificableDropdown(): void {
    this.estadoVerificableDropdownOpen = !this.estadoVerificableDropdownOpen;
    if (this.estadoVerificableDropdownOpen) this.estadoRecDropdownOpen = false;
  }

  protected closeDropdowns(): void {
    this.estadoRecDropdownOpen = false;
    this.estadoVerificableDropdownOpen = false;
  }

  protected applyFilter(): void {
    this.isLoading = true;
    const startDate = this.startDateControl.value;
    const endDate = this.endDateControl.value;
    const estadoSeg = 0;
    const auditor = this.auditorControl.value || '0';
    const dpto = this.departamentoControl.value || '0';

    this.reportsService.getReportGeneralAIJ(startDate, endDate, 0, estadoSeg, auditor, dpto)
      .subscribe({
        next: (response) => {
          this.reports = (response.datos || []).map((report) => ({
            ...report,
            diasVencidos: this.normalizeDiasVencidos(report.estadoPlazo, report.diasVencidos),
          }));
          this.estadosVerificableDisponibles = Array.from(
            new Set(
              this.reports
                .map(r => (r.estadoVerificable || '').trim())
                .filter(Boolean)
            )
          ).sort((a, b) => a.localeCompare(b));
          this.hasData = this.reports.length > 0;
          this.applySearchFilter();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al cargar el reporte general AIJ:', error);
          this.alertsService.showAlert('Error al cargar el reporte general', 'error');
          this.reports = [];
          this.filteredReports = [];
          this.displayedReports = [];
          this.hasData = false;
          this.isLoading = false;
        }
      });
  }

  private applySearchFilter(): void {
    const term = this.searchTermControl.value?.toLowerCase().trim() || '';
    const selectedEstadoSeg: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    const selectedEstadoVerificable: string[] = this.estadoVerificableControl.value || [];
    const estadoSegDesc = selectedEstadoSeg
      .map(code => this.estadosSeguimiento.find(e => Number(e.arees_codigo) === code)?.arees_descripcion || '')
      .filter(Boolean)
      .map(v => this.normalizeText(v));
    const estadoVerificableNormalized = selectedEstadoVerificable.map(v => this.normalizeText(v));

    if (!term) {
      this.filteredReports = [...this.reports];
    } else {
      this.filteredReports = this.reports.filter(r =>
        r.tituloInforme?.toLowerCase().includes(term) ||
        r.hallazgo?.toLowerCase().includes(term) ||
        r.conclusion?.toLowerCase().includes(term) ||
        r.recomendacion?.toLowerCase().includes(term) ||
        r.organismoControl?.toLowerCase().includes(term) ||
        r.memoAuditoria?.toLowerCase().includes(term) ||
        r.memoPresidencia?.toLowerCase().includes(term) ||
        r.responsable?.toLowerCase().includes(term) ||
        r.departamento?.toLowerCase().includes(term)
      );
    }

    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map((cod: number) => this.organismos.find(o => Number(o.ainoc_codigo) === cod)?.ainoc_descripcion || '')
        .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
        .map((desc: string) => this.normalizeText(desc));

      if (selectedDescs.length > 0) {
        this.filteredReports = this.filteredReports.filter(r =>
          selectedDescs.includes(this.normalizeText(r.organismoControl))
        );
      }
    }

    if (estadoSegDesc.length > 0) {
      this.filteredReports = this.filteredReports.filter(r =>
        estadoSegDesc.includes(this.normalizeText(r.estadoRecomendacion))
      );
    }

    if (estadoVerificableNormalized.length > 0) {
      this.filteredReports = this.filteredReports.filter(r =>
        estadoVerificableNormalized.includes(this.normalizeText(r.estadoVerificable))
      );
    }

    this.updateDisplayedReports();
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedReports();
  }

  protected onItemsPerPageChange(items: number): void {
    this.itemsPerPage = items;
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private updateDisplayedReports(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(start, end);
  }

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get organismoControlControl(): FormControl {
    return this.filterForm.get('organismoControl') as FormControl;
  }

  get estadoSegControl(): FormControl {
    return this.filterForm.get('estadoSeg') as FormControl;
  }

  get estadoVerificableControl(): FormControl {
    return this.filterForm.get('estadoVerificable') as FormControl;
  }

  protected get estadoRecSeleccionadosTexto(): string {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    if (selected.length === 0) return 'Todos los estados';

    const labels = selected
      .map(code => this.estadosSeguimiento.find(e => Number(e.arees_codigo) === code)?.arees_descripcion)
      .filter(Boolean) as string[];

    return labels.length === this.estadosSeguimiento.length
      ? 'Todos los estados'
      : labels.join(', ');
  }

  protected get estadoVerificableSeleccionadosTexto(): string {
    const selected: string[] = this.estadoVerificableControl.value || [];
    if (selected.length === 0) return 'Todos los estados';
    return selected.length === this.estadosVerificableDisponibles.length
      ? 'Todos los estados'
      : selected.join(', ');
  }

  protected isEstadoRecSeleccionado(codigo: number): boolean {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    return selected.includes(Number(codigo));
  }

  protected isEstadoVerificableSeleccionado(estado: string): boolean {
    const selected: string[] = this.estadoVerificableControl.value || [];
    return selected.includes(estado);
  }

  protected toggleEstadoRec(codigo: number): void {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    const target = Number(codigo);
    const updated = selected.includes(target)
      ? selected.filter(v => v !== target)
      : [...selected, target];
    this.estadoSegControl.setValue(updated);
  }

  protected toggleEstadoVerificable(estado: string): void {
    const selected: string[] = this.estadoVerificableControl.value || [];
    const updated = selected.includes(estado)
      ? selected.filter(v => v !== estado)
      : [...selected, estado];
    this.estadoVerificableControl.setValue(updated);
  }

  protected areAllEstadoRecSelected(): boolean {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    return this.estadosSeguimiento.length > 0 && selected.length === this.estadosSeguimiento.length;
  }

  protected areAllEstadoVerificableSelected(): boolean {
    const selected: string[] = this.estadoVerificableControl.value || [];
    return this.estadosVerificableDisponibles.length > 0 && selected.length === this.estadosVerificableDisponibles.length;
  }

  protected toggleSelectAllEstadoRec(): void {
    if (this.areAllEstadoRecSelected()) {
      this.estadoSegControl.setValue([]);
      return;
    }
    this.estadoSegControl.setValue(this.estadosSeguimiento.map(e => Number(e.arees_codigo)));
  }

  protected toggleSelectAllEstadoVerificable(): void {
    if (this.areAllEstadoVerificableSelected()) {
      this.estadoVerificableControl.setValue([]);
      return;
    }
    this.estadoVerificableControl.setValue([...this.estadosVerificableDisponibles]);
  }

  get auditorControl(): FormControl {
    return this.filterForm.get('auditor') as FormControl;
  }

  get departamentoControl(): FormControl {
    return this.filterForm.get('departamento') as FormControl;
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  public isVencido(report: any): boolean {
    const st = (report?.estadoPlazo || '').toUpperCase();
    return st.includes('VENCID');
  }

  public isEnPlazo(report: any): boolean {
    const st = (report?.estadoPlazo || '').toUpperCase();
    return st.includes('PLAZO') || st.includes('TIEMPO') || st === 'EN PROCESO';
  }

  public isCumplidaOrNoAplica(report: any): boolean {
    const st = (report?.estadoPlazo || report?.estadoRecomendacion || '').toUpperCase();
    return st.includes('CUMPLID') || st.includes('NO APLICA');
  }

  private normalizeDiasVencidos(estadoPlazo: string | null | undefined, diasVencidos: number | null | undefined): number {
    return typeof diasVencidos === 'number' ? Math.abs(diasVencidos) : 0;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  protected exportToExcel(): void {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      const selectedEstadoSeg: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
      const selectedEstadoSegDesc = selectedEstadoSeg
        .map(code => this.estadosSeguimiento.find(e => Number(e.arees_codigo) === code)?.arees_descripcion)
        .filter(Boolean) as string[];
      const estadoRecomendacionFiltro = selectedEstadoSegDesc.length > 0
        ? selectedEstadoSegDesc.join(', ')
        : 'Todos';

      const selectedEstadoVerificable: string[] = this.estadoVerificableControl.value || [];
      const estadoVerificableFiltro = selectedEstadoVerificable.length > 0
        ? selectedEstadoVerificable.join(', ')
        : 'Todos';

      const searchTermFiltro = (this.searchTermControl.value || '').trim() || 'N/A';

      const headerData = [
        ['REPORTE GENERAL'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.startDateControl.value],
        ['Fecha Hasta:', this.endDateControl.value],
        ['Ente de control:', this.getOrganismosSeleccionadosLabel()],
        ['Estado recomendación:', estadoRecomendacionFiltro],
        ['Estado verificable:', estadoVerificableFiltro],
        ['Auditor:', this.auditorControl.value === '0' ? 'Todos' : this.auditorControl.value],
        ['Departamento:', this.departamentoControl.value === '0' ? 'Todos' : this.departamentoControl.value],
        ['Búsqueda:', searchTermFiltro],
        ['Fecha de generación:', new Date().toLocaleDateString('es-ES')],
        [''],
        [''],
      ];

      const dataToExport = this.filteredReports.map(r => ({
        'Código Informe': r.codigoInforme,
        'Memorando Auditoría': r.memoAuditoria,
        'Fecha Memorando': r.fechaMemorando,
        'Memo Presidencia': r.memoPresidencia,
        'Fecha Aprobación': r.fechaAprobacion,
        'Auditor': r.auditor,
        'Fecha Creación Informe': r.fechaCreacionInforme,
        'Título Informe': r.tituloInforme,
        'Organismo de Control': r.organismoControl,
        'Hallazgo': r.hallazgo,
        'Conclusión': r.conclusion,
        'Código Recomendación': r.codigoRecomendacion,
        'Recomendación': r.recomendacion,
        'Fecha Vencimiento': r.fechaVencimiento,
        'Estado Recomendación': r.estadoRecomendacion,
        'Estado Plazo': r.estadoPlazo,
        'Días Vigentes / Restantes': this.isEnPlazo(r) ? Math.abs(r.diasVencidos || 0) : 0,
        'Días Vencidos': this.isVencido(r) ? Math.abs(r.diasVencidos || 0) : 0,
        'Progreso Recomendación %': r.progresoRecomendacion,
        'Fecha Carga Verificable': r.fechaCargaVerificable,
        'Responsable': r.responsable,
        'Estado Verificable': r.estadoVerificable,
        'Departamento': r.departamento,
        'Descripción Verificable Responsable': r.descripcionVerificableResponsable,
        'Observación Auditor': r.observacionAuditor,
        'Progreso Informe %': r.progresoInforme,
        'Fecha Consulta': r.fechaConsulta,
      }));

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);
      const worksheet = Object.assign({}, worksheetHeader);
      const headerRowCount = headerData.length;

      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });

      worksheet['!cols'] = [
        { wch: 12 },  // Código Informe
        { wch: 18 },  // Memorando Auditoría
        { wch: 14 },  // Fecha Memorando
        { wch: 18 },  // Memo Presidencia
        { wch: 14 },  // Fecha Aprobación
        { wch: 18 },  // Auditor
        { wch: 18 },  // Fecha Creación Informe
        { wch: 40 },  // Título Informe
        { wch: 24 },  // Organismo de Control
        { wch: 40 },  // Hallazgo
        { wch: 40 },  // Conclusión
        { wch: 16 },  // Código Recomendación
        { wch: 40 },  // Recomendación
        { wch: 16 },  // Fecha Vencimiento
        { wch: 24 },  // Estado Recomendación
        { wch: 16 },  // Estado Plazo
        { wch: 16 },  // Días Vencidos
        { wch: 20 },  // Progreso Recomendación %
        { wch: 20 },  // Fecha Carga Verificable
        { wch: 24 },  // Responsable
        { wch: 24 },  // Estado Verificable
        { wch: 24 },  // Departamento
        { wch: 40 },  // Descripción Verificable Responsable
        { wch: 40 },  // Observación Auditor
        { wch: 20 },  // Progreso Informe %
        { wch: 18 },  // Fecha Consulta
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_General_AIJ');

      const today = new Date();
      const fileName = `reporte_general_aij_${today.getFullYear()}${(today.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;

      XLSX.writeFile(workbook, fileName, {
        bookType: 'xlsx',
        type: 'binary',
        cellStyles: true,
        compression: true,
      });

      this.alertsService.showAlert('Archivo exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      this.alertsService.showAlert('Error al exportar los datos', 'error');
    }
  }

  public irARecomendacion(r: ReportGeneralAIJ, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    // Determinar año para el filtro a partir de aprobación, memorando o fecha máxima
    let anio: number | undefined;
    if (r.fechaAprobacion) {
      const match = r.fechaAprobacion.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) anio = parseInt(match[1], 10);
    }
    if (!anio && r.memoAuditoria) {
      const match = r.memoAuditoria.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) anio = parseInt(match[1], 10);
    }
    if (!anio && r.fechaMemorando) {
      const match = r.fechaMemorando.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) anio = parseInt(match[1], 10);
    }
    if (!anio && r.fechaVencimiento) {
      const match = r.fechaVencimiento.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) anio = parseInt(match[1], 10);
    }

    const queryParams: Record<string, any> = {
      fromReport: 'true',
    };

    if (r.codigoRecomendacion) {
      queryParams['arere'] = r.codigoRecomendacion;
    }
    if (r.codigoInforme) {
      queryParams['ainin'] = r.codigoInforme;
    }
    if (r.memoAuditoria) {
      queryParams['memo'] = r.memoAuditoria.trim();
    }
    if (r.numeroRecomendacion) {
      queryParams['recNum'] = r.numeroRecomendacion;
    }
    if (anio) {
      queryParams['anio'] = anio;
    }

    this.router.navigate(['/inicio/recomendaciones'], { queryParams });
  }
}

