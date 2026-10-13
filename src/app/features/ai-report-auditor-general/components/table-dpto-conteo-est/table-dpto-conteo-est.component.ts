import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportDptoConteoEstados } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-dpto-conteo-est',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-dpto-conteo-est.component.html',
  styleUrl: './table-dpto-conteo-est.component.css'
})
export class TableDptoConteoEstComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: ReportDptoConteoEstados[] = [];
  protected displayedReports: ReportDptoConteoEstados[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 10;
  protected departamentos: string[] = [];
  protected organismos: OrganismoControl[] = [];
  private originalOrder: ReportDptoConteoEstados[] = [];
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsAuditorGenService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    // Inicializar formulario con filtros adicionales
    // Valores por defecto para enviar al servicio: departamento "0" y organismo control "0"
    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        departamento: ['0'], // "0" string para "Todos" en el servicio
        organismoControl: ['0'] // '0' para "Todos"
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_dpto_conteo_est');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarDatos();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_dpto_conteo_est', val);
    });

    // Cargar datos iniciales inmediatamente con valores por defecto
    this.applyFilter();
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      departamento: '0',
      organismoControl: '0'
    }, { emitEvent: false });

    this.organismosSeleccionados = [];
    this.filterStateService.clearFilters('rep_dpto_conteo_est');
    this.applyFilter();
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
    this.applyFilter();
  }

  toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.applyFilter();
  }

  private normalizeText(text: string): string {
    return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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

  private cargarDatos(): void {
    // Cargar departamentos
    this.reportsService.getDepartamentos().subscribe({
      next: (response) => {
        this.departamentos = response.datos;
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al cargar los departamentos', 'error');
      }
    });

    // Cargar organismos de control
    this.reportsService.getOrganismos().subscribe({
      next: (response) => {
        this.organismos = response.datos;
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al cargar los organismos de control', 'error');
      }
    });
  }

  private configureFormChanges(): void {
    // Escuchar cambios en las fechas
    this.startDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    // Escuchar cambios en los nuevos filtros
    this.departamentoControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.organismoControlControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });
  }

  private resetPaginationAndApplyFilter(): void {
    // Limpiar estado anterior
    this.currentPage = 1;
    this.reports = [];
    this.displayedReports = [];
    this.hasData = false;
    
    // Aplicar filtros
    this.applyFilter();
  }

  protected applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      
      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      // Enviar "0" como string para departamento cuando esté vacío o sea "Todos"
      const departamento = this.departamentoControl.value || '0';
      // Enviar 0 como int para organismo control cuando sea "Todos"
      const organismoControl = parseInt(this.organismoControlControl.value) || 0;
      
      this.reportsService.getReportDptoConteoEstados(startDate, endDate, departamento, 0)
        .subscribe({
          next: (response) => {
            let data = response.datos || [];

            if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
              const selectedDescs = this.organismosSeleccionados
                .map((cod: number) => this.getOrganismoControlDescripcion(String(cod)))
                .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
                .map((desc: string) => this.normalizeText(desc));

              if (selectedDescs.length > 0) {
                data = data.filter(r => selectedDescs.includes(this.normalizeText(r.organismoControl)));
              }
            }

            this.reports = data;
            this.hasData = this.reports.length > 0;
            
            // Ordenar por departamento y luego por total de recomendaciones (de mayor a menor)
            this.reports.sort((a, b) => {
              // Primero por departamento
              const deptCompare = a.departamento.localeCompare(b.departamento);
              if (deptCompare !== 0) return deptCompare;
              
              // Si son del mismo departamento, ordenar por total de recomendaciones (mayor a menor)
              return b.totalRecomendaciones - a.totalRecomendaciones;
            });
            
            this.originalOrder = [...this.reports];
            this.currentPage = 1;
            this.updateDisplayedReports();
            this.isLoading = false;
          },
          error: (error: any) => {
            console.error('Error al cargar los reportes:', error);
            this.alertsService.showAlert('Error al cargar los reportes', 'error');
            this.reports = [];
            this.displayedReports = [];
            this.hasData = false;
            this.isLoading = false;
          }
        });
    }
  }

  private updateDisplayedReports(): void {
    if (!this.reports || this.reports.length === 0) {
      this.displayedReports = [];
      return;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedReports = this.reports.slice(startIndex, endIndex);
  }

  protected onPageChange(page: number): void {
    if (page >= 1 && page <= Math.ceil(this.reports.length / this.itemsPerPage)) {
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

  get departamentoControl(): FormControl {
    return this.filterForm.get('departamento') as FormControl;
  }

  get organismoControlControl(): FormControl {
    return this.filterForm.get('organismoControl') as FormControl;
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
    
    // Crear fecha sin conversión de zona horaria para evitar que reste un día
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private getOrganismoControlDescripcion(codigo: string): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const organismo = this.organismos.find(org => Number(org.ainoc_codigo) === codigoNum);
    return organismo ? organismo.ainoc_descripcion : 'Todos';
  }

  private getDepartamentoDescripcion(codigo: string): string {
    if (codigo === '0' || !codigo) return 'Todos';
    return codigo;
  }

  protected exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE DE CONTEO POR DEPARTAMENTO'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Departamento:', this.getDepartamentoDescripcion(this.departamentoControl.value)],
        ['Ente de Control:', this.getOrganismosSeleccionadosLabel()],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación
      const dataToExport = this.reports.map(report => {
        return {
          'Departamento': report.departamento,
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
      
      // Configurar anchos de columna para mejor visualización
      worksheet['!cols'] = [
        { wch: 25 }, // Departamento
        { wch: 25 }, // Organismo de Control
        { wch: 18 }, // Total Recomendaciones
        { wch: 15 }, // En Proceso
        { wch: 15 }, // Cumplidas
        { wch: 15 }, // No Cumplidas
        { wch: 15 }  // No Aplica
      ];
      
      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Departamento_Estados');

      // Generar archivo con codificación UTF-8
      const today = new Date();
      const fileName = `reporte_dpto_estados_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      
      // Escribir archivo con opciones para UTF-8
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
}
