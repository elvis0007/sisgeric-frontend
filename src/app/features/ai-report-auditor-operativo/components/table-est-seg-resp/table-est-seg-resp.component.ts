import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { ReportsAuditorOperService } from '@features/ai-report-auditor-operativo/services/reports-auditor-oper.service';
import { ReportSeguimientoResponsable } from '@features/ai-report-auditor-operativo/models/reports-auditor-oper';
import { EstadoSeguimiento } from '@features/ai-seg-configuracion/models/Estado-Seg';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import * as XLSX from 'xlsx';

import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';

@Component({
  selector: 'app-table-est-seg-resp',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, StatusColorPipe, ReportLoadingComponent],
  templateUrl: './table-est-seg-resp.component.html',
  styleUrl: './table-est-seg-resp.component.css'
})
export class TableEstSegRespComponent implements OnInit {

  protected filterForm: FormGroup;
  protected reports: ReportSeguimientoResponsable[] = [];
  protected filteredReports: ReportSeguimientoResponsable[] = [];
  protected displayedReports: ReportSeguimientoResponsable[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 5;

  protected estadosSeguimiento: EstadoSeguimiento[] = [];
  protected estadosVerificableDisponibles: string[] = [];
  protected organismos: OrganismoControl[] = [];
  protected organismosSeleccionados: number[] = [];
  protected departamentos: string[] = [];

  protected estadoRecDropdownOpen = false;
  protected estadoVerificableDropdownOpen = false;

  private readonly filterStateService = inject(FilterStateService);
  private readonly auxiliaryService = inject(AuxiliaryService);
  private readonly reportsService = inject(ReportsAuditorOperService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly formBuilder = inject(FormBuilder);

  // Floating Portal Card (sin desbordes ni problemas de viewport)
  public activeFloating: {
    id: string;
    title: string;
    rawText: string;
    content?: string;
    x: number;
    y?: number | null;
    bottom?: number | null;
    openAbove?: boolean;
    width: number;
    maxHeight?: number;
  } | null = null;
  public isFloatingPinned = false;
  private hideTimeout: any = null;
  public copiedId: string | null = null;

  // Modal para textos completos
  public selectedModalTitle = '';
  public selectedModalText = '';

  constructor() {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    this.filterForm = this.formBuilder.group({
      startDate: [this.formatDate(firstDayOfYear)],
      endDate: [this.formatDate(today)],
      organismoControl: ['0'],
      estadoSeg: [[]],
      estadoVerificable: [[]],
      departamento: ['0'],
      searchTerm: ['']
    });
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_est_seg_resp');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
      if (savedFilters.organismosSeleccionados) {
        this.organismosSeleccionados = savedFilters.organismosSeleccionados;
      }
    }

    this.cargarCombos();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_est_seg_resp', {
        ...val,
        organismosSeleccionados: this.organismosSeleccionados
      });
    });

    this.applyFilter();
  }

  public get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  public get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  public get departamentoControl(): FormControl {
    return this.filterForm.get('departamento') as FormControl;
  }

  public get estadoSegControl(): FormControl {
    return this.filterForm.get('estadoSeg') as FormControl;
  }

  public get estadoVerificableControl(): FormControl {
    return this.filterForm.get('estadoVerificable') as FormControl;
  }

  public get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateToTime(dateStr: string | null | undefined): number {
    if (!dateStr) return 0;
    const trimmed = dateStr.trim();
    // DD/MM/YYYY o DD/MM/YYYY HH:MM:SS
    const firstPart = trimmed.split(' ')[0];
    const parts = firstPart.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day).getTime();
    }
    // YYYY-MM-DD
    const isoParts = firstPart.split('-');
    if (isoParts.length === 3) {
      const year = parseInt(isoParts[0], 10);
      const month = parseInt(isoParts[1], 10) - 1;
      const day = parseInt(isoParts[2], 10);
      return new Date(year, month, day).getTime();
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  private configureFormChanges(): void {
    this.startDateControl.valueChanges.subscribe(() => this.reloadReport());
    this.endDateControl.valueChanges.subscribe(() => this.reloadReport());
    this.departamentoControl.valueChanges.subscribe(() => this.applySearchFilter());
    this.estadoSegControl.valueChanges.subscribe(() => this.applySearchFilter());
    this.estadoVerificableControl.valueChanges.subscribe(() => this.applySearchFilter());
    this.searchTermControl.valueChanges.subscribe(() => this.applySearchFilter());
  }

  private cargarCombos(): void {
    this.reportsService.getOrganismos().subscribe({
      next: (response) => {
        this.organismos = response.datos || [];
      },
      error: (error) => {
        console.error('Error al cargar organismos:', error);
      }
    });

    this.reportsService.getEstadoSeg().subscribe({
      next: (response) => {
        this.estadosSeguimiento = response.datos || [];
      },
      error: (error) => {
        console.error('Error al cargar estados de seguimiento:', error);
      }
    });

    this.reportsService.getDepartamentos().subscribe({
      next: (response) => {
        this.departamentos = (response.datos || []).sort((a, b) => a.localeCompare(b));
      },
      error: (error) => {
        console.error('Error al cargar departamentos:', error);
      }
    });
  }

  public clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      organismoControl: '0',
      estadoSeg: [],
      estadoVerificable: [],
      departamento: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.organismosSeleccionados = [];
    this.filterStateService.clearFilters('rep_est_seg_resp');
    this.reloadReport();
  }

  public reloadReport(): void {
    this.applyFilter();
  }

  public applyFilter(): void {
    this.isLoading = true;
    const startDate = this.startDateControl.value;
    const endDate = this.endDateControl.value;
    const dpto = this.departamentoControl.value || '0';
    const auditor = this.auxiliaryService.getUserCuenta();

    this.reportsService.getReportSeguimientoPorResponsable(startDate, endDate, 0, 0, auditor, dpto)
      .subscribe({
        next: (response) => {
          this.reports = (response.datos || []).map((report) => ({
            ...report,
            diasVencidos: this.normalizeDiasVencidos(report.estadoPlazo, report.diasVencidos),
          }));

          // Agrupar por informe: desde el más actual hasta el más antiguo por fecha de aprobación/memorando,
          // y recomendaciones ordenadas de 1 a n
          this.reports.sort((a, b) => {
            // 1. Por fecha de informe descendente (más actual primero)
            const timeA = this.parseDateToTime(a.fechaAprobacion || a.fechaMemorando);
            const timeB = this.parseDateToTime(b.fechaAprobacion || b.fechaMemorando);
            if (timeA !== timeB) {
              return timeB - timeA;
            }
            // 2. Agrupado por informe (código o memorando)
            const infCompare = (b.codigoInforme ?? 0) - (a.codigoInforme ?? 0);
            if (infCompare !== 0) {
              return infCompare;
            }
            const memoCompare = (a.memoAuditoria || '').localeCompare(b.memoAuditoria || '');
            if (memoCompare !== 0) {
              return memoCompare;
            }
            // 3. Recomendaciones ordenadas de 1 a n ascendente
            const numA = a.numeroRecomendacion != null && a.numeroRecomendacion > 0 ? a.numeroRecomendacion : (a.codigoRecomendacion ?? 999999);
            const numB = b.numeroRecomendacion != null && b.numeroRecomendacion > 0 ? b.numeroRecomendacion : (b.codigoRecomendacion ?? 999999);
            if (numA !== numB) {
              return numA - numB;
            }
            // 4. Por responsable alfabético
            return (a.responsable || '').localeCompare(b.responsable || '');
          });

          this.estadosVerificableDisponibles = Array.from(
            new Set(
              this.reports
                .map(r => (r.estadoVerificable || '').trim())
                .filter(Boolean)
            )
          ).sort((a, b) => a.localeCompare(b));

          this.hasData = this.reports.length > 0;
          this.applySearchFilter();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al cargar reporte de seguimiento por responsable:', error);
          this.alertsService.showAlert('Error al cargar el reporte', 'error');
          this.reports = [];
          this.filteredReports = [];
          this.displayedReports = [];
          this.hasData = false;
          this.isLoading = false;
        }
      });
  }

  private normalizeDiasVencidos(estadoPlazo: string | null | undefined, diasVencidos: number | null | undefined): number {
    return typeof diasVencidos === 'number' ? Math.abs(diasVencidos) : 0;
  }

  public isVencido(report: any): boolean {
    const st = (report?.estadoPlazo || '').toUpperCase();
    return st.includes('VENCID');
  }

  public isEnPlazo(report: any): boolean {
    const st = (report?.estadoPlazo || '').toUpperCase();
    return st.includes('PLAZO') || st.includes('TIEMPO') || st === 'EN PROCESO';
  }

  public isCumplidaOrNoAplica(report: any): boolean {
    const st = (report?.estadoPlazo || report?.estadoRecomendacion || '').toUpperCase();
    return st.includes('CUMPLID') || st.includes('NO APLICA');
  }

  public getDiasDisplay(report: any): string {
    if (this.isCumplidaOrNoAplica(report)) return '';
    const dias = Math.abs(report?.diasVencidos || 0);
    if (this.isVencido(report)) {
      return `(-${dias} d)`;
    }
    return `(+${dias} d)`;
  }

  public applySearchFilter(): void {
    const term = (this.searchTermControl.value || '').trim().toLowerCase();
    const selectedDept = (this.departamentoControl.value || '0').trim().toLowerCase();
    const selectedEstadoSeg: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    const selectedEstadoVerificable: string[] = this.estadoVerificableControl.value || [];

    this.filteredReports = this.reports.filter((report) => {
      // 1. Filtro Ente de control
      let matchesOrg = true;
      if (this.organismosSeleccionados.length > 0) {
        const orgsDesc = this.organismosSeleccionados
          .map(codigo => this.organismos.find(o => o.ainoc_codigo === codigo)?.ainoc_descripcion?.trim().toLowerCase())
          .filter(Boolean);
        const reportOrg = (report.organismoControl || '').trim().toLowerCase();
        matchesOrg = orgsDesc.some(desc => desc && reportOrg.includes(desc));
      }

      // 2. Filtro Estado recomendación
      let matchesEstadoRec = true;
      if (selectedEstadoSeg.length > 0) {
        const estadosDesc = selectedEstadoSeg
          .map(code => this.estadosSeguimiento.find(e => Number(e.arees_codigo) === code)?.arees_descripcion?.trim().toLowerCase())
          .filter(Boolean);
        const reportEstado = (report.estadoRecomendacion || '').trim().toLowerCase();
        matchesEstadoRec = estadosDesc.some(desc => desc && reportEstado === desc);
      }

      // 3. Filtro Estado verificable
      let matchesEstadoVer = true;
      if (selectedEstadoVerificable.length > 0) {
        const reportEstadoVer = (report.estadoVerificable || '').trim().toLowerCase();
        matchesEstadoVer = selectedEstadoVerificable.some(
          est => est.trim().toLowerCase() === reportEstadoVer
        );
      }

      // 4. Filtro Departamento
      let matchesDept = true;
      if (selectedDept !== '0') {
        const reportDept = (report.departamento || '').trim().toLowerCase();
        matchesDept = reportDept === selectedDept;
      }

      // 5. Filtro Búsqueda libre
      let matchesSearch = true;
      if (term) {
        const searchFields = [
          report.memoAuditoria,
          report.memoPresidencia,
          report.tituloInforme,
          report.organismoControl,
          report.hallazgo,
          report.conclusion,
          report.recomendacion,
          report.responsable,
          report.departamento,
          report.estadoRecomendacion,
          report.estadoVerificable,
          report.descripcionVerificableResponsable,
          report.observacionAuditor
        ].map(f => (f || '').toLowerCase());
        matchesSearch = searchFields.some(f => f.includes(term));
      }

      return matchesOrg && matchesEstadoRec && matchesEstadoVer && matchesDept && matchesSearch;
    });

    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  public updateDisplayedReports(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedReports = this.filteredReports.slice(startIndex, endIndex);
  }

  public onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedReports();
  }

  public onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    this.updateDisplayedReports();
  }

  // Multi-selección Organismos
  public toggleOrganismo(codigo: number | string): void {
    const numericCode = typeof codigo === 'string' ? parseInt(codigo, 10) : codigo;
    const idx = this.organismosSeleccionados.indexOf(numericCode);
    if (idx >= 0) {
      this.organismosSeleccionados.splice(idx, 1);
    } else {
      this.organismosSeleccionados.push(numericCode);
    }
    this.applySearchFilter();
  }

  public toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.applySearchFilter();
  }

  public getOrganismosSeleccionadosLabel(): string {
    if (this.organismosSeleccionados.length === 0) {
      return 'Todos los Entes';
    }
    if (this.organismosSeleccionados.length === 1) {
      const org = this.organismos.find(o => o.ainoc_codigo === this.organismosSeleccionados[0]);
      return org ? org.ainoc_descripcion : '1 seleccionado';
    }
    return `${this.organismosSeleccionados.length} seleccionados`;
  }

  // Multi-selección Estado Recomendación
  public toggleEstadoRecDropdown(): void {
    this.estadoRecDropdownOpen = !this.estadoRecDropdownOpen;
    if (this.estadoRecDropdownOpen) this.estadoVerificableDropdownOpen = false;
  }

  public areAllEstadoRecSelected(): boolean {
    const selected = this.estadoSegControl.value || [];
    return this.estadosSeguimiento.length > 0 && selected.length === this.estadosSeguimiento.length;
  }

  public toggleSelectAllEstadoRec(): void {
    if (this.areAllEstadoRecSelected()) {
      this.estadoSegControl.setValue([]);
    } else {
      this.estadoSegControl.setValue(this.estadosSeguimiento.map(e => e.arees_codigo));
    }
  }

  public isEstadoRecSeleccionado(codigo: number): boolean {
    const selected: number[] = this.estadoSegControl.value || [];
    return selected.includes(codigo);
  }

  public toggleEstadoRec(codigo: number): void {
    const selected: number[] = [...(this.estadoSegControl.value || [])];
    const index = selected.indexOf(codigo);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(codigo);
    }
    this.estadoSegControl.setValue(selected);
  }

  public get estadoRecSeleccionadosTexto(): string {
    const selected: number[] = this.estadoSegControl.value || [];
    if (selected.length === 0) return 'Todos los estados';
    if (selected.length === this.estadosSeguimiento.length) return 'Todos los estados';
    if (selected.length === 1) {
      const estado = this.estadosSeguimiento.find(e => Number(e.arees_codigo) === selected[0]);
      return estado ? estado.arees_descripcion : '1 seleccionado';
    }
    return `${selected.length} seleccionados`;
  }

  // Multi-selección Estado Verificable
  public toggleEstadoVerificableDropdown(): void {
    this.estadoVerificableDropdownOpen = !this.estadoVerificableDropdownOpen;
    if (this.estadoVerificableDropdownOpen) this.estadoRecDropdownOpen = false;
  }

  public areAllEstadoVerificableSelected(): boolean {
    const selected = this.estadoVerificableControl.value || [];
    return this.estadosVerificableDisponibles.length > 0 && selected.length === this.estadosVerificableDisponibles.length;
  }

  public toggleSelectAllEstadoVerificable(): void {
    if (this.areAllEstadoVerificableSelected()) {
      this.estadoVerificableControl.setValue([]);
    } else {
      this.estadoVerificableControl.setValue([...this.estadosVerificableDisponibles]);
    }
  }

  public isEstadoVerificableSeleccionado(estado: string): boolean {
    const selected: string[] = this.estadoVerificableControl.value || [];
    return selected.includes(estado);
  }

  public toggleEstadoVerificable(estado: string): void {
    const selected: string[] = [...(this.estadoVerificableControl.value || [])];
    const index = selected.indexOf(estado);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(estado);
    }
    this.estadoVerificableControl.setValue(selected);
  }

  public get estadoVerificableSeleccionadosTexto(): string {
    const selected: string[] = this.estadoVerificableControl.value || [];
    if (selected.length === 0) return 'Todos los estados';
    if (selected.length === this.estadosVerificableDisponibles.length) return 'Todos los estados';
    if (selected.length === 1) return selected[0];
    return `${selected.length} seleccionados`;
  }

  public closeDropdowns(): void {
    this.estadoRecDropdownOpen = false;
    this.estadoVerificableDropdownOpen = false;
  }

  // Floating Portal Card Logic
  public showFloating(
    event: MouseEvent,
    data: { title: string; content?: string | null; rawText?: string | null },
    id: string
  ): void {
    this.cancelHide();
    if (this.isFloatingPinned && this.activeFloating?.id === id) {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();

    const width = 380;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Apertura hacia arriba en filas inferiores
    const openAbove = (spaceBelow < 380 && spaceAbove > 150) || (spaceAbove > spaceBelow && spaceAbove > 180);

    let y: number | null = null;
    let bottom: number | null = null;
    let maxHeight = 380;

    if (openAbove) {
      bottom = window.innerHeight - rect.top + 6;
      maxHeight = Math.min(420, Math.max(160, rect.top - 20));
    } else {
      y = rect.bottom + 6;
      maxHeight = Math.min(420, Math.max(160, spaceBelow - 20));
    }

    let x = rect.left;
    if (x + width > window.innerWidth - 20) {
      x = Math.max(10, window.innerWidth - width - 20);
    }

    this.activeFloating = {
      id,
      title: data.title || '',
      rawText: data.rawText || data.content || '',
      content: data.content || '',
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
    data: { title: string; content?: string | null; rawText?: string | null },
    id: string
  ): void {
    event.stopPropagation();
    if (this.activeFloating?.id === id && this.isFloatingPinned) {
      this.closeFloating();
      return;
    }
    this.showFloating(event, data, id);
    this.isFloatingPinned = true;
  }

  public closeFloating(event?: Event): void {
    if (event) event.stopPropagation();
    this.activeFloating = null;
    this.isFloatingPinned = false;
    this.cancelHide();
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

  public openTextModal(title: string, content?: string | null): void {
    this.selectedModalTitle = title;
    this.selectedModalText = content || '';
    const modal = document.getElementById('modal_texto_resp') as HTMLDialogElement;
    if (modal) modal.showModal();
  }

  public closeTextModal(): void {
    const modal = document.getElementById('modal_texto_resp') as HTMLDialogElement;
    if (modal) modal.close();
  }

  // Exportar a Excel
  public exportToExcel(): void {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar', 'warning');
      return;
    }

    try {
      const selectedEstadoSeg: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
      const selectedEstadoSegDesc = selectedEstadoSeg
        .map(code => this.estadosSeguimiento.find(e => Number(e.arees_codigo) === code)?.arees_descripcion)
        .filter(Boolean) as string[];
      const estadoRecomendacionFiltro = selectedEstadoSegDesc.length > 0 ? selectedEstadoSegDesc.join(', ') : 'Todos';

      const selectedEstadoVerificable: string[] = this.estadoVerificableControl.value || [];
      const estadoVerificableFiltro = selectedEstadoVerificable.length > 0 ? selectedEstadoVerificable.join(', ') : 'Todos';

      const headerData = [
        ['ESTADO DE SEGUIMIENTO POR RESPONSABLE (AUDITORÍA OPERATIVA)'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.startDateControl.value],
        ['Fecha Hasta:', this.endDateControl.value],
        ['Ente de control:', this.getOrganismosSeleccionadosLabel()],
        ['Estado recomendación:', estadoRecomendacionFiltro],
        ['Estado verificable:', estadoVerificableFiltro],
        ['Departamento:', this.departamentoControl.value === '0' ? 'Todos' : this.departamentoControl.value],
        ['Auditor Operativo:', this.auxiliaryService.getUserCuenta()],
        ['Búsqueda:', (this.searchTermControl.value || '').trim() || 'N/A'],
        ['Fecha de generación:', new Date().toLocaleDateString('es-ES')],
        [''],
      ];

      const dataToExport = this.filteredReports.map(r => ({
        'Código Informe': r.codigoInforme,
        'Memorando Auditoría': r.memoAuditoria,
        'Fecha Memorando': r.fechaMemorando,
        'Memo Presidencia': r.memoPresidencia,
        'Fecha Aprobación': r.fechaAprobacion,
        'Auditor': r.auditor,
        'Título Informe': r.tituloInforme,
        'Organismo de Control': r.organismoControl,
        'Hallazgo': r.hallazgo,
        'Conclusión': r.conclusion,
        'Código Recomendación': r.codigoRecomendacion,
        'Recomendación': r.recomendacion,
        'Fecha Vencimiento': r.fechaVencimiento,
        'Estado Recomendación': r.estadoRecomendacion,
        'Estado Plazo': r.estadoPlazo,
        'Días Vigentes / Restantes': this.isEnPlazo(r) ? Math.abs(r.diasVencidos || 0) : 0,
        'Días Vencidos': this.isVencido(r) ? Math.abs(r.diasVencidos || 0) : 0,
        'Responsable': r.responsable,
        'Departamento': r.departamento,
        'Estado Verificable': r.estadoVerificable,
        'Fecha Carga Verificable': r.fechaCargaVerificable,
        'Obs. Verificable Responsable': r.descripcionVerificableResponsable || '',
        'Obs. Auditora': r.observacionAuditor || '',
        'Progreso Recomendación %': r.progresoRecomendacion,
        'Progreso Informe %': r.progresoInforme,
        'Fecha Consulta': r.fechaConsulta
      }));

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);
      const worksheet = Object.assign({}, worksheetHeader);
      const headerRowCount = headerData.length;

      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });

      worksheet['!cols'] = [
        { wch: 14 },  // Código Informe
        { wch: 20 },  // Memorando Auditoría
        { wch: 16 },  // Fecha Memorando
        { wch: 20 },  // Memo Presidencia
        { wch: 16 },  // Fecha Aprobación
        { wch: 18 },  // Auditor
        { wch: 45 },  // Título Informe
        { wch: 24 },  // Organismo de Control
        { wch: 40 },  // Hallazgo
        { wch: 40 },  // Conclusión
        { wch: 16 },  // Código Recomendación
        { wch: 45 },  // Recomendación
        { wch: 16 },  // Fecha Vencimiento
        { wch: 22 },  // Estado Recomendación
        { wch: 16 },  // Estado Plazo
        { wch: 22 },  // Días Vencidos
        { wch: 30 },  // Responsable
        { wch: 30 },  // Departamento
        { wch: 20 },  // Estado Verificable
        { wch: 20 },  // Fecha Carga Verificable
        { wch: 45 },  // Obs. Verificable Responsable
        { wch: 45 },  // Obs. Auditora
        { wch: 20 },  // Progreso Rec
        { wch: 20 },  // Progreso Inf
        { wch: 16 }   // Fecha Consulta
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Estado_Seg_Responsable');
      const filename = `Estado_Seguimiento_Responsable_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, filename);
      this.alertsService.showAlert('Reporte exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      this.alertsService.showAlert('Error al exportar a Excel', 'error');
    }
  }
}
