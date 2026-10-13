import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportRecomendacionesVencidasAIJ } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { inject } from '@angular/core';
import * as XLSX from 'xlsx';

import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';

@Component({
  selector: 'app-table-recomendaciones-vencidas-aij',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, AbsPipe, ReportLoadingComponent],
  templateUrl: './table-recomendaciones-vencidas-aij.component.html',
  styleUrl: './table-recomendaciones-vencidas-aij.component.css'
})
export class TableRecomendacionesVencidasAijComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: ReportRecomendacionesVencidasAIJ[] = [];
  protected displayedReports: ReportRecomendacionesVencidasAIJ[] = [];
  protected filteredReports: ReportRecomendacionesVencidasAIJ[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  protected organismos: OrganismoControl[] = [];
  private originalOrder: ReportRecomendacionesVencidasAIJ[] = [];

  private readonly modalResponsablesSrv: ModalResponsablesService = inject(ModalResponsablesService);
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsAuditorGenService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        searchTerm: [''],
        tipoPlazo: ['TODAS'], // TODAS | VENCIDAS | EN_PROCESO
        organismoControl: ['0']
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_recom_vencidas_aij');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.reportsService.getOrganismos().subscribe({
      next: (res) => {
        this.organismos = res.datos || [];
      },
      error: (err) => console.error('Error al cargar organismos:', err)
    });

    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_recom_vencidas_aij', val);
    });

    this.applyFilter();
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      searchTerm: '',
      tipoPlazo: 'TODAS',
      organismoControl: '0'
    }, { emitEvent: false });

    this.organismosSeleccionados = [];
    this.filterStateService.clearFilters('rep_recom_vencidas_aij');
    this.resetPaginationAndApplyFilter();
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

  private configureFormChanges(): void {
    this.startDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.searchTermControl.valueChanges.subscribe(() => {
      this.applySearchFilter();
    });

    this.tipoPlazoControl.valueChanges.subscribe(() => {
      this.applySearchFilter();
    });

    this.organismoControlControl.valueChanges.subscribe(() => {
      this.applySearchFilter();
    });
  }

  private resetPaginationAndApplyFilter(): void {
    this.currentPage = 1;
    this.reports = [];
    this.filteredReports = [];
    this.displayedReports = [];
    this.hasData = false;
    this.applyFilter();
  }

  protected applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      
      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      const estadoSeg = 0; // Siempre traer todos los estados
      
      this.reportsService.getReportRecomendacionesVencidasAIJ(startDate, endDate, estadoSeg)
        .subscribe({
          next: (response) => {
            this.reports = response.datos || [];
            this.hasData = this.reports.length > 0;
            
            this.originalOrder = [...this.reports];
            this.aplicarOrdenamiento();
            
            this.currentPage = 1;
            this.applySearchFilter();
            this.isLoading = false;
          },
          error: (error: any) => {
            console.error('Error al cargar los reportes:', error);
            this.alertsService.showAlert('Error al cargar los reportes', 'error');
            this.reports = [];
            this.filteredReports = [];
            this.displayedReports = [];
            this.hasData = false;
            this.isLoading = false;
          }
        });
    }
  }

  private aplicarOrdenamiento(): void {
    if (!this.reports || this.reports.length === 0) return;

    const parseDate = (dateStr: string): number => {
      if (!dateStr) return 0;
      // Formato esperado: DD/MM/YYYY
      const parts = dateStr.split('/');
      if (parts.length !== 3) return 0;
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Los meses en JS son 0-indexed
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.getTime();
    };

    if (this.ordenFecha === 'asc') {
      this.reports.sort((a, b) => {
        const fechaA = parseDate(a.fechaEmision);
        const fechaB = parseDate(b.fechaEmision);
        return fechaA - fechaB;
      });
    } else {
      this.reports.sort((a, b) => {
        const fechaA = parseDate(a.fechaEmision);
        const fechaB = parseDate(b.fechaEmision);
        return fechaB - fechaA;
      });
    }
  }

  private applySearchFilter(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase().trim() || '';
    const tipoPlazo = this.tipoPlazoControl.value || 'TODAS';
    
    let base = [...this.reports];

    // Filtro por estado de plazo (vencidas / en proceso / todas)
    if (tipoPlazo === 'VENCIDAS') {
      base = base.filter(report => report.plazo < 0);
    } else if (tipoPlazo === 'EN_PROCESO') {
      base = base.filter(report => report.plazo >= 0);
    }

    // Multi-selección de Ente de Control
    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map(cod => this.organismos.find(o => Number(o.ainoc_codigo) === cod)?.ainoc_descripcion)
        .filter(desc => desc)
        .map(desc => this.normalizeText(desc!));

      if (selectedDescs.length > 0) {
        base = base.filter(r => selectedDescs.includes(this.normalizeText(r.organismoControl)));
      }
    }

    // Filtro por texto
    if (!searchTerm) {
      this.filteredReports = base;
    } else {
      const normalizedSearch = this.normalizeText(searchTerm);
      this.filteredReports = base.filter(report => 
        this.normalizeText(report.tituloInforme).includes(normalizedSearch) ||
        this.normalizeText(report.recomendacion).includes(normalizedSearch) ||
        this.normalizeText(report.organismoControl).includes(normalizedSearch) ||
        this.normalizeText(report.memorando).includes(normalizedSearch) ||
        this.normalizeText(report.memoAprobacion).includes(normalizedSearch) ||
        this.normalizeText(report.auditor).includes(normalizedSearch) ||
        this.normalizeText(report.responsables).includes(normalizedSearch)
      );
    }
    
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private updateDisplayedReports(): void {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.displayedReports = [];
      return;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(startIndex, endIndex);
  }

  protected onPageChange(page: number): void {
    if (page >= 1 && page <= Math.ceil(this.filteredReports.length / this.itemsPerPage)) {
      this.currentPage = page;
      this.updateDisplayedReports();
    }
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    if (itemsPerPage > 0) {
      this.itemsPerPage = itemsPerPage;
      this.currentPage = 1;
      this.updateDisplayedReports();
    }
  }

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  get tipoPlazoControl(): FormControl {
    return this.filterForm.get('tipoPlazo') as FormControl;
  }

  get organismoControlControl(): FormControl {
    return this.filterForm.get('organismoControl') as FormControl;
  }

  private normalizeText(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private dateRangeValidator(group: FormGroup) {
    const startDate = group.get('startDate')?.value;
    const endDate = group.get('endDate')?.value;
    return startDate && endDate && startDate <= endDate
      ? null
      : { dateRangeInvalid: true };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  protected formatDateToDisplay(dateStr: string): string {
    if (!dateStr) return '';
    
    if (dateStr.includes('/')) {
      return dateStr;
    }
    
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    
    return dateStr;
  }

  protected exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      const headerData = [
        ['REPORTE DE RECOMENDACIONES (VENCIDAS / EN PROCESO)'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Estado Plazo:', this.tipoPlazoControl.value === 'TODAS' ? 'Todas' : (this.tipoPlazoControl.value === 'VENCIDAS' ? 'Vencidas' : 'En Proceso')],
        ['Ente de Control:', this.getOrganismosSeleccionadosLabel()],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']
      ];

      const dataToExport = this.filteredReports.map(report => {
        const plazoAbs = Math.abs(report.plazo || 0);
        const plazoTexto = report.plazo < 0 ? `${plazoAbs} días vencidos` : `${plazoAbs} días vigentes`;
        return {
          'Título Informe': report.tituloInforme,
          'Recomendación': report.recomendacion,
          'Ente de Control': report.organismoControl,
          'Memorando': report.memorando,
          'Memo Aprobación': report.memoAprobacion,
          'Fecha Emisión': this.formatDateToDisplay(report.fechaEmision),
          'Fecha Máxima': this.formatDateToDisplay(report.fechaMaxima),
          'Plazo': plazoTexto,
          'Auditor': report.auditor || '',
          'Responsables': report.responsables || ''
        };
      });

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);
      
      const worksheet = Object.assign({}, worksheetHeader);
      
      const headerRowCount = headerData.length;
      
      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });
      
      worksheet['!cols'] = [
        { wch: 50 }, // Título Informe
        { wch: 50 }, // Recomendación
        { wch: 20 }, // Ente de Control
        { wch: 15 }, // Memorando
        { wch: 15 }, // Memo Aprobación
        { wch: 15 }, // Fecha Emisión
        { wch: 15 }, // Fecha Máxima
        { wch: 20 }, // Plazo
        { wch: 30 }, // Auditor
        { wch: 80 }  // Responsables
      ];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Recomendaciones');

      const today = new Date();
      const fileName = `reporte_recomendaciones_aij_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      
      XLSX.writeFile(workbook, fileName, {
        bookType: 'xlsx',
        type: 'binary',
        cellStyles: true,
        compression: true
      });

      this.alertsService.showAlert('Archivo exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      this.alertsService.showAlert('Error al exportar los datos', 'error');
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
    
    return count;
  }

  protected openModalResponsables(arereCodigo: number): void {
    if (arereCodigo) {
      this.modalResponsablesSrv.openModal({
        id_rec: arereCodigo,
        filterNoJustificados: true
      });
    }
  }
}



