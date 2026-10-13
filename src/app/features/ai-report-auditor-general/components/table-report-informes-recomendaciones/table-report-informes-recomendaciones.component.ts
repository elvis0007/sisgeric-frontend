import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportGeneralAIJ, ReportInformesRecomendaciones } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { PeriodoEvaluacionService } from '@features/ai-seguim-auditor-general/services/periodo-evaluacion.service';
import { PeriodoEvaluacion } from '@features/ai-seguim-auditor-general/models/periodo-evaluacion.model';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-report-informes-recomendaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent],
  templateUrl: './table-report-informes-recomendaciones.component.html',
  styleUrl: './table-report-informes-recomendaciones.component.css'
})
export class TableReportInformesRecomendacionesComponent implements OnInit {
  protected filterForm: FormGroup;
  protected filteredReports: ReportInformesRecomendaciones[] = [];
  protected reports: ReportInformesRecomendaciones[] = [];
  protected displayedReports: ReportInformesRecomendaciones[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 10;

  protected organismos: OrganismoControl[] = [];
  protected periodosEvaluacion: PeriodoEvaluacion[] = [];
  protected informesOptions: { id: string; titulo: string }[] = [];

  protected dropdownInformesOpen = false;
  protected searchInformeText = '';

  protected selectedInformes: string[] = [];

  private rawGeneralReports: ReportGeneralAIJ[] = [];
  private readonly filterStateService = inject(FilterStateService);
  private readonly periodoSrv = inject(PeriodoEvaluacionService);

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
        periodoEvaluacion: ['0'],
        informes: [[]],
        organismoControl: ['0']
      },
      { validators: this.dateRangeValidator }
    );
  }

  ngOnInit(): void {
    const savedFilters = this.filterStateService.getFilters('rep_informes_recomendaciones');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
      if (Array.isArray(savedFilters.informes)) {
        this.selectedInformes = [...savedFilters.informes];
      }
    }

    this.cargarCombos();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rep_informes_recomendaciones', val);
    });

    this.applyFilter();
  }

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get periodoEvaluacionControl(): FormControl {
    return this.filterForm.get('periodoEvaluacion') as FormControl;
  }

  get informesControl(): FormControl {
    return this.filterForm.get('informes') as FormControl;
  }

  get organismoControlControl(): FormControl {
    return this.filterForm.get('organismoControl') as FormControl;
  }

  protected organismosSeleccionados: number[] = [];

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm.setValue(
      {
        startDate: this.formatDate(firstDayOfYear),
        endDate: this.formatDate(today),
        periodoEvaluacion: '0',
        informes: [],
        organismoControl: '0'
      },
      { emitEvent: false }
    );

    this.selectedInformes = [];
    this.organismosSeleccionados = [];
    this.searchInformeText = '';
    this.dropdownInformesOpen = false;
    this.filterStateService.clearFilters('rep_informes_recomendaciones');
    this.applyFilter();
  }

  toggleOrganismo(codigo: number | string): void {
    const numericCode = typeof codigo === 'string' ? parseInt(codigo, 10) : codigo;
    const idx = this.organismosSeleccionados.indexOf(numericCode);
    if (idx >= 0) {
      this.organismosSeleccionados.splice(idx, 1);
    } else {
      this.organismosSeleccionados.push(numericCode);
    }
    this.filterAndPaginateLocal();
  }

  toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.filterAndPaginateLocal();
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-informes-container')) {
      this.dropdownInformesOpen = false;
    }
  }

  toggleDropdownInformes(event: Event): void {
    event.stopPropagation();
    this.dropdownInformesOpen = !this.dropdownInformesOpen;
  }

  toggleInforme(id: string): void {
    const idx = this.selectedInformes.indexOf(id);
    if (idx >= 0) {
      this.selectedInformes.splice(idx, 1);
    } else {
      this.selectedInformes.push(id);
    }
    this.informesControl.setValue([...this.selectedInformes]);
    this.currentPage = 1;
    this.filterAndPaginateLocal();
  }

  selectAllInformes(): void {
    this.selectedInformes = this.informesOptions.map((inf) => inf.id);
    this.informesControl.setValue([...this.selectedInformes]);
    this.currentPage = 1;
    this.filterAndPaginateLocal();
  }

  clearInformesSelection(): void {
    this.selectedInformes = [];
    this.informesControl.setValue([]);
    this.currentPage = 1;
    this.filterAndPaginateLocal();
  }

  getFilteredInformesOptions(): { id: string; titulo: string }[] {
    if (!this.searchInformeText.trim()) {
      return this.informesOptions;
    }
    const search = this.searchInformeText.toLowerCase();
    return this.informesOptions.filter((inf) => inf.titulo.toLowerCase().includes(search));
  }

  getInformeSeleccionadoLabel(): string {
    if (this.selectedInformes.length === 0) {
      return `Todos los informes (${this.informesOptions.length})`;
    }
    if (this.selectedInformes.length === 1) {
      const found = this.informesOptions.find((inf) => inf.id === this.selectedInformes[0]);
      return found ? found.titulo : '1 informe seleccionado';
    }
    return `${this.selectedInformes.length} informes seleccionados`;
  }

  private cargarCombos(): void {
    this.reportsService.getOrganismos().subscribe({
      next: (response) => {
        this.organismos = response.datos || [];
      },
      error: () => {
        this.alertsService.showAlert('Error al cargar los organismos de control', 'error');
      }
    });

    this.periodoSrv.getPeriodos().subscribe({
      next: (response) => {
        this.periodosEvaluacion = response.datos || [];
      },
      error: () => {}
    });
  }

  private configureFormChanges(): void {
    this.startDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.endDateControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.periodoEvaluacionControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.organismoControlControl.valueChanges.subscribe(() => {
      this.resetPaginationAndApplyFilter();
    });

    this.informesControl.valueChanges.subscribe((val) => {
      if (Array.isArray(val)) {
        this.selectedInformes = [...val];
      }
      this.currentPage = 1;
      this.filterAndPaginateLocal();
    });
  }

  private resetPaginationAndApplyFilter(): void {
    this.currentPage = 1;
    this.reports = [];
    this.displayedReports = [];
    this.hasData = false;
    this.applyFilter();
  }

  protected async applyFilter(): Promise<void> {
    if (this.filterForm.valid) {
      this.isLoading = true;

      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      const organismoControl = parseInt(this.organismoControlControl.value, 10) || 0;
      const periodoEvaluacionId = parseInt(this.periodoEvaluacionControl.value, 10) || 0;

      let setOfInformeIds: Set<string> | null = null;
      let setOfExcludedRecs: Set<string> | null = null;
      let setOfExcludedResps: Set<string> | null = null;

      if (periodoEvaluacionId > 0) {
        try {
          const [resInf, resRec, resResp] = await Promise.all([
            firstValueFrom(this.periodoSrv.getInformesPorPeriodo(periodoEvaluacionId)),
            firstValueFrom(this.periodoSrv.getRecomendacionesPorPeriodo(periodoEvaluacionId)),
            firstValueFrom(this.periodoSrv.getResponsablesPorPeriodo(periodoEvaluacionId))
          ]);

          if (resInf?.datos && resInf.datos.length > 0) {
            setOfInformeIds = new Set<string>();
            resInf.datos.forEach((i: any) => {
              if (i.ainin_codigo) setOfInformeIds!.add(String(i.ainin_codigo));
            });
          }

          if (resRec?.datos && resRec.datos.length > 0) {
            setOfExcludedRecs = new Set<string>();
            resRec.datos.forEach((r: any) => {
              if (r.incluido === 0 || r.incluido === '0') {
                if (r.arere_codigo) {
                  setOfExcludedRecs!.add(`ID_${r.arere_codigo}`);
                }
                if (r.ainin_codigo && r.numero_recomendacion !== undefined) {
                  setOfExcludedRecs!.add(`${r.ainin_codigo}_${r.numero_recomendacion}`);
                }
              }
            });
          }

          if (resResp?.datos && resResp.datos.length > 0) {
            setOfExcludedResps = new Set<string>();
            resResp.datos.forEach((resp: any) => {
              if (resp.incluido === 0 || resp.incluido === '0') {
                if (resp.nombre_completo) {
                  setOfExcludedResps!.add(resp.nombre_completo.trim().toLowerCase());
                }
              }
            });
          }
        } catch (e) {
          console.error('Error al cargar detalle del periodo de evaluación:', e);
        }
      }

      this.reportsService.getReportGeneralAIJ(startDate, endDate, organismoControl, 0, '0', '0').subscribe({
        next: (response) => {
          let rawData = response.datos || [];

          // 1. Filtrar informes pertenecientes al Periodo de Evaluación si hay informes asignados
          if (setOfInformeIds !== null && setOfInformeIds.size > 0) {
            rawData = rawData.filter((item) => setOfInformeIds!.has(String(item.codigoInforme)));
          }

          // 2. Excluir recomendaciones marcadas como no incluidas en el Periodo
          if (setOfExcludedRecs !== null && setOfExcludedRecs.size > 0) {
            rawData = rawData.filter((item) => {
              const isExcludedById = item.codigoRecomendacion && setOfExcludedRecs!.has(`ID_${item.codigoRecomendacion}`);
              const isExcludedByCode = item.codigoInforme && item.codigoRecomendacion && setOfExcludedRecs!.has(`${item.codigoInforme}_${item.codigoRecomendacion}`);
              return !isExcludedById && !isExcludedByCode;
            });
          }

          // 3. Excluir responsables marcados como no incluidos en el Periodo
          if (setOfExcludedResps !== null && setOfExcludedResps.size > 0) {
            rawData = rawData.filter((item) => {
              if (!item.responsable) return true;
              return !setOfExcludedResps!.has(item.responsable.trim().toLowerCase());
            });
          }

          this.rawGeneralReports = rawData;
          this.processGroupedReports();
          this.isLoading = false;
        },
        error: (error: any) => {
          this.alertsService.showAlert('Error al cargar el reporte de informes y recomendaciones', 'error');
          this.isLoading = false;
          this.reports = [];
          this.displayedReports = [];
          this.hasData = false;
        }
      });
    }
  }

  private processGroupedReports(): void {
    if (!this.rawGeneralReports || this.rawGeneralReports.length === 0) {
      this.reports = [];
      this.displayedReports = [];
      this.informesOptions = [];
      this.hasData = false;
      return;
    }

    const groupedMap = new Map<string, ReportGeneralAIJ[]>();
    const optionsMap = new Map<string, string>();

    this.rawGeneralReports.forEach((item) => {
      const groupKey = item.codigoInforme
        ? `INF_${item.codigoInforme}`
        : `${item.memoAuditoria || ''}___${item.tituloInforme || ''}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, []);
      }
      groupedMap.get(groupKey)!.push(item);

      const titleDisplay = item.tituloInforme
        ? `${item.memoAuditoria ? item.memoAuditoria + ' - ' : ''}${item.tituloInforme}`
        : item.memoAuditoria || groupKey;
      optionsMap.set(groupKey, titleDisplay);
    });

    // Populate informes filter dropdown options
    this.informesOptions = Array.from(optionsMap.entries()).map(([id, titulo]) => ({
      id,
      titulo
    }));

    const groupedResult: ReportInformesRecomendaciones[] = [];

    groupedMap.forEach((items, groupKey) => {
      const first = items[0];

      // Deduplicate recommendations by recommendation code or description
      const recMap = new Map<string, ReportGeneralAIJ>();
      items.forEach((r) => {
        const rKey = r.codigoRecomendacion
          ? `REC_${r.codigoRecomendacion}`
          : (r.recomendacion || '').trim().toLowerCase();
        if (!recMap.has(rKey)) {
          recMap.set(rKey, r);
        }
      });

      const uniqueRecs = Array.from(recMap.values());
      const totalRecs = uniqueRecs.length;

      let enProceso = 0;
      let cumplidas = 0;
      let noCumplidas = 0;
      let noAplica = 0;

      uniqueRecs.forEach((rec) => {
        const est = (rec.estadoRecomendacion || '').trim().toUpperCase();
        if (est === 'CUMPLIDA') {
          cumplidas++;
        } else if (est === 'EN PROCESO' || est === 'EN PROCESO DE CUMPLIMIENTO') {
          enProceso++;
        } else if (est === 'NO CUMPLIDA' || est === 'INCUMPLIDA') {
          noCumplidas++;
        } else if (est === 'NO APLICA') {
          noAplica++;
        } else {
          enProceso++;
        }
      });

      // Calculate progress percentage: % of fulfilled/no-applies out of total
      let progreso = 0;
      if (first.progresoInforme !== undefined && first.progresoInforme !== null && first.progresoInforme > 0) {
        progreso = Number(first.progresoInforme);
      } else if (totalRecs > 0) {
        progreso = Number(((cumplidas / totalRecs) * 100).toFixed(1));
      }

      groupedResult.push({
        codigoInforme: groupKey,
        tituloInforme: first.tituloInforme || 'Informe de Auditoría',
        memorando: first.memoAuditoria || '—',
        fechaEmision: first.fechaMemorando || '—',
        memoAprobacion: first.memoPresidencia || '—',
        fechaAprobacion: first.fechaAprobacion || '—',
        organismoControl: first.organismoControl || '—',
        progresoInforme: progreso,
        totalRecomendaciones: totalRecs,
        recomendacionesEnProceso: enProceso,
        recomendacionesCumplidas: cumplidas,
        recomendacionesNoCumplidas: noCumplidas,
        recomendacionesNoAplica: noAplica
      });
    });

    this.reports = groupedResult;
    this.filterAndPaginateLocal();
  }

  private filterAndPaginateLocal(): void {
    let filtered = [...this.reports];

    if (this.selectedInformes && this.selectedInformes.length > 0) {
      filtered = filtered.filter((r) => this.selectedInformes.includes(String(r.codigoInforme)));
    }

    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map((cod: number) => this.getOrganismoControlDescripcion(String(cod)))
        .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
        .map((desc: string) => desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());

      if (selectedDescs.length > 0) {
        filtered = filtered.filter(r => {
          const normOrg = (r.organismoControl || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          return selectedDescs.includes(normOrg);
        });
      }
    }

    this.filteredReports = filtered;
    this.hasData = filtered.length > 0;
    this.updateDisplayedReports(filtered);
  }

  private updateDisplayedReports(filteredList: ReportInformesRecomendaciones[]): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedReports = filteredList.slice(startIndex, endIndex);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.filterAndPaginateLocal();
  }

  onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    this.filterAndPaginateLocal();
  }

  protected exportToExcel(): void {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.alertsService.showAlert('No hay datos filtrados para exportar', 'info');
      return;
    }

    try {
      const headerData = [
        ['REPORTE DE INFORMES Y RECOMENDACIONES'],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.formatDateToDisplay(this.startDateControl.value)],
        ['Fecha Hasta:', this.formatDateToDisplay(this.endDateControl.value)],
        ['Periodo de Evaluación:', this.getPeriodoEvaluacionDescripcion(this.periodoEvaluacionControl.value)],
        ['Título Informe:', this.getInformesSeleccionadosDescripcion()],
        ['Ente de Control:', this.getOrganismosSeleccionadosLabel()],
        [''],
        ['Fecha de generación:', this.formatDateToDisplay(new Date().toISOString().split('T')[0])],
        [''],
        ['']
      ];

      const dataToExport = this.filteredReports.map((report) => ({
        'Título del Informe': report.tituloInforme,
        'Memorando': report.memorando,
        'Fecha Emisión': report.fechaEmision || '—',
        'Memo de Aprobación': report.memoAprobacion,
        'Fecha de Aprobación': report.fechaAprobacion || '—',
        'Ente de Control': report.organismoControl,
        'Progreso (%)': report.progresoInforme,
        'Total Recomendaciones': report.totalRecomendaciones,
        'En Proceso': report.recomendacionesEnProceso,
        'Cumplidas': report.recomendacionesCumplidas,
        'No Cumplidas': report.recomendacionesNoCumplidas,
        'No Aplica': report.recomendacionesNoAplica
      }));

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      const worksheetHeader: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerData);
      const worksheet = Object.assign({}, worksheetHeader);

      const headerRowCount = headerData.length;
      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: `A${headerRowCount + 1}` });

      worksheet['!cols'] = [
        { wch: 45 },
        { wch: 25 },
        { wch: 18 },
        { wch: 25 },
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 22 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Informes Recomendaciones');

      const today = new Date();
      const fileName = `reporte_informes_recomendaciones_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`;

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

  private formatDateToDisplay(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  private getOrganismoControlDescripcion(codigo: string): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos los Entes';
    const organismo = this.organismos.find((org) => Number(org.ainoc_codigo) === codigoNum);
    return organismo ? organismo.ainoc_descripcion : 'Todos los Entes';
  }

  private getPeriodoEvaluacionDescripcion(codigo: string): string {
    const codigoNum = Number(codigo);
    if (codigoNum === 0 || !codigo) return 'Todos los Periodos';
    const periodo = this.periodosEvaluacion.find((p) => Number(p.arcev_codigo) === codigoNum);
    return periodo ? periodo.arcev_nombre : 'Todos los Periodos';
  }

  private getInformesSeleccionadosDescripcion(): string {
    if (this.selectedInformes.length === 0) {
      return 'Todos los informes';
    }
    if (this.selectedInformes.length === 1) {
      const found = this.informesOptions.find((i) => i.id === this.selectedInformes[0]);
      return found ? found.titulo : '1 informe seleccionado';
    }
    return `${this.selectedInformes.length} informes seleccionados`;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dateRangeValidator(group: FormGroup) {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    return start && end && start > end ? { dateRangeInvalid: true } : null;
  }
}
