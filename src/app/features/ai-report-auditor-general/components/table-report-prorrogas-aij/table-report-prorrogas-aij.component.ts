import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReporteProrrogasAIJ } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-report-prorrogas-aij',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-report-prorrogas-aij.component.html',
  styleUrl: './table-report-prorrogas-aij.component.css'
})
export class TableReportProrrogasAijComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: ReporteProrrogasAIJ[] = [];
  protected filteredReports: ReporteProrrogasAIJ[] = [];
  protected displayedReports: ReporteProrrogasAIJ[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;
  protected maxProrrogasCount = 3;

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
    const savedFilters = this.filterStateService.getFilters('rep_prorrogas');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarCombos();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_prorrogas', val);
    });

    this.cargarReporteProrrogas();
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
    this.filterStateService.clearFilters('rep_prorrogas');
    this.onFilterChange();
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
    this.startDateControl.valueChanges.subscribe(() => this.onFilterChange());
    this.endDateControl.valueChanges.subscribe(() => this.onFilterChange());
    this.organismoControlControl.valueChanges.subscribe(() => this.onFilterChange());
    this.auditorControl.valueChanges.subscribe(() => this.onFilterChange());
    this.departamentoControl.valueChanges.subscribe(() => this.onFilterChange());

    this.estadoSegControl.valueChanges.subscribe(() => this.onFilterChange());
    this.estadoVerificableControl.valueChanges.subscribe(() => this.onFilterChange());
    this.searchTermControl.valueChanges.subscribe(() => this.onFilterChange());
  }

  private onFilterChange(): void {
    this.currentPage = 1;
    this.applySearchFilter();
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

  private parseToYYYYMMDD(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const dateOnly = dateStr.trim().split(' ')[0];
    if (dateOnly.includes('/')) {
      const parts = dateOnly.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return dateOnly;
  }

  protected cargarReporteProrrogas(): void {
    this.isLoading = true;
    this.reportsService.getReportProrrogasAIJ().subscribe({
      next: (response: any) => {
        const rawData = response?.datos;
        this.reports = (Array.isArray(rawData) ? rawData : rawData?.datos) || [];
        
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
        console.error('Error al cargar el reporte de prórrogas:', error);
        this.alertsService.showAlert('Error al cargar el reporte de prórrogas', 'error');
        this.reports = [];
        this.filteredReports = [];
        this.displayedReports = [];
        this.hasData = false;
        this.isLoading = false;
      }
    });
  }

  protected applySearchFilter(): void {
    let tempReports = [...this.reports];

    const startDate = this.startDateControl.value;
    const endDate = this.endDateControl.value;
    if (startDate && endDate) {
      tempReports = tempReports.filter(r => {
        if (!r.fechaMaxima) return false;
        const formattedDate = this.parseToYYYYMMDD(r.fechaMaxima);
        return formattedDate >= startDate && formattedDate <= endDate;
      });
    }

    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map((cod: number) => this.organismos.find(o => Number(o.ainoc_codigo) === cod)?.ainoc_descripcion || '')
        .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
        .map((desc: string) => this.normalizeText(desc));

      if (selectedDescs.length > 0) {
        tempReports = tempReports.filter(r =>
          selectedDescs.includes(this.normalizeText(r.organismoControl))
        );
      }
    }

    const selectedAuditorCuenta = this.auditorControl.value || '0';
    if (selectedAuditorCuenta !== '0') {
      const selectedAuditor = this.auditores.find(a => a.dsgus_cuenta === selectedAuditorCuenta);
      if (selectedAuditor) {
        const auditorNameNormalized = this.normalizeText(selectedAuditor.nombre_completo);
        tempReports = tempReports.filter(r => 
          this.normalizeText(r.auditor) === auditorNameNormalized
        );
      }
    }

    const selectedDpto = this.departamentoControl.value || '0';
    if (selectedDpto !== '0') {
      const dptoNormalized = this.normalizeText(selectedDpto);
      tempReports = tempReports.filter(r => 
        this.normalizeText(r.departamento) === dptoNormalized
      );
    }

    const selectedEstadoSeg: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    if (selectedEstadoSeg.length > 0) {
      const estadoSegDescList = selectedEstadoSeg
        .map(code => this.estadosSeguimiento.find(e => Number(e.arees_codigo) === code)?.arees_descripcion || '')
        .filter(Boolean)
        .map(v => this.normalizeText(v));

      tempReports = tempReports.filter(r => 
        estadoSegDescList.includes(this.normalizeText(r.estadoRecomendacion))
      );
    }

    const selectedEstadoVerificable: string[] = this.estadoVerificableControl.value || [];
    if (selectedEstadoVerificable.length > 0) {
      const estadoVerificableNormalized = selectedEstadoVerificable.map(v => this.normalizeText(v));
      tempReports = tempReports.filter(r => 
        estadoVerificableNormalized.includes(this.normalizeText(r.estadoVerificable))
      );
    }

    const term = this.searchTermControl.value?.toLowerCase().trim() || '';
    if (term) {
      tempReports = tempReports.filter(r =>
        r.numeroRecomendacion?.toLowerCase().includes(term) ||
        r.descripcionRecomendacion?.toLowerCase().includes(term) ||
        r.responsable?.toLowerCase().includes(term) ||
        r.departamento?.toLowerCase().includes(term) ||
        r.auditor?.toLowerCase().includes(term) ||
        r.tituloInforme?.toLowerCase().includes(term) ||
        r.organismoControl?.toLowerCase().includes(term) ||
        r.memoPresidencia?.toLowerCase().includes(term) ||
        r.memoAuditoria?.toLowerCase().includes(term)
      );
    }

    this.filteredReports = tempReports;

    const counts = this.filteredReports.map(r => r.prorrogas?.length || 0);
    this.maxProrrogasCount = counts.length > 0 ? Math.max(...counts, 3) : 3;

    this.updateDisplayedReports();
  }

  private updateDisplayedReports(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(start, end);
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

  // Helpers de cálculos basados en reglas de negocio
  protected getEstadoPlazo(report: ReporteProrrogasAIJ): string {
    return report.estadoPlazo || 'N/A';
  }

  protected getDiasVencidos(report: ReporteProrrogasAIJ): number {
    return report.diasVencidos || 0;
  }

  protected getFechaInicialVencimiento(report: ReporteProrrogasAIJ): string {
    if (report.prorrogas && report.prorrogas.length > 0) {
      return report.prorrogas[0].fechaAnterior;
    }
    return report.fechaMaxima;
  }

  // Getters para controles de formulario
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

  get auditorControl(): FormControl {
    return this.filterForm.get('auditor') as FormControl;
  }

  get departamentoControl(): FormControl {
    return this.filterForm.get('departamento') as FormControl;
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  // Métodos de formato
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  protected formatDateToDisplay(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // Lógica multiselect de Estado Recomendación
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

  protected isEstadoRecSeleccionado(codigo: number): boolean {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    return selected.includes(Number(codigo));
  }

  protected toggleEstadoRec(codigo: number): void {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    const target = Number(codigo);
    const updated = selected.includes(target)
      ? selected.filter(v => v !== target)
      : [...selected, target];
    this.estadoSegControl.setValue(updated);
  }

  protected areAllEstadoRecSelected(): boolean {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    return this.estadosSeguimiento.length > 0 && selected.length === this.estadosSeguimiento.length;
  }

  protected toggleSelectAllEstadoRec(): void {
    if (this.areAllEstadoRecSelected()) {
      this.estadoSegControl.setValue([]);
      return;
    }
    this.estadoSegControl.setValue(this.estadosSeguimiento.map(e => Number(e.arees_codigo)));
  }

  // Lógica multiselect de Estado Verificable
  protected get estadoVerificableSeleccionadosTexto(): string {
    const selected: string[] = this.estadoVerificableControl.value || [];
    if (selected.length === 0) return 'Todos los estados';
    return selected.length === this.estadosVerificableDisponibles.length
      ? 'Todos los estados'
      : selected.join(', ');
  }

  protected isEstadoVerificableSeleccionado(estado: string): boolean {
    const selected: string[] = this.estadoVerificableControl.value || [];
    return selected.includes(estado);
  }

  protected toggleEstadoVerificable(estado: string): void {
    const selected: string[] = this.estadoVerificableControl.value || [];
    const updated = selected.includes(estado)
      ? selected.filter(v => v !== estado)
      : [...selected, estado];
    this.estadoVerificableControl.setValue(updated);
  }

  protected areAllEstadoVerificableSelected(): boolean {
    const selected: string[] = this.estadoVerificableControl.value || [];
    return this.estadosVerificableDisponibles.length > 0 && selected.length === this.estadosVerificableDisponibles.length;
  }

  protected toggleSelectAllEstadoVerificable(): void {
    if (this.areAllEstadoVerificableSelected()) {
      this.estadoVerificableControl.setValue([]);
      return;
    }
    this.estadoVerificableControl.setValue([...this.estadosVerificableDisponibles]);
  }

  // Exportar Excel Completo
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
        ['REPORTE DE RECOMENDACIONES CON PRÓRROGAS SOLICITADAS (AUDITOR INTERNO JEFE)'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
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

      // Generar registros del excel siguiendo el orden de la lista completa del usuario (List 1)
      const dataToExport = this.filteredReports.map(r => {
        const row: any = {
          'Memorando Auditoría': r.memoAuditoria || '',
          'Fecha Memorando': this.formatDateToDisplay(r.fechaMemorando) || '',
          'Memo Presidencia': r.memoPresidencia || '',
          'Fecha Aprobación': this.formatDateToDisplay(r.fechaAprobacion) || '',
          'Auditor': r.auditor || '',
          'Título Informe': r.tituloInforme || '',
          'Organismo de Control': r.organismoControl || '',
          'Recomendación': r.descripcionRecomendacion || '',
          'Estado Recomendación': r.estadoRecomendacion || '',
          'Estado Verificable': r.estadoVerificable || '',
          'Días Vencidos': this.getDiasVencidos(r),
          'Responsable': r.responsable || '',
          'Departamento': r.departamento || '',
          'Fecha Inicial Vencimiento': this.formatDateToDisplay(this.getFechaInicialVencimiento(r)),
          'No. Prórrogas': r.totalProrrogas || 0,
        };

        // Agregar columnas dinámicas de prórrogas
        for (let i = 0; i < this.maxProrrogasCount; i++) {
          const prorroga = r.prorrogas?.[i];
          row[`Fecha Prórroga ${i + 1}`] = prorroga ? this.formatDateToDisplay(prorroga.nuevaFecha) : '';
        }

        return row;
      });

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);
      const worksheet = Object.assign({}, worksheetHeader);
      const headerRowCount = headerData.length;

      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });

      const cols = [
        { wch: 20 },  // Memorando Auditoría
        { wch: 15 },  // Fecha Memorando
        { wch: 20 },  // Memo Presidencia
        { wch: 15 },  // Fecha Aprobación
        { wch: 25 },  // Auditor
        { wch: 45 },  // Título Informe
        { wch: 25 },  // Organismo de Control
        { wch: 55 },  // Recomendación
        { wch: 25 },  // Estado Recomendación
        { wch: 25 },  // Estado Verificable
        { wch: 15 },  // Días Vencidos
        { wch: 30 },  // Responsable
        { wch: 30 },  // Departamento
        { wch: 22 },  // Fecha Inicial Vencimiento
        { wch: 15 },  // No. Prórrogas
      ];

      for (let i = 0; i < this.maxProrrogasCount; i++) {
        cols.push({ wch: 20 }); // Fecha Prórroga i
      }

      worksheet['!cols'] = cols;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Prorrogas');

      const today = new Date();
      const fileName = `reporte_prorrogas_aij_${today.getFullYear()}${(today.getMonth() + 1)
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
}
