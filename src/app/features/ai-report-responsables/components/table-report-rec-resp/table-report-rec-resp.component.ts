import { Component, inject, OnInit } from '@angular/core';
import { ReportsResponsableService } from '@features/ai-report-responsables/services/reports-responsable.service';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ReportRecomResponsable } from '@features/ai-report-responsables/models/reports-responsable';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import * as XLSX from 'xlsx';
import { EstadoSeguimiento } from '@features/ai-seg-configuracion/models/Estado-Seg';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { FilterStateService } from '@core/services/filter-state.service';

@Component({
  selector: 'app-table-report-rec-resp',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, PaginationComponent],
  templateUrl: './table-report-rec-resp.component.html',
  styleUrl: './table-report-rec-resp.component.css'
})
export class TableReportRecRespComponent implements OnInit {
  private readonly auxiliarService: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertService: AlertsStateService = inject(AlertsStateService);
  private readonly reportsService: ReportsResponsableService = inject(ReportsResponsableService);
  private readonly filterStateService = inject(FilterStateService);
  protected filterForm: FormGroup;
  protected reports: ReportRecomResponsable[] = [];
  protected filteredReports: ReportRecomResponsable[] = [];
  protected displayedReports: ReportRecomResponsable[] = [];
  protected estadosSeguimiento: EstadoSeguimiento[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 10;
  private originalOrder: ReportRecomResponsable[] = [];

  constructor(
    private formBuilder: FormBuilder
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);

    this.filterForm = this.formBuilder.group({
      startDate: [this.formatDate(firstDayOfYear)],
      endDate: [this.formatDate(today)],
      estadoSeguimiento: ['0'],
      searchTerm: ['']
    },
    { validators: this.dateRangeValidator }
  );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_rec_resp');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarEstadosSeguimiento();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_rec_resp', val);
    });
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);

    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      estadoSeguimiento: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_rec_resp');
    
    this.currentPage = 1;
    this.reports = [];
    this.filteredReports = [];
    this.displayedReports = [];
    this.hasData = false;
    this.applyFilter();
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  private cargarEstadosSeguimiento(): void {
    this.reportsService.getEstadoSeg().subscribe({
      next: (response) => {
        this.estadosSeguimiento = response.datos;
        this.applyFilter();
      },
      error: (error: any) => {
        this.alertService.showAlert('Error al cargar los estados de seguimiento', 'error');
      }
    });
  }

  private configureFormChanges(): void {
    this.startDateControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });

    this.estadoSeguimientoControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });

    this.searchTermControl.valueChanges.subscribe(() => {
      this.applySearchFilter();
    });
  }
  
  protected applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      
      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      const estadoSeguimiento = parseInt(this.estadoSeguimientoControl.value);
      const user = this.auxiliarService.getUserCuenta();
      this.reportsService.getReportRecomResponsable(startDate, endDate, estadoSeguimiento, user)
        .subscribe({
          next: (response) => {
            this.reports = response.datos;
            console.log('Reportes obtenidos:', this.reports);
            this.filteredReports = [...this.reports];
            this.hasData = this.reports.length > 0;
            this.originalOrder = [...this.reports];
            this.applySearchFilter();
            this.isLoading = false;
          },
          error: (error: any) => {
            this.alertService.showAlert('Error al cargar los reportes', 'error');
            this.hasData = false;
            this.reports = [];
            this.filteredReports = [];
            this.displayedReports = [];
            this.isLoading = false;
          }
        });
    }
  }

  private applySearchFilter(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase() || '';
    
    if (!searchTerm.trim()) {
      this.filteredReports = [...this.reports];
    } else {
      this.filteredReports = this.reports.filter(report =>
        report.tituloInforme?.toLowerCase().includes(searchTerm) ||
        report.conclusion?.toLowerCase().includes(searchTerm) ||
        report.recomendacion?.toLowerCase().includes(searchTerm) ||
        report.memorando?.toLowerCase().includes(searchTerm) ||
        report.memoAprobacion?.toLowerCase().includes(searchTerm) ||
        report.organismoControl?.toLowerCase().includes(searchTerm) ||
        report.estadoSeguimiento?.toLowerCase().includes(searchTerm)
      );
    }
    
    this.hasData = this.filteredReports.length > 0;
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private updateDisplayedReports(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(startIndex, startIndex + this.itemsPerPage);
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedReports();
  } 

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private dateRangeValidator(group: FormGroup) {
    const startDate = group.get('startDate')?.value;
    const endDate = group.get('endDate')?.value;
    return startDate && endDate && startDate <= endDate
      ? null
      : { dateRangeInvalid: true };
  }

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get estadoSeguimientoControl(): FormControl {
    return this.filterForm.get('estadoSeguimiento') as FormControl;
  }

  private formatDateToDisplay(dateStr: string): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private getEstadoSeguimientoDescripcion(codigo: number): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const estado = this.estadosSeguimiento.find(est => Number(est.arees_codigo) === codigoNum);
    return estado ? estado.arees_descripcion : 'Todos';
  } 

  protected exportToExcel(): void {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.alertService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE DE RECOMENDACIONES RESPONSABLES'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.startDateControl.value],
        ['Fecha Hasta:', this.endDateControl.value],
        ['Estado Seguimiento:', this.getEstadoSeguimientoDescripcion(parseInt(this.estadoSeguimientoControl.value))],
        ['Palabra Clave:', this.searchTermControl.value || 'Sin filtro'],
        ['Usuario:', this.auxiliarService.getUserCuenta()],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación
      const dataToExport = this.filteredReports.map(report => {
        return {
          'Título Informe': report.tituloInforme,
          'Conclusion': report.conclusion,
          'Recomendación': report.recomendacion,
          'Memorando': report.memorando,
          'Memo Aprobación': report.memoAprobacion,
          'Fecha Inicio Control': this.formatDateToDisplay(report.fechaInicioControl),
          'Fecha Máxima': this.formatDateToDisplay(report.fechaMaxima),
          'Organismo Control': report.organismoControl,
          'Estado Seguimiento': report.estadoSeguimiento,
          'Pendiente Cumplimiento Departamentos': report.pendienteCumplimientoDepartamentos,
          'Pendiente Cumplimiento Responsables': report.pendienteCumplimientoResponsables
        };
      });

      // Crear libro de trabajo
      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      
      // Crear hoja para el encabezado
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);
      
      // Combinar las hojas (encabezado y datos)
      const worksheet = Object.assign({}, worksheetHeader);
      
      // Calcular la última fila del encabezado
      const headerRowCount = headerData.length;
      
      // Copiar los datos debajo del encabezado
      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });
      
      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Recomendaciones');

      // Generar archivo y descargarlo
      const today = new Date();
      const fileName = `reporte_recomendaciones_responsables_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.alertService.showAlert('Archivo exportado exitosamente', 'success');
    } catch (error) {
      this.alertService.showAlert('Error al exportar los datos', 'error');
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