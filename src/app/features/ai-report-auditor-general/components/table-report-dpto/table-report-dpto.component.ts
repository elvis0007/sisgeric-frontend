import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ReportsAuditorGenService } from '../../services/reports-auditor-gen.service';
import { ReportRecomendacionesDepartamento } from '../../models/reports-auditor-gen';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { FilterStateService } from '@core/services/filter-state.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-report-dpto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginationComponent],
  templateUrl: './table-report-dpto.component.html',
  styleUrl: './table-report-dpto.component.css'
})
export class TableReportDptoComponent implements OnInit {
  // Forms
  protected filterForm: FormGroup;
  protected startDateControl: FormControl;
  protected endDateControl: FormControl;
  // Inicializar con 0 para seleccionar "Todos" por defecto
  protected orgCtrlControl = new FormControl(0);
  protected estadoSegControl = new FormControl(0);

  // Data
  protected reports: ReportRecomendacionesDepartamento[] = [];
  protected displayedReports: ReportRecomendacionesDepartamento[] = [];
  protected filteredReports: ReportRecomendacionesDepartamento[] = [];
  protected organismosControl: OrganismoControl[] = [];
  protected estadosSeguimiento: EstadoSeg[] = [];

  // Pagination
  protected currentPage = 1;
  protected itemsPerPage = 5;
  
  // States
  protected isLoading = false;
  protected hasData = false;
  private readonly filterStateService = inject(FilterStateService);

  constructor(
    private fb: FormBuilder,
    private reportsService: ReportsAuditorGenService
  ) {
    // Obtener el primer día del año actual
    const currentYear = new Date().getFullYear();
    const firstDayOfYear = new Date(currentYear, 0, 1); // 0 = enero, 1 = primer día
    
    // Obtener el día actual
    const today = new Date();
    
    // Formatear las fechas a ISO string (YYYY-MM-DD)
    const firstDayFormatted = this.formatDateToISO(firstDayOfYear);
    const todayFormatted = this.formatDateToISO(today);

    // Inicializar los controles con las fechas por defecto
    this.startDateControl = new FormControl(firstDayFormatted);
    this.endDateControl = new FormControl(todayFormatted);

    // Crear el formulario con todos los controles
    // Los controles orgCtrl y estadoSeg ya están inicializados con 0 ("Todos")
    this.filterForm = this.fb.group({
      startDate: this.startDateControl,
      endDate: this.endDateControl,
      orgCtrl: this.orgCtrlControl,
      estadoSeg: this.estadoSegControl,
      searchTerm: new FormControl('') // Filtro por palabra clave
    });
  }

  // Función auxiliar para formatear fecha a YYYY-MM-DD
  private formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_dpto');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.loadInitialData();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_dpto', val);
    });
  }

  clearFilters(): void {
    const currentYear = new Date().getFullYear();
    const firstDayOfYear = new Date(currentYear, 0, 1);
    const today = new Date();
    this.organismosSeleccionados = [];
    this.filterForm.setValue({
      startDate: this.formatDateToISO(firstDayOfYear),
      endDate: this.formatDateToISO(today),
      orgCtrl: 0,
      estadoSeg: 0,
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_dpto');
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
      const org = this.organismosControl.find(o => Number(o.ainoc_codigo) === this.organismosSeleccionados[0]);
      return org ? org.ainoc_descripcion : '1 Ente Seleccionado';
    }
    return `${this.organismosSeleccionados.length} Entes Seleccionados`;
  }

  private loadInitialData(): void {
    // Cargar las opciones para los selectores
    this.loadOrganismosControl();
    this.loadEstadosSeguimiento();
  }

  private loadOrganismosControl(): void {
    this.reportsService.getOrganismos().subscribe({
      next: (response) => {
        if (response && response.datos) {
          this.organismosControl = response.datos;
        }
        // Cargar datos iniciales después de cargar organismos
        this.checkAndLoadInitialData();
      },
      error: (error) => {
        console.error('Error al cargar organismos de control:', error);
        this.checkAndLoadInitialData();
      }
    });
  }

  private loadEstadosSeguimiento(): void {
    this.reportsService.getEstadoSeg().subscribe({
      next: (response) => {
        if (response && response.datos) {
          this.estadosSeguimiento = response.datos;
        }
        // Cargar datos iniciales después de cargar estados
        this.checkAndLoadInitialData();
      },
      error: (error) => {
        console.error('Error al cargar estados de seguimiento:', error);
        this.checkAndLoadInitialData();
      }
    });
  }

  private checkAndLoadInitialData(): void {
    // Solo cargar datos si ambas listas están listas (o han fallado)
    if (this.organismosControl.length >= 0 && this.estadosSeguimiento.length >= 0) {
      this.applyFilter();
    }
  }

  private configureFormChanges(): void {
    // Escuchar cambios en el select de organismo de control
    this.orgCtrlControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

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
    if (this.filterForm.valid && this.startDateControl.value && this.endDateControl.value) {
      this.isLoading = true;      
      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      const estadoSeg = this.estadoSegControl.value || 0;
      
      this.reportsService.getReportPorDepartamento(startDate, endDate, 0, estadoSeg)
        .subscribe({
          next: (response) => {
            this.reports = response?.datos || [];
            this.hasData = this.reports.length > 0;
            
            // Asegurar que estamos en la primera página después de aplicar filtros
            this.currentPage = 1;
            this.applySearchFilter();
            this.isLoading = false;
            
          },
          error: (error) => {
            console.error('Error al cargar el reporte:', error);
            this.reports = [];
            this.filteredReports = [];
            this.displayedReports = [];
            this.hasData = false;
            this.isLoading = false;
          }
        });
    }
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedReports();
  }

  onItemsPerPageChange(items: number): void {
    this.itemsPerPage = items;
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private applySearchFilter(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase().trim() || '';
    let result = [...this.reports];

    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map(cod => this.getOrganismoControlDescripcion(cod))
        .filter(desc => desc && desc !== 'Todos')
        .map(desc => desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());

      if (selectedDescs.length > 0) {
        result = result.filter(report => {
          const normOrg = (report.organismo_control || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          return selectedDescs.includes(normOrg);
        });
      }
    }

    if (searchTerm) {
      result = result.filter(report => 
        report.departamento?.toLowerCase().includes(searchTerm) ||
        report.informe?.toLowerCase().includes(searchTerm) ||
        report.memorando_nro?.toLowerCase().includes(searchTerm) ||
        report.organismo_control?.toLowerCase().includes(searchTerm) ||
        report.responsables?.some(resp => resp.nombres_apellidos?.toLowerCase().includes(searchTerm)) ||
        report.conclusiones?.some(concl => concl.texto?.toLowerCase().includes(searchTerm)) ||
        report.recomendaciones?.some(recom => recom.texto?.toLowerCase().includes(searchTerm))
      );
    }

    this.filteredReports = result;
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  private updateDisplayedReports(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(start, end);
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      console.warn('No hay datos para exportar');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE DE RECOMENDACIONES POR DEPARTAMENTO'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Ente de Control:', this.getOrganismosSeleccionadosLabel()],
        ['Estado de Seguimiento:', this.getEstadoSeguimientoDescripcion(this.estadoSegControl.value ?? 0)],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        [''],  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación
      const dataToExport = this.reports.map(report => {
        return {
          'Departamento': report.departamento,
          'Informe': report.informe,
          'Memorando': report.memorando_nro,
          'Ente de Control': report.organismo_control,
          'Responsables': report.responsables.map(resp => resp.nombres_apellidos).join('; '),
          'Conclusiones': report.conclusiones.map(concl => concl.texto).join('; '),
          'Recomendaciones': report.recomendaciones.map(recom => `${recom.texto} (Fecha a cumplir: ${recom.fecha_a_cumplir})`).join('; ')
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
        { wch: 50 }, // Informe
        { wch: 20 }, // Memorando
        { wch: 25 }, // Ente de Control
        { wch: 35 }, // Responsables
        { wch: 50 }, // Conclusiones
        { wch: 60 }  // Recomendaciones
      ];
      
      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Departamentos');

      // Generar archivo con codificación UTF-8
      const today = new Date();
      const fileName = `reporte_departamentos_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      
      // Escribir archivo con opciones para UTF-8
      XLSX.writeFile(workbook, fileName, {
        bookType: 'xlsx',
        type: 'binary',
        cellStyles: true,
        compression: true
      });
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
    }
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

  private getOrganismoControlDescripcion(codigo: string | number): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const organismo = this.organismosControl.find(org => 
      Number(org.ainoc_codigo) === codigoNum
    );
    return organismo ? organismo.ainoc_descripcion : 'Todos';
  }

  private getEstadoSeguimientoDescripcion(codigo: string | number): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const estado = this.estadosSeguimiento.find(est => 
      Number(est.arees_codigo) === codigoNum
    );
    return estado ? estado.arees_descripcion : 'Todos';
  }
}
