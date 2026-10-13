import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ReportsAuditorOperService } from '@features/ai-report-auditor-operativo/services/reports-auditor-oper.service';
import { ReportEstadoSeguimientoDetalle } from '@features/ai-report-auditor-operativo/models/reports-auditor-oper';
import * as XLSX from 'xlsx';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { FilterStateService } from '@core/services/filter-state.service';

import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';

@Component({
  selector: 'app-table-detalle-est-seg',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-detalle-est-seg.component.html',
  styleUrl: './table-detalle-est-seg.component.css'
})
export class TableDetalleEstSegComponent implements OnInit {
  private auxiliaryService: AuxiliaryService = inject(AuxiliaryService);
  protected filterForm: FormGroup;
  protected reports: ReportEstadoSeguimientoDetalle[] = [];
  protected displayedReports: ReportEstadoSeguimientoDetalle[] = [];
  protected filteredReports: ReportEstadoSeguimientoDetalle[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;
  private originalOrder: ReportEstadoSeguimientoDetalle[] = [];
  protected organismos: OrganismoControl[] = [];
  protected AUDITOR_JEFE = 2;
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsAuditorOperService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);

    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        organismoControl: ['0'],
        searchTerm: [''] // Filtro por palabra clave
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_detalle_est_seg');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarDatos();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_detalle_est_seg', val);
    });

    setTimeout(() => {
      this.applyFilter();
    }, 100);
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      organismoControl: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_detalle_est_seg');
    this.resetPaginationAndApplyFilter();
  }

  private cargarDatos(): void {
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
    this.startDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.organismoControlControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    // Escuchar cambios en el filtro de búsqueda (solo aplica filtro local)
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
      const organismoControlSelected = this.organismoControlControl.value;
      const user = this.auxiliaryService.getUserCuenta();
      
      this.reportsService.getReportByEstadoSegDetalle(startDate, endDate, user, organismoControlSelected)
        .subscribe({
          next: (response) => {
  // Si la respuesta no tiene datos o viene nula, asignar lista vacía
  let filteredReports = Array.isArray(response?.datos) ? response.datos : [];

  // Filtrar por organismo de control si no es "Todos" (valor 0)
  if (organismoControlSelected && organismoControlSelected !== '0' && filteredReports.length > 0) {
    const organismoSeleccionado = this.getOrganismoControlDescripcion(organismoControlSelected);
    filteredReports = filteredReports.filter(report => 
      report.organismoControl === organismoSeleccionado
    );
  }

  this.reports = filteredReports;
  this.hasData = this.reports.length > 0;

  // Ordenar por progreso descendente solo si hay datos
  if (this.reports.length > 0) {
    this.reports.sort((a, b) => (b.progreso ?? 0) - (a.progreso ?? 0));
  }

  this.originalOrder = [...this.reports];
  this.applySearchFilter();
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

  private applySearchFilter(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase().trim() || '';
    
    if (!searchTerm) {
      this.filteredReports = [...this.reports];
    } else {
      this.filteredReports = this.reports.filter(report => 
        report.tituloInforme?.toLowerCase().includes(searchTerm) ||
        report.organismoControl?.toLowerCase().includes(searchTerm) ||
        report.memorandoAI?.toLowerCase().includes(searchTerm) ||
        report.memorandoPresidencia?.toLowerCase().includes(searchTerm) ||
        report.departamentos?.toLowerCase().includes(searchTerm) ||
        report.auditorInforme?.toLowerCase().includes(searchTerm)
      );
    }
    
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private updateDisplayedReports(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(
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
  get organismoControlControl(): FormControl {
    return this.filterForm.get('organismoControl') as FormControl;
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  private getOrganismoControlDescripcion(codigo: string): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const organismo = this.organismos.find(org => Number(org.ainoc_codigo) === codigoNum);
    return organismo ? organismo.ainoc_descripcion : 'Todos';
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
    
    // Evitar problemas de zona horaria dividiendo la fecha manualmente
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  protected hasRole(roles: number[]): boolean {
    return this.auxiliaryService.hasRole(roles);
  }

  protected exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      const isAuditorJefe = this.auxiliaryService.hasRole([this.AUDITOR_JEFE]);
      
      const headerData = [
        ['REPORTE DE DETALLE DE ESTADO DE SEGUIMIENTO'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Ente de Control:', this.getOrganismoControlDescripcion(this.organismoControlControl.value)],
        ['Usuario:', this.auxiliaryService.getUserCuenta()],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']
      ];

      const dataToExport = this.reports.map(report => {
        const baseData = {
          'Código Informe': report.codigoInforme,
          'Título Informe': report.tituloInforme,
          'Organismo Control': report.organismoControl,
          'Memorando AI': report.memorandoAI,
          'Memorando Presidencia': report.memorandoPresidencia,
          'Departamentos': report.departamentos.split(',').map(dept => dept.trim()).join('\n'),
          'Total Asignaciones': report.totalAsignaciones,
          'Total Recomendaciones': report.totalRecomendaciones,
          'En Proceso': report.recomendacionesEnProceso,
          'Cumplidas': report.recomendacionesCumplidas,
          'No Cumplidas': report.recomendacionesNoCumplidas,
          'No Aplica': report.recomendacionesNoAplica,
          'Progreso (%)': Number(report.progreso.toFixed(2))
        };

        if (isAuditorJefe && report.auditorInforme) {
          return {
            ...baseData,
            'Auditor': report.auditorInforme
          };
        }

        return baseData;
      });

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);

      const baseHeaders = [
        'Código Informe', 'Título Informe', 'Organismo Control',
        'Memorando AI', 'Memorando Presidencia', 'Departamentos',
        'Total Asignaciones', 'Total Recomendaciones',
        'En Proceso', 'Cumplidas', 'No Cumplidas', 'No Aplica',
        'Progreso (%)'
      ];

      const headers = isAuditorJefe ? [...baseHeaders, 'Auditor'] : baseHeaders;

      const worksheetData: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport, {
        header: headers
      });

      const worksheet = Object.assign({}, worksheetHeader);
      const headerRowCount = headerData.length;
      
      XLSX.utils.sheet_add_json(worksheet, dataToExport, { 
        origin: `A${headerRowCount + 1}`,
        skipHeader: false
      });

      const baseColumnWidths = [
        { wch: 12 },
        { wch: 50 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 }
      ];

      worksheet['!cols'] = isAuditorJefe ? [...baseColumnWidths, { wch: 20 }] : baseColumnWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Detalle_Estado');

      const today = new Date();
      const fileName = `reporte_detalle_estado_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.alertsService.showAlert('Archivo exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      this.alertsService.showAlert('Error al exportar los datos', 'error');
    }
  }
}
