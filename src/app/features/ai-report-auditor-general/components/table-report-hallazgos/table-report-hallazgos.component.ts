import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportHallazgos } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-report-hallazgos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-report-hallazgos.component.html',
  styleUrl: './table-report-hallazgos.component.css'
})
export class TableReportHallazgosComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: ReportHallazgos[] = [];
  protected displayedReports: ReportHallazgos[] = [];
  protected filteredReports: ReportHallazgos[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;
  protected organismos: OrganismoControl[] = [];
  protected auditores: UsuarioAuditor[] = [];
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsAuditorGenService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    // Inicializar formulario con valores por defecto
    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        organismoControl: [0], // '0' para "Todos"
        auditor: [0], // Vacío para "Todos"
        searchTerm: [''] // Filtro por palabra clave
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_hallazgos');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarDatos();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_hallazgos', val);
    });

    // Cargar datos iniciales con los filtros por defecto
    setTimeout(() => {
      this.applyFilter();
    }, 100);
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      organismoControl: 0,
      auditor: 0,
      searchTerm: ''
    }, { emitEvent: false });

    this.organismosSeleccionados = [];
    this.filterStateService.clearFilters('rep_hallazgos');
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

  private cargarDatos(): void {
    // Cargar organismos de control
    this.reportsService.getOrganismos().subscribe({
      next: (response) => {
        this.organismos = response.datos;
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al cargar los organismos de control', 'error');
      }
    });

    // Cargar auditores
    this.reportsService.getAuditores().subscribe({
      next: (response) => {
        if (response.datos && response.datos.usuarios) {
          this.auditores = response.datos.usuarios;
        }
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al cargar los auditores', 'error');
      }
    });
  }

  private configureFormChanges(): void {
    // Escuchar cambios en los filtros
    this.startDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.organismoControlControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.auditorControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    // Escuchar cambios en el filtro de búsqueda (solo aplica filtro local)
    this.searchTermControl.valueChanges.subscribe(() => {
      this.applySearchFilter();
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
      // Enviar "0" cuando auditor esté vacío (Todos)
      const auditor = this.auditorControl.value || '0';
      
      this.reportsService.getReportHallazgos(startDate, endDate, 0, auditor)
        .subscribe({
          next: (response) => {
            this.reports = response.datos || [];
            this.hasData = this.reports.length > 0;
            
            // Asegurar que estamos en la primera página después de aplicar filtros
            this.currentPage = 1;
            this.applySearchFilter();
            this.isLoading = false;
          },
          error: (error: any) => {
            console.error('Error al cargar los reportes de hallazgos:', error);
            this.alertsService.showAlert('Error al cargar los reportes de hallazgos', 'error');
            this.reports = [];
            this.filteredReports = [];
            this.displayedReports = [];
            this.hasData = false;
            this.isLoading = false;
          }
        });
    }
  }

  private applySearchFilter(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase().trim() || '';
    let result = [...this.reports];

    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map((cod: number) => this.getOrganismoControlDescripcion(String(cod)))
        .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
        .map((desc: string) => desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());

      if (selectedDescs.length > 0) {
        result = result.filter(report => {
          const normOrg = (report.organismoControl || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          return selectedDescs.includes(normOrg);
        });
      }
    }

    if (searchTerm) {
      result = result.filter(report => 
        report.tituloInforme?.toLowerCase().includes(searchTerm) ||
        report.hallazgo?.toLowerCase().includes(searchTerm) ||
        report.organismoControl?.toLowerCase().includes(searchTerm) ||
        report.memorando?.toLowerCase().includes(searchTerm) ||
        report.memoAprobacion?.toLowerCase().includes(searchTerm) ||
        report.auditor?.toLowerCase().includes(searchTerm)
      );
    }
    
    this.filteredReports = result;
    
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

  get organismoControlControl(): FormControl {
    return this.filterForm.get('organismoControl') as FormControl;
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

  private getOrganismoControlDescripcion(codigo: string): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const organismo = this.organismos.find(org => Number(org.ainoc_codigo) === codigoNum);
    return organismo ? organismo.ainoc_descripcion : 'Todos';
  }

  private getAuditorNombre(codigo: string): string {
    if (!codigo || codigo === '0') return 'Todos';
    
    // Buscar el auditor por su código - verificar diferentes propiedades posibles
    const auditor = this.auditores.find(aud => {
      if (!aud || typeof aud !== 'object') return false;
      
      // Verificar diferentes posibles nombres de propiedades para el código
      const codigoAuditor = (aud as any).dsgus_cuenta || (aud as any).codigo || (aud as any).id || (aud as any).usuario_codigo || (aud as any).ainau_codigo;
      return codigoAuditor && codigoAuditor.toString() === codigo.toString();
    });
    
    // Verificar si encontramos el auditor y construir el nombre
    if (auditor) {
      const nombreCompleto = (auditor as any).nombre_completo;
      if (nombreCompleto) {
        return nombreCompleto;
      }
      
      const nombre = (auditor as any).nombre || (auditor as any).nombres || (auditor as any).ainau_nombres || '';
      const apellido = (auditor as any).apellido || (auditor as any).apellidos || (auditor as any).ainau_apellidos || '';
      
      if (nombre || apellido) {
        return `${nombre} ${apellido}`.trim();
      }
    }
    
    return 'Todos'; // Cuando no se encuentra
  }

  protected exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE DE HALLAZGOS'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Ente de Control:', this.getOrganismosSeleccionadosLabel()],
        ['Auditor:', this.getAuditorNombre(this.auditorControl.value) || 'Todos'],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación
      const dataToExport = this.reports.map(report => {
        return {
          'Título Informe': report.tituloInforme,
          'Hallazgo': report.hallazgo,
          'Organismo Control': report.organismoControl,
          'Memorando': report.memorando,
          'Memorando Aprobación': report.memoAprobacion,
          'Auditor': report.auditor
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
        { wch: 25 }, // Organismo Control
        { wch: 20 }, // Memorando
        { wch: 20 }, // Memorando Aprobación
        { wch: 60 }, // Hallazgo
        { wch: 25 }  // Auditor
      ];
      
      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Hallazgos');

      // Generar archivo con codificación UTF-8
      const today = new Date();
      const fileName = `reporte_hallazgos_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      
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
