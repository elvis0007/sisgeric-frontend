import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ReportsResponsableService } from '@features/ai-report-responsables/services/reports-responsable.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ReportProgresoRecomendacion } from '@features/ai-report-responsables/models/reports-responsable';
import * as XLSX from 'xlsx';
import { FilterStateService } from '@core/services/filter-state.service';

@Component({
  selector: 'app-table-report-progreso-rec',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, PaginationComponent],
  templateUrl: './table-report-progreso-rec.component.html',
  styleUrl: './table-report-progreso-rec.component.css'
})
export class TableReportProgresoRecComponent implements OnInit {
  private readonly auxiliarService: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertService: AlertsStateService = inject(AlertsStateService);
  private readonly reportsService: ReportsResponsableService = inject(ReportsResponsableService);
  private readonly filterStateService = inject(FilterStateService);
  protected filterForm: FormGroup;
  protected reports: ReportProgresoRecomendacion[] = [];
  protected filteredReports: ReportProgresoRecomendacion[] = [];
  protected displayedReports: ReportProgresoRecomendacion[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 10;
  private originalOrder: ReportProgresoRecomendacion[] = [];

  constructor(
    private formBuilder: FormBuilder
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);

    this.filterForm = this.formBuilder.group({
      startDate: [this.formatDate(firstDayOfYear)],
      endDate: [this.formatDate(today)],
      searchTerm: ['']
    },
    { validators: this.dateRangeValidator }
  );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_progreso_rec');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.configureFormChanges();
    this.applyFilter(); // Carga inicial de datos

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_progreso_rec', val);
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

    this.filterStateService.clearFilters('rep_progreso_rec');
    
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

  private configureFormChanges(): void {
    this.startDateControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
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
      const user = this.auxiliarService.getUserCuenta();

      this.reportsService.getReportProgresoRecomendacion(startDate, endDate, user)
        .subscribe({
          next: (response) => {
            this.reports = response.datos;
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
        report.memorando?.toLowerCase().includes(searchTerm) ||
        report.memoAprobacion?.toLowerCase().includes(searchTerm) ||
        report.organismoControl?.toLowerCase().includes(searchTerm) ||
        report.codigoAuditor?.toLowerCase().includes(searchTerm)
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

  private formatDateToDisplay(dateStr: string): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  protected getDepartamentosEnProceso(report: ReportProgresoRecomendacion): string[] {
    if (!report.departamentosResponsablesPendientesEnProceso) {
      return [];
    }
    return report.departamentosResponsablesPendientesEnProceso
      .split(',')
      .map(dept => dept.trim())
      .filter(dept => dept.length > 0);
  }

  protected getDepartamentosNoCumplidas(report: ReportProgresoRecomendacion): string[] {
    if (!report.departamentosResponsablesNoCumplida) {
      return [];
    }
    return report.departamentosResponsablesNoCumplida
      .split(',')
      .map(dept => dept.trim())
      .filter(dept => dept.length > 0);
  }

  protected isRowNearBottom(index: number): boolean {
    // Si la fila está en las últimas 3 filas, mostrar dropdown arriba
    const threshold = 3;
    return index > (this.displayedReports.length - threshold - 1);
  }

  protected exportToExcel(): void {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.alertService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE DE PROGRESO DE RECOMENDACIONES'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.startDateControl.value],
        ['Fecha Hasta:', this.endDateControl.value],
        ['Palabra Clave:', this.searchTermControl.value || 'Sin filtro'],
        ['Usuario:', this.auxiliarService.getUserCuenta()],
        [''],
        ['Fecha de generación:', this.formatDate(new Date())],
        [''],
        ['']  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación con todos los campos
      const dataToExport = this.filteredReports.map(report => {
        return {
          'Título Informe': report.tituloInforme,
          'Memorando': report.memorando,
          'Memo Aprobación': report.memoAprobacion,
          'Ente de Control': report.organismoControl,
          'Auditor': report.codigoAuditor,
          'Conteo Recomendaciones': report.conteoRecomendaciones,
          'Recomendaciones En Proceso': report.recomendacionesEnProceso,
          'Recomendaciones Cumplidas': report.recomendacionesCumplidas,
          'Recomendaciones No Cumplidas': report.recomendacionesNoCumplidas,
          'Recomendaciones No Aplica': report.recomendacionesNoAplica,
          'Progreso': report.progreso + '%'
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Progreso');

      // Generar archivo y descargarlo
      const today = new Date();
      const fileName = `reporte_progreso_recomendaciones_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.alertService.showAlert('Archivo exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      this.alertService.showAlert('Error al exportar los datos', 'error');
    }
  }
}
