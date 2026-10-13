import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ReportRecomendacionesVencidasResponsable } from '@features/ai-report-responsables/models/reports-responsable';
import { ReportsResponsableService } from '@features/ai-report-responsables/services/reports-responsable.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import * as XLSX from 'xlsx';
import { FilterStateService } from '@core/services/filter-state.service';

@Component({
  selector: 'app-table-recomendaciones-vencidas-responsable',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, AbsPipe],
  templateUrl: './table-recomendaciones-vencidas-responsable.component.html',
  styleUrl: './table-recomendaciones-vencidas-responsable.component.css'
})
export class TableRecomendacionesVencidasResponsableComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: ReportRecomendacionesVencidasResponsable[] = [];
  protected displayedReports: ReportRecomendacionesVencidasResponsable[] = [];
  protected filteredReports: ReportRecomendacionesVencidasResponsable[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  private originalOrder: ReportRecomendacionesVencidasResponsable[] = [];

  private readonly modalResponsablesSrv: ModalResponsablesService = inject(ModalResponsablesService);
  private readonly auxiliarService: AuxiliaryService = inject(AuxiliaryService);
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsResponsableService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);

    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        searchTerm: ['']
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_recom_vencidas_resp');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.configureFormChanges();
    this.applyFilter();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_recom_vencidas_resp', val);
    });
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);

    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_recom_vencidas_resp');
    this.resetPaginationAndApplyFilter();
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
      const estadoSeg = 0;
      const user = this.auxiliarService.getUserCuenta();

      this.reportsService.getReportRecomendacionesVencidasResponsable(startDate, endDate, estadoSeg, user)
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
      const parts = dateStr.split('/');
      if (parts.length !== 3) return 0;
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
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

    if (!searchTerm) {
      this.filteredReports = [...this.reports];
    } else {
      this.filteredReports = this.reports.filter(report =>
        report.tituloInforme?.toLowerCase().includes(searchTerm) ||
        report.recomendacion?.toLowerCase().includes(searchTerm) ||
        report.organismoControl?.toLowerCase().includes(searchTerm) ||
        report.memorando?.toLowerCase().includes(searchTerm) ||
        report.memoAprobacion?.toLowerCase().includes(searchTerm)
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
        ['REPORTE DE RECOMENDACIONES VENCIDAS'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']
      ];

      const dataToExport = this.reports.map(report => {
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
          'Responsables': report.responsables || ''
        };
      });

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();

      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);

      const worksheet = Object.assign({}, worksheetHeader);

      const headerRowCount = headerData.length;

      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });

      worksheet['!cols'] = [
        { wch: 50 },
        { wch: 50 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 80 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Recomendaciones_Vencidas');

      const today = new Date();
      const fileName = `reporte_recomendaciones_vencidas_responsable_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;

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

  protected activePopover: { title: string; text: string; x: number; y: number } | null = null;

  protected showPopover(event: MouseEvent, title: string, text: string): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = rect.left + window.scrollX + 10;
    const y = rect.bottom + window.scrollY + 5;
    this.activePopover = { title, text, x, y };
  }

  protected hidePopover(): void {
    this.activePopover = null;
  }
}
