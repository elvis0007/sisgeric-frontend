import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReporteProrrogasRealizadasAIJ } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-report-prorrogas-realizadas-aij',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-report-prorrogas-realizadas-aij.component.html',
  styleUrl: './table-report-prorrogas-realizadas-aij.component.css'
})
export class TableReportProrrogasRealizadasAijComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: ReporteProrrogasRealizadasAIJ[] = [];
  protected filteredReports: ReporteProrrogasRealizadasAIJ[] = [];
  protected displayedReports: ReporteProrrogasRealizadasAIJ[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;

  protected estadosSeguimiento: EstadoSeg[] = [];
  protected estadosVerificableDisponibles: string[] = [];
  protected auditores: UsuarioAuditor[] = [];

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
      estadoSeg: [[]],
      estadoVerificable: [[]],
      usuario: ['0'],
      searchTerm: ['']
    });
  }

  ngOnInit(): void {
    this.cargarCombos();

    const savedFilters = this.filterStateService.getFilters('rep_prorrogas_realizadas');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_prorrogas_realizadas', val);
    });

    this.cargarReporteProrrogasRealizadas();
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      estadoSeg: [],
      estadoVerificable: [],
      usuario: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_prorrogas_realizadas');
    this.onFilterChange();
  }

  private cargarCombos(): void {
    this.reportsService.getEstadoSeg().subscribe({
      next: (response) => this.estadosSeguimiento = response.datos || [],
      error: () => this.alertsService.showAlert('Error al cargar estados de seguimiento', 'error')
    });

    this.reportsService.getAuditores().subscribe({
      next: (response) => this.auditores = response.datos?.usuarios || [],
      error: () => this.alertsService.showAlert('Error al cargar auditores', 'error')
    });
  }

  private configureFormChanges(): void {
    this.startDateControl.valueChanges.subscribe(() => this.onFilterChange());
    this.endDateControl.valueChanges.subscribe(() => this.onFilterChange());
    this.usuarioControl.valueChanges.subscribe(() => this.onFilterChange());
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

  protected cargarReporteProrrogasRealizadas(): void {
    this.isLoading = true;
    this.reportsService.getReportProrrogasRealizadas().subscribe({
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
        console.error('Error al cargar el reporte de prórrogas realizadas:', error);
        this.alertsService.showAlert('Error al cargar el reporte de prórrogas realizadas', 'error');
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

    // 1. Filtrar por rango de fechas del cambio
    const startDate = this.startDateControl.value;
    const endDate = this.endDateControl.value;
    if (startDate && endDate) {
      tempReports = tempReports.filter(r => {
        if (!r.fechaCambio) return false;
        const formattedDate = this.parseToYYYYMMDD(r.fechaCambio);
        return formattedDate >= startDate && formattedDate <= endDate;
      });
    }

    // 2. Filtrar por usuario realizador del cambio
    const selectedUsuario = this.usuarioControl.value || '0';
    if (selectedUsuario !== '0') {
      tempReports = tempReports.filter(r => 
        r.realizadoPor?.toLowerCase().trim() === selectedUsuario.toLowerCase().trim()
      );
    }

    // 3. Filtrar por Estado Recomendación
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

    // 4. Filtrar por Estado Verificable
    const selectedEstadoVerificable: string[] = this.estadoVerificableControl.value || [];
    if (selectedEstadoVerificable.length > 0) {
      const estadoVerificableNormalized = selectedEstadoVerificable.map(v => this.normalizeText(v));
      tempReports = tempReports.filter(r => 
        estadoVerificableNormalized.includes(this.normalizeText(r.estadoVerificable))
      );
    }

    // 5. Filtrar por palabra clave (Búsqueda global)
    const term = this.searchTermControl.value?.toLowerCase().trim() || '';
    if (term) {
      tempReports = tempReports.filter(r =>
        r.tituloInforme?.toLowerCase().includes(term) ||
        r.numeroRecomendacion?.toString().includes(term) ||
        r.descripcionRecomendacion?.toLowerCase().includes(term) ||
        r.realizadoPor?.toLowerCase().includes(term) ||
        r.responsable?.toLowerCase().includes(term) ||
        r.estadoRecomendacion?.toLowerCase().includes(term) ||
        r.estadoVerificable?.toLowerCase().includes(term)
      );
    }

    this.filteredReports = tempReports;
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

  // Getters para controles de formulario
  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get estadoSegControl(): FormControl {
    return this.filterForm.get('estadoSeg') as FormControl;
  }

  get estadoVerificableControl(): FormControl {
    return this.filterForm.get('estadoVerificable') as FormControl;
  }

  get usuarioControl(): FormControl {
    return this.filterForm.get('usuario') as FormControl;
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

  protected formatDateTimeToDisplay(dateTimeStr: string | null | undefined): string {
    if (!dateTimeStr) return '';
    const parts = dateTimeStr.split(' ');
    if (parts.length === 2) {
      const datePart = this.formatDateToDisplay(parts[0]);
      return `${datePart} ${parts[1]}`;
    }
    return this.formatDateToDisplay(dateTimeStr);
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

  // Exportar Excel
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
        ['REPORTE DE PRÓRROGAS REALIZADAS (CAMBIOS MANUALES DE FECHA DE VENCIMIENTO)'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Estado recomendación:', estadoRecomendacionFiltro],
        ['Estado verificable:', estadoVerificableFiltro],
        ['Auditor:', this.usuarioControl.value === '0' ? 'Todos' : this.usuarioControl.value],
        ['Búsqueda:', searchTermFiltro],
        ['Fecha de generación:', new Date().toLocaleDateString('es-ES')],
        [''],
        [''],
      ];

      const dataToExport = this.filteredReports.map(r => ({
        'Título de Informe': r.tituloInforme || '',
        'Recomendación Nro.': r.numeroRecomendacion || 0,
        'Descripción Recomendación': r.descripcionRecomendacion || '',
        'Estado Recomendación': r.estadoRecomendacion || '',
        'Estado Verificable': r.estadoVerificable || '',
        'Responsable': r.responsable || '',
        'Realizado por': r.realizadoPor || '',
        'Fecha del Cambio': this.formatDateTimeToDisplay(r.fechaCambio) || '',
        'Fecha Cumplimiento Anterior': this.formatDateToDisplay(r.fechaAnterior) || '',
        'Fecha Cumplimiento Cambiada': this.formatDateToDisplay(r.fechaCambiada) || '',
       
      }));

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);
      const worksheet = Object.assign({}, worksheetHeader);
      const headerRowCount = headerData.length;

      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });

      worksheet['!cols'] = [
        { wch: 45 },  // Título de Informe
        { wch: 20 },  // Recomendación Nro.
        { wch: 55 },  // Descripción Recomendación
        { wch: 25 },  // Estado Recomendación
        { wch: 25 },  // Estado Verificable
        { wch: 30 },  // Responsable
        { wch: 25 },  // Realizado por
        { wch: 22 },  // Fecha del Cambio
        { wch: 15 },  // Fecha Cambiada
        { wch: 15 },  // Fecha Anterior
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Prorrogas_Realizadas');

      const today = new Date();
      const fileName = `reporte_prorrogas_realizadas_${today.getFullYear()}${(today.getMonth() + 1)
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
