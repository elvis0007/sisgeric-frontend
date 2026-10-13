import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { Report7Auditores, ResponsableReporte7 } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { inject } from '@angular/core';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-report7-auditores',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-report7-auditores.component.html',
  styleUrl: './table-report7-auditores.component.css'
})
export class TableReport7AuditoresComponent implements OnInit {
  protected filterForm: FormGroup;
  protected reports: Report7Auditores[] = [];
  protected displayedReports: Report7Auditores[] = [];
  protected filteredReports: Report7Auditores[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;
  protected auditores: UsuarioAuditor[] = [];

  private readonly modalResponsablesSrv: ModalResponsablesService = inject(ModalResponsablesService);
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
        auditor: ['0']
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_report7_auditores');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.loadAuditores();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_report7_auditores', val);
    });

    this.applyFilter();
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      auditor: '0'
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rep_report7_auditores');
    this.resetPaginationAndApplyFilter();
  }

  private loadAuditores(): void {
    this.reportsService.getAuditores().subscribe({
      next: (response) => {
        if (response.datos && response.datos.usuarios) {
          this.auditores = response.datos.usuarios;
        } else {
          this.auditores = [];
        }
      },
      error: (error) => {
        console.error('Error al cargar auditores:', error);
        this.auditores = [];
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

    this.auditorControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
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
      const auditor = this.auditorControl.value || '0';
      
      console.log('Aplicando filtro con:', { startDate, endDate, auditor });
      
      this.reportsService.getReport7Auditores(startDate, endDate, auditor)
        .subscribe({
          next: (response) => {
            console.log('Respuesta del servicio:', response);
            this.reports = response.datos || [];
            console.log('Reportes cargados:', this.reports.length);
            this.hasData = this.reports.length > 0;
            
            this.currentPage = 1;
            this.filteredReports = [...this.reports];
            this.updateDisplayedReports();
            this.isLoading = false;
          },
          error: (error: any) => {
            console.error('Error al cargar los reportes:', error);
            console.error('Detalles del error:', JSON.stringify(error, null, 2));
            this.alertsService.showAlert('Error al cargar los reportes: ' + (error.error?.mensaje || error.message || 'Error desconocido'), 'error');
            this.reports = [];
            this.filteredReports = [];
            this.displayedReports = [];
            this.hasData = false;
            this.isLoading = false;
          }
        });
    } else {
      console.log('Formulario inválido:', this.filterForm.errors);
    }
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

  get auditorControl(): FormControl {
    return this.filterForm.get('auditor') as FormControl;
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

  protected getResponsablesCount(responsables?: ResponsableReporte7[]): number {
    if (!responsables || responsables.length === 0) return 0;
    return responsables.length;
  }

  protected openModalResponsables(arereCodigo: number): void {
    if (arereCodigo) {
      // Buscar el reporte que contiene los responsables
      const report = this.reports.find(r => r.arereCodigo === arereCodigo);
      if (report && report.responsables) {
        this.modalResponsablesSrv.openModal({
          id_rec: arereCodigo,
          filterNoJustificados: false,
          isReporte7: true,
          responsablesReporte7: report.responsables
        });
      } else {
        this.modalResponsablesSrv.openModal({
          id_rec: arereCodigo,
          filterNoJustificados: false
        });
      }
    }
  }

  protected calcularTiempoExcedido(fechaCarga: string | null | undefined, fechaCambio: string | null | undefined): string | null {
    if (!fechaCarga || !fechaCambio) {
      return null;
    }

    try {
      const parseFecha = (fechaStr: string): Date => {
        const [fecha, hora] = fechaStr.split(' ');
        const [dia, mes, anio] = fecha.split('/');
        const [horas, minutos, segundos] = hora.split(':');
        return new Date(
          parseInt(anio),
          parseInt(mes) - 1,
          parseInt(dia),
          parseInt(horas),
          parseInt(minutos),
          parseInt(segundos)
        );
      };

      const fechaCargaDate = parseFecha(fechaCarga);
      const fechaCambioDate = parseFecha(fechaCambio);

      const diferenciaMs = fechaCambioDate.getTime() - fechaCargaDate.getTime();
      const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
      const horasLimite = 24;

      if (diferenciaHoras > horasLimite) {
        const horasExcedidas = diferenciaHoras - horasLimite;
        const dias = Math.floor(horasExcedidas / 24);
        const horas = Math.floor(horasExcedidas % 24);
        const minutos = Math.floor((horasExcedidas % 1) * 60);

        let tiempoExcedido = '';
        if (dias > 0) {
          tiempoExcedido += `${dias} día${dias > 1 ? 's' : ''} `;
        }
        if (horas > 0) {
          tiempoExcedido += `${horas} hora${horas > 1 ? 's' : ''} `;
        }
        if (minutos > 0 && dias === 0) {
          tiempoExcedido += `${minutos} minuto${minutos > 1 ? 's' : ''}`;
        }

        return tiempoExcedido.trim();
      }

      return null;
    } catch (error) {
      console.error('Error al calcular tiempo excedido:', error);
      return null;
    }
  }

  protected exportToExcel(): void {
    if (!this.reports || this.reports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      const headerData = [
        ['REPORTE POR AUDITOR'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Auditor:', this.auditorControl.value === '0' ? 'Todos' : this.auditorControl.value],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']
      ];

      const dataToExport: any[] = [];
      this.reports.forEach(report => {
        const informeData = {
          'Título Informe': report.tituloInforme || '',
          'Recomendación': report.recomendacion || '',
          'Ente de Control': report.enteControl || '',
          'Memorando': report.memorando || '',
          'Memo Aprobación': report.memoAprobacion || '',
          'Fecha Emisión': this.formatDateToDisplay(report.fechaEmision) || '',
          'Fecha Máxima': this.formatDateToDisplay(report.fechaMaxima) || '',
          'Auditor': report.auditor || ''
        };

        if (report.responsables && report.responsables.length > 0) {
          report.responsables.forEach((responsable) => {
            dataToExport.push({
              ...informeData,
              'Responsable': responsable.nombreCompleto || '',
              'Estado Verificable': responsable.estadoVerificable || 'No disponible',
              'Fecha y Hora Carga Verificable': responsable.fechaHoraCargaVerificable || 'No disponible',
              'Fecha y Hora Cambio Estado': responsable.fechaHoraCambioEstado || 'No disponible',
              'Tiempo Excedido': this.calcularTiempoExcedido(responsable.fechaHoraCargaVerificable, responsable.fechaHoraCambioEstado) || 'No excedido',
              'Observación': responsable.observacion || 'No hay observación'
            });
          });
        } else {
          dataToExport.push({
            ...informeData,
            'Responsable': 'No hay responsables',
            'Estado Verificable': '',
            'Fecha y Hora Carga Verificable': '',
            'Fecha y Hora Cambio Estado': '',
            'Tiempo Excedido': '',
            'Observación': ''
          });
        }
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
        { wch: 30 },
        { wch: 40 },
        { wch: 25 },
        { wch: 30 },
        { wch: 30 },
        { wch: 20 },
        { wch: 50 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Por_Auditor');

      const today = new Date();
      const fileName = `reporte_por_auditor_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;
      
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

