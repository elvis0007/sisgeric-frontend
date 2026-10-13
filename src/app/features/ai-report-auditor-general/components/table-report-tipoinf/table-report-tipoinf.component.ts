import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportTipoInforme } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { TipoInforme } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { InformesAgService } from '@features/ai-seguim-auditor-general/services/informes-ag/informes-ag.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-report-tipoinf',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent],
  templateUrl: './table-report-tipoinf.component.html',
  styleUrl: './table-report-tipoinf.component.css'
})
export class TableReportTipoinfComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: ReportTipoInforme[] = [];
  protected displayedReports: ReportTipoInforme[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 10;
  protected tiposInforme: TipoInforme[] = [];
  private originalOrder: ReportTipoInforme[] = [];
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsAuditorGenService,
    private informesService: InformesAgService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);

    // Inicializar formulario con valores por defecto
    // tipoInforme en '0' para seleccionar "Todos"
    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        tipoInforme: ['0'] // '0' para "Todos"
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_tipoinf');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarTiposInforme();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_tipoinf', val);
    });
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      tipoInforme: '0'
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_tipoinf');
    this.applyFilter();
  }

  private cargarTiposInforme(): void {
    // Cargar tipos de informe
    this.informesService.getTipoInforme().subscribe({
      next: (response) => {
        this.tiposInforme = response.datos;
        // Cargar datos iniciales con los filtros por defecto:
        // - Fechas: desde el 1 de enero del año actual hasta hoy
        // - Tipo Informe: 0 (Todos)
        this.applyFilter();
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al cargar los tipos de informe', 'error');
      }
    });
  }

  private configureFormChanges(): void {
    // Escuchar cambios en las fechas y tipo de informe
    this.startDateControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });

    this.tipoInformeControl.valueChanges.subscribe(() => {
      this.applyFilter();
    });
  }

  protected applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      
      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      const tipoInforme = parseInt(this.tipoInformeControl.value);
      
      this.reportsService.getReportbyTipoInforme(startDate, endDate, tipoInforme)
        .subscribe({
          next: (response) => {
            this.reports = response.datos;
            this.hasData = this.reports.length > 0;
            
            // Ordenar por tipo de informe
            this.reports.sort((a, b) => a.tipoInforme.localeCompare(b.tipoInforme));
            
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

  get tipoInformeControl(): FormControl {
    return this.filterForm.get('tipoInforme') as FormControl;
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

  private getTipoInformeDescripcion(codigo: string): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const tipoInf = this.tiposInforme.find(tipo => Number(tipo.ainti_codigo) === codigoNum);
    return tipoInf ? tipoInf.ainti_descripcion : 'Todos';
  }

  protected exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE POR TIPO DE INFORME'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Tipo de Informe:', this.getTipoInformeDescripcion(this.tipoInformeControl.value)],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación
      const dataToExport = this.reports.map(report => {
        return {
          'Tipo de Informe': report.tipoInforme,
          'Recomendaciones En Proceso': report.cantidadRecomendacionesEnProceso,
          'Recomendaciones Cumplidas': report.cantidadRecomendacionesCumplidas,
          'Total': (report.cantidadRecomendacionesEnProceso + report.cantidadRecomendacionesCumplidas)
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Tipo_Informe');

      // Generar archivo y descargarlo
      const today = new Date();
      const fileName = `reporte_tipo_informe_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.alertsService.showAlert('Archivo exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      this.alertsService.showAlert('Error al exportar los datos', 'error');
    }
  }
}
