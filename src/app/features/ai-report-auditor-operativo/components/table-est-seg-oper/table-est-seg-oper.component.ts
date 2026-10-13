import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportsAuditorOperService } from '@features/ai-report-auditor-operativo/services/reports-auditor-oper.service';
import { ReportEstadoSeguimiento } from '@features/ai-report-auditor-operativo/models/reports-auditor-oper';
import { EstadoSeguimiento } from '@features/ai-seg-configuracion/models/Estado-Seg';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import * as XLSX from 'xlsx';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface ParsedResponsable {
  prefix: string;
  nombre: string;
  estado: string;
  fecha?: string;
  plazo?: string;
  isVencido?: boolean;
  isCumplido?: boolean;
}

export interface ProcessedReportEstadoSeguimiento extends ReportEstadoSeguimiento {
  parsedResponsables?: ParsedResponsable[];
  firstObs?: { prefix: string; content: string };
  parsedObservaciones?: { prefix: string; content: string }[];
  obsCount?: number;
  formattedFechaMaxima?: string;
}

import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';

@Component({
  selector: 'app-table-est-seg-oper',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, StatusColorPipe, ReportLoadingComponent],
  templateUrl: './table-est-seg-oper.component.html',
  styleUrl: './table-est-seg-oper.component.css'
})
export class TableEstSegOperComponent implements OnInit, OnDestroy {
  private auxiliaryService: AuxiliaryService = inject(AuxiliaryService);
  private readonly router: Router = inject(Router);
  protected filterForm: FormGroup;
  protected reports: ProcessedReportEstadoSeguimiento[] = [];
  protected displayedReports: ProcessedReportEstadoSeguimiento[] = [];
  protected filteredReports: ProcessedReportEstadoSeguimiento[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;
  protected departamentos: string[] = [];
  protected estadosSeguimiento: EstadoSeguimiento[] = [];
  private originalOrder: ProcessedReportEstadoSeguimiento[] = [];
  private readonly filterStateService = inject(FilterStateService);
  private subscriptions: Subscription = new Subscription();
  private reportSub?: Subscription;

  // Estados para modales de detalle completo
  public selectedObservacion: { title: string; items: { prefix: string; content: string }[] } | null = null;
  public selectedTextDetail: { title: string; content: string } | null = null;

  // Control de Floating Dialog Portal (renderizado fuera de la tabla para cero desbordes)
  public activeFloating: {
    id: string;
    type: 'text' | 'responsables' | 'observaciones';
    title: string;
    rawText: string;
    x: number;
    y?: number | null;
    bottom?: number | null;
    openAbove?: boolean;
    width: number;
    maxHeight?: number;
    content?: string;
    responsables?: ParsedResponsable[];
    observaciones?: { prefix: string; content: string }[];
    report?: ReportEstadoSeguimiento;
  } | null = null;
  public isFloatingPinned = false;
  private hideTimeout: any = null;
  public copiedId: string | null = null;

  public showFloating(
    event: MouseEvent,
    type: 'text' | 'responsables' | 'observaciones',
    data: {
      title?: string;
      rawText?: string;
      content?: string;
      responsables?: ParsedResponsable[];
      observaciones?: { prefix: string; content: string }[];
      report?: ReportEstadoSeguimiento;
    },
    id: string
  ): void {
    this.cancelHide();
    if (this.isFloatingPinned && this.activeFloating?.id === id) {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();

    let width = 360;
    if (type === 'responsables') {
      width = 400;
    } else if (type === 'observaciones') {
      width = 380;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Abrir hacia arriba en filas inferiores:
    // Si hay menos de 380px abajo y suficiente espacio arriba (> 150px),
    // o si estamos en la mitad inferior de la pantalla (spaceAbove > spaceBelow) y hay al menos 180px arriba
    const openAbove = (spaceBelow < 380 && spaceAbove > 150) || (spaceAbove > spaceBelow && spaceAbove > 180);

    let y: number | null = null;
    let bottom: number | null = null;
    let maxHeight = 380;

    if (openAbove) {
      // Anclado por el borde inferior justo 6px arriba de la celda/fila
      bottom = window.innerHeight - rect.top + 6;
      maxHeight = Math.min(420, Math.max(160, rect.top - 20));
    } else {
      // Anclado por el borde superior justo 6px abajo de la celda/fila
      y = rect.bottom + 6;
      maxHeight = Math.min(420, Math.max(160, spaceBelow - 20));
    }

    // Ajuste horizontal para que nunca desborde la pantalla por la derecha
    let x = rect.left;
    if (x + width > window.innerWidth - 20) {
      x = Math.max(10, window.innerWidth - width - 20);
    }

    this.activeFloating = {
      id,
      type,
      title: data.title || '',
      rawText: data.rawText || '',
      content: data.content,
      responsables: data.responsables,
      observaciones: data.observaciones,
      report: data.report,
      x,
      y,
      bottom,
      openAbove,
      width,
      maxHeight
    };
    this.isFloatingPinned = false;
  }

  public scheduleHideFloating(): void {
    if (this.isFloatingPinned) return;
    this.hideTimeout = setTimeout(() => {
      if (!this.isFloatingPinned) {
        this.activeFloating = null;
      }
    }, 250);
  }

  public cancelHide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  public togglePinFloating(
    event: MouseEvent,
    type: 'text' | 'responsables' | 'observaciones',
    data: any,
    id: string
  ): void {
    event.stopPropagation();
    if (this.activeFloating?.id === id && this.isFloatingPinned) {
      this.closeFloating();
      return;
    }
    this.showFloating(event, type, data, id);
    this.isFloatingPinned = true;
  }

  public closeFloating(event?: Event): void {
    if (event) event.stopPropagation();
    this.activeFloating = null;
    this.isFloatingPinned = false;
    this.cancelHide();
  }

  public irARecomendacion(report: ReportEstadoSeguimiento, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.closeFloating();

    // Determinar año para el filtro a partir de aprobación, memorando o fecha máxima
    let anio: number | undefined;
    if (report.fechaAprobacion) {
      const match = report.fechaAprobacion.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) anio = parseInt(match[1], 10);
    }
    if (!anio && report.memorandoAI) {
      const match = report.memorandoAI.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) anio = parseInt(match[1], 10);
    }
    if (!anio && report.fechaMaximaRecomendacion) {
      const match = report.fechaMaximaRecomendacion.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) anio = parseInt(match[1], 10);
    }

    const queryParams: Record<string, any> = {
      fromReport: 'true',
    };

    if (report.codigoRecomendacion) {
      queryParams['arere'] = report.codigoRecomendacion;
    }
    if (report.codigoInforme) {
      queryParams['ainin'] = report.codigoInforme;
    }
    if (report.memorandoAI) {
      queryParams['memo'] = report.memorandoAI.trim();
    }
    if (report.numeroRecomendacion) {
      queryParams['recNum'] = report.numeroRecomendacion;
    }
    if (anio) {
      queryParams['anio'] = anio;
    }

    this.router.navigate(['/inicio/recomendaciones'], { queryParams });
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.floating-portal-card') && !target.closest('.floating-trigger-btn')) {
      this.closeFloating();
    }
  }

  public copyToClipboard(text?: string | null, id?: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (id) {
        this.copiedId = id;
        setTimeout(() => {
          if (this.copiedId === id) this.copiedId = null;
        }, 2000);
      }
    });
  }

  /**
   * Parsea la cadena de funcionarios responsables con formato:
   * "R1: JUAN PEREZ (JUSTIFICA | 2026-10-31 | +30d)" o "R1: JUAN PEREZ (JUSTIFICA)"
   */
  public parseResponsables(text?: string | null): ParsedResponsable[] {
    if (!text) return [];
    const rawParts = text.includes('R') ? text.split(/,\s*(?=R\d+:)/i) : text.split(/,\s*/);
    const result: ParsedResponsable[] = [];
    for (const rawPart of rawParts) {
      const part = rawPart.trim().replace(/,\s*$/, '');
      if (!part) continue;

      let prefix = '';
      let nombre = part;
      let meta = '';

      const match = part.match(/^(R\d+:?)\s*(.*?)(?:\s*\((.*?)\))?$/i);
      if (match && match[1]) {
        prefix = match[1].trim();
        nombre = match[2] ? match[2].trim() : '';
        meta = match[3] ? match[3].trim() : '';
      } else {
        const parenMatch = part.match(/^(.*?)(?:\s*\((.*?)\))?$/);
        if (parenMatch && parenMatch[2]) {
          nombre = parenMatch[1] ? parenMatch[1].trim() : '';
          meta = parenMatch[2] ? parenMatch[2].trim() : '';
        }
      }

      let estado = meta;
      let fecha: string | undefined = undefined;
      let plazo: string | undefined = undefined;
      let isVencido = false;
      let isCumplido = false;

      if (meta && meta.includes('|')) {
        const metaParts = meta.split('|').map(s => s.trim());
        estado = metaParts[0] || '';
        fecha = metaParts[1] || undefined;
        plazo = metaParts[2] || undefined;
      }

      const estUpper = estado.toUpperCase();
      if (estUpper === 'JUSTIFICA' || estUpper === 'JUSTIFICADO' || estUpper === 'VERIFICABLE JUSTIFICADO' || estUpper === 'CUMPLIDA') {
        isCumplido = true;
      } else if (plazo && plazo.startsWith('-')) {
        isVencido = true;
      }

      result.push({ prefix, nombre, estado, fecha, plazo, isVencido, isCumplido });
    }
    return result;
  }

  /**
   * Parsea observaciones con formato "OBS1 - R1: Texto; OBS2 - R2: Texto"
   * Separando el prefijo para poder resaltarlo en negrita.
   */
  public parseObservaciones(text?: string | null): { prefix: string; content: string }[] {
    if (!text) return [];
    const parts = text.split(/;\s*(?=OBS\d*\s*-\s*R\d*:)/i).map(s => s.trim()).filter(Boolean);
    return parts.map(part => {
      const match = part.match(/^(OBS\d*\s*-\s*R\d*:?)\s*(.*)$/i);
      if (match) {
        return { prefix: match[1].trim(), content: match[2].trim() };
      }
      return { prefix: '', content: part };
    });
  }

  public getFirstObs(text?: string | null): { prefix: string; content: string } {
    const list = this.parseObservaciones(text);
    return list[0] || { prefix: '', content: '' };
  }

  /**
   * Determina si el dropdown debe abrirse hacia arriba para no cortar ni desbordar la tabla.
   * Las primeras 3 filas (índices 0, 1, 2) NUNCA abren hacia arriba para evitar cortarse con la cabecera.
   * Si la tabla tiene 5 o menos registros, siempre abre hacia abajo (el contenedor tiene suficiente espacio).
   * Solo en tablas con 6 o más registros, las últimas 2 filas abren hacia arriba con espacio libre holgado.
   */
  public isDropdownTop(index: number): boolean {
    const total = this.displayedReports ? this.displayedReports.length : 0;
    if (index < 3) {
      return false;
    }
    if (total <= 5) {
      return false;
    }
    return index >= (total - 2);
  }

  public openObsModal(report: ReportEstadoSeguimiento): void {
    const obs = report.observacionAuditora || report.observacionVerificable;
    if (!obs) return;
    this.selectedObservacion = {
      title: report.recomendacion ? `Recomendación: ${report.recomendacion.slice(0, 70)}...` : 'Observaciones',
      items: this.parseObservaciones(obs)
    };
  }

  public closeObsModal(): void {
    this.selectedObservacion = null;
  }

  public getObservacionesRawText(): string {
    if (!this.selectedObservacion || !this.selectedObservacion.items) return '';
    return this.selectedObservacion.items.map(i => `${i.prefix} ${i.content}`).join('\n\n');
  }

  public openTextModal(title: string, content?: string | null): void {
    if (!content) return;
    this.selectedTextDetail = { title, content };
  }

  public closeTextModal(): void {
    this.selectedTextDetail = null;
  }

  constructor(
    private formBuilder: FormBuilder,
    private reportsService: ReportsAuditorOperService,
    private alertsService: AlertsStateService
  ) {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);

    // Inicializar formulario con valores por defecto para enviar al servicio
    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        departamento: ['0'], // "0" para "Todos" en el servicio
        estadoSeguimiento: [0], // 0 para "Todos"
        searchTerm: [''] // Nuevo filtro por palabra clave
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_est_seg_oper');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.cargarDepartamentos();
    this.cargarEstadosSeguimiento();
    this.cargarOrganismos();

    this.subscriptions.add(
      this.filterForm.valueChanges.subscribe((val) => {
        this.filterStateService.setFilters('rep_est_seg_oper', val);
      })
    );

    // Cargar datos iniciales
    this.applyFilter();

    // Configurar listeners de cambios con debounce para evitar cascadas y llamadas simultáneas
    this.configureFormChanges();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.reportSub) {
      this.reportSub.unsubscribe();
    }
    this.cancelHide();
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      departamento: '0',
      estadoSeguimiento: 0,
      searchTerm: ''
    }, { emitEvent: false });

    this.organismosSeleccionados = [];
    this.filterStateService.clearFilters('rep_est_seg_oper');
    this.resetPaginationAndApplyFilter();
  }

  protected organismos: OrganismoControl[] = [];
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

  private cargarOrganismos(): void {
    this.reportsService.getOrganismos().subscribe({
      next: (response) => {
        this.organismos = response.datos || [];
      },
      error: () => {
        this.alertsService.showAlert('Error al cargar los organismos de control', 'error');
      }
    });
  }

  private cargarDepartamentos(): void {
    this.reportsService.getDepartamentos().subscribe({
      next: (response) => {
        this.departamentos = response.datos;
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al cargar los departamentos', 'error');
      }
    });
  }

  private cargarEstadosSeguimiento(): void {
    this.reportsService.getEstadoSeg().subscribe({
      next: (response) => {
        this.estadosSeguimiento = response.datos;
      },
      error: (error: any) => {
        this.alertsService.showAlert('Error al cargar los estados de seguimiento', 'error');
      }
    });
  }

  private configureFormChanges(): void {
    // Escuchar cambios en fechas, departamento y estado de seguimiento con debounce
    this.subscriptions.add(
      this.startDateControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.resetPaginationAndApplyFilter();
      })
    );

    this.subscriptions.add(
      this.endDateControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.resetPaginationAndApplyFilter();
      })
    );

    this.subscriptions.add(
      this.departamentoControl.valueChanges.pipe(
        debounceTime(200),
        distinctUntilChanged()
      ).subscribe(() => {
        this.resetPaginationAndApplyFilter();
      })
    );

    this.subscriptions.add(
      this.estadoSeguimientoControl.valueChanges.pipe(
        debounceTime(200),
        distinctUntilChanged()
      ).subscribe(() => {
        this.resetPaginationAndApplyFilter();
      })
    );

    // Escuchar cambios en el filtro de búsqueda (solo aplica filtro local)
    this.subscriptions.add(
      this.searchTermControl.valueChanges.pipe(
        debounceTime(250),
        distinctUntilChanged()
      ).subscribe(() => {
        this.applySearchFilter();
      })
    );
  }

  private resetPaginationAndApplyFilter(): void {
    this.currentPage = 1;
    this.applyFilter();
  }

  private parseDateToTime(dateStr?: string | null): number {
    if (!dateStr) return 0;
    const time = new Date(dateStr).getTime();
    return isNaN(time) ? 0 : time;
  }

  protected applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      
      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      const departamento = this.departamentoControl.value || '0';
      const estadoSeguimiento = parseInt(this.estadoSeguimientoControl.value) || 0;
      const user = this.auxiliaryService.getUserCuenta();

      if (this.reportSub) {
        this.reportSub.unsubscribe();
      }
      
      this.reportSub = this.reportsService.getReportByEstadoSeg(startDate, endDate, departamento, estadoSeguimiento, user)
        .subscribe({
          next: (response) => {
            const rawData = response.datos || [];
            
            // Pre-procesar campos calculados una sola vez al recibir los datos (cero costo en template)
            this.reports = rawData.map(r => {
              const parsedResps = this.parseResponsables(r.funcionarioResponsable);
              const obsText = r.observacionAuditora || r.observacionVerificable;
              const parsedObs = this.parseObservaciones(obsText);
              return {
                ...r,
                parsedResponsables: parsedResps,
                parsedObservaciones: parsedObs,
                firstObs: parsedObs[0] || { prefix: '', content: '' },
                obsCount: parsedObs.length,
                formattedFechaMaxima: this.formatDateToDisplay(r.fechaMaximaRecomendacion)
              };
            });
            this.hasData = this.reports.length > 0;
            
            // Agrupar por informe: desde el más actual hasta el más antiguo por fecha de aprobación,
            // y recomendaciones ordenadas de 1 a n
            this.reports.sort((a, b) => {
              // 1. Por fecha de aprobación de informe descendente (más actual primero)
              const timeA = this.parseDateToTime(a.fechaAprobacion);
              const timeB = this.parseDateToTime(b.fechaAprobacion);
              if (timeA !== timeB) {
                return timeB - timeA;
              }
              // 2. Agrupado por informe (título o memorando)
              const titleA = a.tituloInforme || a.memorandoAI || '';
              const titleB = b.tituloInforme || b.memorandoAI || '';
              if (titleA !== titleB) {
                return titleA < titleB ? -1 : 1;
              }
              // 3. Recomendaciones ordenadas de 1 a n ascendente
              const numA = a.numeroRecomendacion != null ? a.numeroRecomendacion : 999999;
              const numB = b.numeroRecomendacion != null ? b.numeroRecomendacion : 999999;
              if (numA !== numB) {
                return numA - numB;
              }
              const recA = a.recomendacion || '';
              const recB = b.recomendacion || '';
              return recA < recB ? -1 : (recA > recB ? 1 : 0);
            });
            
            this.originalOrder = [...this.reports];
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

  private normalizeText(text: string): string {
    return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private applySearchFilter(): void {
    const searchTerm = this.searchTermControl.value?.toLowerCase().trim() || '';
    let result = [...this.reports];

    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map((cod: number) => {
          const org = this.organismos.find(o => Number(o.ainoc_codigo) === cod);
          return org ? org.ainoc_descripcion : '';
        })
        .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
        .map((desc: string) => this.normalizeText(desc));

      if (selectedDescs.length > 0) {
        result = result.filter(report => {
          const normOrg = this.normalizeText(report.organismoControl || '');
          return selectedDescs.includes(normOrg);
        });
      }
    }

    if (searchTerm) {
      result = result.filter(report => 
        report.departamento?.toLowerCase().includes(searchTerm) ||
        report.funcionarioResponsable?.toLowerCase().includes(searchTerm) ||
        report.tituloInforme?.toLowerCase().includes(searchTerm) ||
        report.organismoControl?.toLowerCase().includes(searchTerm) ||
        report.memorandoAI?.toLowerCase().includes(searchTerm) ||
        report.memorandoAprobacion?.toLowerCase().includes(searchTerm) ||
        report.conclusion?.toLowerCase().includes(searchTerm) ||
        report.recomendacion?.toLowerCase().includes(searchTerm) ||
        (report.observacionAuditora || report.observacionVerificable || '')?.toLowerCase().includes(searchTerm)
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

  get estadoSeguimientoControl(): FormControl {
    return this.filterForm.get('estadoSeguimiento') as FormControl;
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

  protected formatDateToDisplay(dateStr: string): string {
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

  private getEstadoSeguimientoDescripcion(codigo: number): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos';
    
    const estado = this.estadosSeguimiento.find(est => Number(est.arees_codigo) === codigoNum);
    return estado ? estado.arees_descripcion : 'Todos';
  }

  private getDepartamentoDescripcion(codigo: string): string {
    if (codigo === '0' || !codigo) return 'Todos';
    return codigo;
  }

  protected listarEvidencias(texto?: string | null): string[] {
    const contenido = texto?.trim() || '';
    if (!contenido) return [];
    return /^1[.)]\s+/.test(contenido)
      ? contenido.split(/(?:\r?\n)+(?=\d+[.)]\s+)/).map(item => item.replace(/^\d+[.)]\s+/, ''))
      : [contenido];
  }

  protected exportToExcel(): void {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'info');
      return;
    }

    try {
      // Preparar encabezado con información de los filtros
      const headerData = [
        ['REPORTE DE ESTADO DE SEGUIMIENTO'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Departamento:', this.getDepartamentoDescripcion(this.departamentoControl.value)],
        ['Estado Seguimiento:', this.getEstadoSeguimientoDescripcion(parseInt(this.estadoSeguimientoControl.value))],
        ['Palabra Clave:', this.searchTermControl.value || 'Ninguna'],
        ['Usuario:', this.auxiliaryService.getUserCuenta()],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']  // Fila en blanco antes de los datos
      ];

      // Preparar los datos para la exportación por recomendación (1 fila por recomendación)
      const dataToExport = this.filteredReports.map(report => ({
        'Título Informe': report.tituloInforme,
        'Conclusión': report.conclusion,
        'Recomendación': report.numeroRecomendacion ? `R${report.numeroRecomendacion}: ${report.recomendacion}` : report.recomendacion,
        'Memorando AI': report.memorandoAI,
        'Memorando Aprobación': report.memorandoAprobacion,
        'Departamento': report.departamento,
        'Responsable': report.funcionarioResponsable,
        'Observación de la Auditora': report.observacionAuditora || report.observacionVerificable || '',
        'Fecha Máxima': this.formatDateToDisplay(report.fechaMaximaRecomendacion),
        'Estado Recomendación': report.estadoSeguimiento || '',
        'Riesgo': report.riesgoVerificado || 'Sin registrar',
        'Evidencias requeridas': report.evidenciaRequerida || 'Sin registrar',
        'Ente de Control': report.organismoControl
      }));

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
        { wch: 35 }, // Título Informe
        { wch: 40 }, // Conclusión
        { wch: 40 }, // Recomendación
        { wch: 20 }, // Memorando AI
        { wch: 20 }, // Memorando Aprobación
        { wch: 25 }, // Departamento
        { wch: 40 }, // Responsable
        { wch: 50 }, // Observación de la Auditora
        { wch: 15 }, // Fecha Máxima
        { wch: 20 }, // Estado Recomendación
        { wch: 18 }, // Riesgo
        { wch: 60 }, // Evidencias requeridas
        { wch: 25 }  // Ente de Control
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
