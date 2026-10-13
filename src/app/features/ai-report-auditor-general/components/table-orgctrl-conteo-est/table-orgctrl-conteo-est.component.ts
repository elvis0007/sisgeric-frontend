import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportOrgCtrlConteoEstados } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-orgctrl-conteo-est',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-orgctrl-conteo-est.component.html',
  styleUrl: './table-orgctrl-conteo-est.component.css'
})
export class TableOrgctrlConteoEstComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: ReportOrgCtrlConteoEstados[] = [];
  protected displayedReports: ReportOrgCtrlConteoEstados[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 10;
  private originalOrder: ReportOrgCtrlConteoEstados[] = [];
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsAuditorGenService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    // Inicializar formulario con fechas por defecto
    // Este reporte solo usa filtros de fecha
    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)]
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_orgctrl_conteo_est');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_orgctrl_conteo_est', val);
    });

    // Cargar datos iniciales con las fechas por defecto:
    // - Desde el 1 de enero del año actual hasta hoy
    this.applyFilter();
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today)
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_orgctrl_conteo_est');
    this.applyFilter();
  }

  private configureFormChanges(): void {
    // Escuchar cambios en las fechas
    this.startDateControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });
  }

  protected applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      
      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      
      this.reportsService.getReportOrgCtrlConteoEstados(startDate, endDate)
        .subscribe({
          next: (response) => {
            this.reports = response.datos;
            this.hasData = this.reports.length > 0;
            
            // Ordenar por total de recomendaciones (de mayor a menor)
            this.reports.sort((a, b) => b.totalRecomendaciones - a.totalRecomendaciones);
            
            this.originalOrder = [...this.reports];
            this.updateDisplayedReports();
            this.isLoading = false;
          },
          error: (error: any) => {
            this.alertsService.showAlert('Error al cargar los reportes', 'error');
            this.hasData = false;
            this.isLoading = false;
          }
        });
    }
  }

  private updateDisplayedReports(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedReports = this.reports.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
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

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
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

  private formatDateToDisplay(dateStr: string): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  protected exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE DE CONTEO POR ORGANISMO DE CONTROL'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        [''],  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación
      const dataToExport = this.reports.map(report => {
        return {
          'Organismo de Control': report.organismoControl,
          'Total Recomendaciones': report.totalRecomendaciones,
          'En Proceso': report.recomendacionesEnProceso,
          'Cumplidas': report.recomendacionesCumplidas,
          'No Cumplidas': report.recomendacionesNoCumplidas,
          'No Aplica': report.recomendacionesNoAplica
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Conteo_Estados');

      // Generar archivo y descargarlo
      const today = new Date();
      const fileName = `reporte_conteo_estados_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.alertsService.showAlert('Archivo exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      this.alertsService.showAlert('Error al exportar los datos', 'error');
    }
  }
}
