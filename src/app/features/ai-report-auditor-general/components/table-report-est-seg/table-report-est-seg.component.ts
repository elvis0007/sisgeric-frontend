import { CommonModule } from '@angular/common';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportEstadoSeguimiento } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import * as XLSX from 'xlsx';

import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';

@Component({
  selector: 'app-table-report-est-seg',
  standalone: true,
  imports: [StatusColorPipe, CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-report-est-seg.component.html',
  styleUrl: './table-report-est-seg.component.css'
})
export class TableReportEstSegComponent implements OnInit {
  protected responsablesAbiertos: { nombre: string; estado: string }[] | null = null;
  protected responsableActivo: ReportEstadoSeguimiento | null = null;
  protected panelX = 0;
  protected panelY = 0;
  private readonly responsablesCache = new Map<string, { nombre: string; estado: string }[]>();

  protected listaResponsables(texto?: string | null): { nombre: string; estado: string }[] {
    const valor = texto?.trim() || '';
    if (!valor) return [];
    const guardados = this.responsablesCache.get(valor);
    if (guardados) return guardados;
    const lista = valor.split(/\)\s*,\s*/).map(parte => {
      const match = parte.trim().match(/^(.+?)\s*\(([^()]*)\)?$/);
      return match ? { nombre: match[1].trim(), estado: match[2].trim() }
        : { nombre: parte.trim(), estado: '' };
    }).filter(item => item.nombre);
    this.responsablesCache.set(valor, lista);
    return lista;
  }

  protected abrirResponsables(event: MouseEvent, report: ReportEstadoSeguimiento): void {
    event.stopPropagation();
    if (this.responsableActivo === report) {
      this.cerrarResponsables();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ancho = Math.min(400, window.innerWidth - 24);
    this.panelX = Math.max(12, Math.min(rect.right - ancho, window.innerWidth - ancho - 12));
    this.panelY = rect.bottom + 8 + 300 > window.innerHeight
      ? Math.max(12, rect.top - 308) : rect.bottom + 8;
    this.responsablesAbiertos = this.listaResponsables(report.responsables);
    this.responsableActivo = report;
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  @HostListener('window:resize')
  protected cerrarResponsables(): void {
    this.responsablesAbiertos = null;
    this.responsableActivo = null;
  }

  protected evidenciasRequeridas(texto?: string | null): string[] {
    const contenido = texto?.trim() || '';
    if (!contenido) return [];
    return /^1[.)]\s+/.test(contenido)
      ? contenido.split(/(?:\r?\n)+(?=\d+[.)]\s+)/).map(item => item.replace(/^\d+[.)]\s+/, ''))
      : [contenido];
  }

  protected filterForm: FormGroup;
  protected reports: ReportEstadoSeguimiento[] = [];
  protected displayedReports: ReportEstadoSeguimiento[] = [];
  protected filteredReports: ReportEstadoSeguimiento[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  protected estadosSeguimiento: EstadoSeg[] = [];
  protected auditores: UsuarioAuditor[] = [];
  private originalOrder: ReportEstadoSeguimiento[] = [];
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
        estadoSeg: ['0'],
        auditor: ['0'],
        searchTerm: [''] // Filtro por palabra clave
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_est_seg');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarEstadosSeguimiento();
    this.cargarAuditores();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_est_seg', val);
    });
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      estadoSeg: '0',
      auditor: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_est_seg');
    this.resetPaginationAndApplyFilter();
  }

  private cargarEstadosSeguimiento(): void {
    this.reportsService.getEstadoSeg().subscribe({
      next: (response) => {
        this.estadosSeguimiento = response.datos.map(estado => ({
          arees_codigo: estado.arees_codigo,
          arees_descripcion: estado.arees_descripcion
        }));
        // Cargar datos iniciales con los filtros por defecto:
        // - Fechas: desde el 1 de enero del año actual hasta hoy
        // - Estado Seguimiento: 0 (Todos)
        this.applyFilter();
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al cargar los estados de seguimiento', 'error');
      }
    });
  }

  private cargarAuditores(): void {
    this.reportsService.getAuditores().subscribe({
      next: (response) => {
        this.auditores = response.datos?.usuarios || [];
      },
      error: () => {
        this.alertsService.showAlert('Error al cargar auditores', 'error');
      }
    });
  }

  private configureFormChanges(): void {
    // Escuchar cambios en el select de estado de seguimiento
    this.estadoSegControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    // Escuchar cambios en las fechas
    this.startDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    // Escuchar cambios en el filtro de búsqueda (solo aplica filtro local)
    this.searchTermControl.valueChanges.subscribe(() => {
      this.applySearchFilter();
    });

    this.auditorControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });
  }

  private resetPaginationAndApplyFilter(): void {
    // Limpiar estado anterior
    this.currentPage = 1;
    this.reports = [];
    this.filteredReports = [];
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
      const estadoSeg = parseInt(this.estadoSegControl.value);
      const auditor_responsable = this.auditorControl.value || '0';
      
      this.reportsService.getReportByEstadoSeg(startDate, endDate, estadoSeg,auditor_responsable)
        .subscribe({
          next: (response) => {
            this.reports = response.datos || [];
            this.hasData = this.reports.length > 0;
            
            // Guardar orden original y aplicar ordenamiento
            this.originalOrder = [...this.reports];
            this.aplicarOrdenamiento();
            
            // Asegurar que estamos en la primera página después de aplicar filtros
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

    if (this.ordenFecha === 'asc') {
      this.reports.sort((a, b) => {
        const fechaA = new Date(a.fechaEmision).getTime();
        const fechaB = new Date(b.fechaEmision).getTime();
        return fechaA - fechaB;
      });
    } else {
      this.reports.sort((a, b) => {
        const fechaA = new Date(a.fechaEmision).getTime();
        const fechaB = new Date(b.fechaEmision).getTime();
        return fechaB - fechaA;
      });
    }
  }

  private applySearchFilter(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase().trim() || '';
    const includes = (value: unknown) =>
      (value ?? '').toString().toLowerCase().includes(searchTerm);

    if (!searchTerm) this.filteredReports = [...this.reports];
    else {
      this.filteredReports = this.reports.filter(report =>
        includes(report.tituloInforme) ||
        includes(report.recomendacion) ||
        includes(report.organismoControl) ||
        includes(report.memorando) ||
        includes(report.memoAprobacion) ||
        includes(report.estadoSeguimiento) ||
        includes(report.auditor) ||
        includes(report.responsables)
      );
    }
    
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private updateDisplayedReports(): void {
    this.cerrarResponsables();
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
      this.currentPage = 1; // Resetear a la primera página
      this.updateDisplayedReports();
    }
  }

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get estadoSegControl(): FormControl {
    return this.filterForm.get('estadoSeg') as FormControl;
  }

  get auditorControl(): FormControl {
    return this.filterForm.get('auditor') as FormControl;
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

  private getEstadoSeguimientoDescripcion(codigo: string): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const estado = this.estadosSeguimiento.find(est => 
      Number(est.arees_codigo) === codigoNum
    );
    return estado ? estado.arees_descripcion : 'Todos';
  }

  private getAuditorDescripcion(auditorCuenta: string): string {
    if (!auditorCuenta || auditorCuenta === '0') return 'Todos';
    const auditor = this.auditores.find(a => a.dsgus_cuenta === auditorCuenta);
    return auditor ? auditor.nombre_completo : 'Todos';
  }

  private getDepartamentoDescripcion(dpto: string): string {
    if (!dpto || dpto === '0') return 'Todos';
    return dpto;
  }

  protected exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE POR ESTADO DE SEGUIMIENTO'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Estado Seguimiento:', this.getEstadoSeguimientoDescripcion(this.estadoSegControl.value)],
        ['Auditor Operativo:', this.getAuditorDescripcion(this.auditorControl.value)],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        [''],  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación con formato correcto de fechas
      const dataToExport = this.filteredReports.map(report => {
        return {
          'Título Informe': report.tituloInforme,
          'Recomendación': report.recomendacion,
          'Organismo de Control': report.organismoControl,
          'Memorando': report.memorando,
          'Memo Aprobación': report.memoAprobacion,
          'Fecha Emisión': report.fechaEmision,
          'Fecha Aprobación': report.fechaAprobacion,
          'Estado Seguimiento': report.estadoSeguimiento,
          'Responsables': report.responsables,
          'Riesgo': report.riesgoVerificado || 'Sin registrar',
          'Evidencia requerida': report.evidenciaRequerida || 'Sin registrar',
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
        { wch: 50 }, // Título Informe
        { wch: 50 }, // Recomendación
        { wch: 20 }, // Organismo de Control
        { wch: 15 }, // Memorando
        { wch: 15 }, // Memo Aprobación
        { wch: 15 }, // Fecha Emisión
        { wch: 15 }, // Fecha Aprobación
        { wch: 20 }, // Estado Seguimiento
        { wch: 40 }, // Responsables
        { wch: 18 }, // Riesgo
        { wch: 60 }, // Evidencia requerida
      ];
      
      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Estado_Seguimiento');

      // Generar archivo con codificación UTF-8
      const today = new Date();
      const fileName = `reporte_estado_seguimiento_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      
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
