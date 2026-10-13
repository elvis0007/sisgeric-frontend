import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { EstadoSeg } from '@features/ai-seguim-auditor-operativo/models/recomendacion';
import { Recomendacion, RecomendacionInforme } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { RecomendacionesService } from '@features/ai-seguim-recomendaciones/services/recomendaciones.service';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { PeriodoEvaluacionService } from '@features/ai-seguim-auditor-general/services/periodo-evaluacion.service';
import { PeriodoEvaluacion } from '@features/ai-seguim-auditor-general/models/periodo-evaluacion.model';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { debounceTime, distinctUntilChanged, forkJoin, Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './search-filter.component.html',
  styleUrl: './search-filter.component.css',
})
export class SearchFilterComponent implements OnInit, OnDestroy {
  @Output() filterChange = new EventEmitter<any>();
  @Output() loadingChange = new EventEmitter<boolean>();
  private readonly recomendacionSrv: RecomendacionesService = inject(
    RecomendacionesService
  );
  private readonly modalResponsablesSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );
  private readonly periodoSrv = inject(PeriodoEvaluacionService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly filterStateService = inject(FilterStateService);
  private readonly auxiliarySrv = inject(AuxiliaryService);
  private filterSubscription?: Subscription;

  protected get isAuditorJefe(): boolean {
    return this.auxiliarySrv.hasRole([2]);
  }

  protected filterForm: FormGroup<any>;
  protected hasData = false;
  protected isLoading = false;
  protected selectEstadoSeg: EstadoSeg[] = [];
  protected selectDepartamento: string[] = [];
  protected selectAuditor: UsuarioAuditor[] = [];
  protected isFromChart = false;
  private filtersReady = false;

  // Filtros dinámicos en cascada con selección múltiple
  protected rawBackendData: RecomendacionInforme[] = [];
  protected selectInformes: { codigo: string; titulo: string; memorando: string }[] = [];
  protected selectRecomendaciones: Recomendacion[] = [];

  // Estado de selección múltiple
  protected selectedInformes: string[] = [];
  protected selectedRecomendaciones: number[] = [];

  // Búsqueda en los menús desplegables
  protected searchInformeText = '';
  protected searchRecomendacionText = '';

  // Control de apertura de desplegables
  protected dropdownInformesOpen = false;
  protected dropdownRecomendacionesOpen = false;

  // Estado para referencia desde reporte o notificación
  protected isFromReport = false;
  protected targetArere: number | null = null;
  protected targetAinin: string | null = null;
  protected targetMemo: string | null = null;
  protected targetRecNum: number | null = null;
  protected activeReportBanner: {
    memorando?: string;
    numRec?: number;
    titulo?: string;
    descripcion?: string;
  } | null = null;

  constructor(private formBuilder: FormBuilder) {
    const today = new Date();
    // Por defecto se filtran los registros desde el 01/01 del año actual hasta la fecha de hoy
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.filterForm = this.formBuilder.group({
      startDate: [this.formatDate(firstDayOfYear)],
      endDate: [this.formatDate(today)],
      estadoSeg: ['0'],
      departamento: ['0'],
      auditor: ['0'],
      searchTerm: [''],
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.dropdownInformesOpen = false;
      this.dropdownRecomendacionesOpen = false;
    }
  }

  ngOnInit() {
    this.loadingChange.emit(true);
    this.isLoading = true;

    this.filtersReady = false;
    this.loadSelectData().then(() => {
      this.filtersReady = true;

      const savedFilters = this.filterStateService.getFilters('seguim_recomendaciones');
      if (savedFilters) {
        if (savedFilters.selectedInformes) this.selectedInformes = savedFilters.selectedInformes;
        if (savedFilters.selectedRecomendaciones) this.selectedRecomendaciones = savedFilters.selectedRecomendaciones;
        if (savedFilters.organismosSeleccionados) this.organismosSeleccionados = savedFilters.organismosSeleccionados;
        if (savedFilters.periodosSeleccionados) this.periodosSeleccionados = savedFilters.periodosSeleccionados;
        this.filterForm.patchValue(savedFilters, { emitEvent: false });
      }

      this.loadPeriodosMembership().then(() => {
        this.processUrlParams();
      });
    });

    this.setupFilterListeners();
  }

  ngOnDestroy(): void {
    this.filterSubscription?.unsubscribe();
    this.modalResponsablesSrv.setResponsablesPeriodo(null);
  }

  protected selectOrgCtrl: any[] = [];
  protected organismosSeleccionados: number[] = [];
  protected selectPeriodos: PeriodoEvaluacion[] = [];
  protected periodosSeleccionados: number[] = [];
  protected mostrarTodosPeriodos = false;

  // Códigos de pertenencia real al periodo (obtenidos del backend):
  // informes, recomendaciones y responsables incluidos en los periodos seleccionados.
  protected periodoInformesCodigos: Set<string> = new Set();
  protected periodoRecomendacionesCodigos: Set<number> = new Set();
  protected periodosResponsablesMap: Map<number, Set<number>> = new Map();

  getVisiblePeriodos(): PeriodoEvaluacion[] {
    if (this.mostrarTodosPeriodos) return this.selectPeriodos;
    const currentYear = new Date().getFullYear();
    const currentYearPeriodos = this.selectPeriodos.filter(p => p.arcev_anio === currentYear);
    return currentYearPeriodos.length > 0 ? currentYearPeriodos : this.selectPeriodos;
  }

  toggleOrganismo(codigo: number | string): void {
    const numericCode = typeof codigo === 'string' ? parseInt(codigo, 10) : codigo;
    const idx = this.organismosSeleccionados.indexOf(numericCode);
    if (idx >= 0) {
      this.organismosSeleccionados.splice(idx, 1);
    } else {
      this.organismosSeleccionados.push(numericCode);
    }
    this.applyLocalFilters();
  }

  toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.applyLocalFilters();
  }

  getOrganismosSeleccionadosLabel(): string {
    if (!this.organismosSeleccionados || this.organismosSeleccionados.length === 0) {
      return 'Todos los Entes';
    }
    if (this.organismosSeleccionados.length === 1) {
      const org = this.selectOrgCtrl.find(o => Number(o.ainoc_codigo) === this.organismosSeleccionados[0]);
      return org ? org.ainoc_descripcion : '1 Ente Seleccionado';
    }
    return `${this.organismosSeleccionados.length} Entes Seleccionados`;
  }

  togglePeriodo(codigo: number): void {
    const idx = this.periodosSeleccionados.indexOf(codigo);
    if (idx >= 0) {
      this.periodosSeleccionados.splice(idx, 1);
    } else {
      this.periodosSeleccionados.push(codigo);
    }
    this.onPeriodosChanged();
  }

  toggleAllPeriodos(): void {
    this.periodosSeleccionados = [];
    this.onPeriodosChanged();
  }

  private onPeriodosChanged(): void {
    this.loadPeriodosMembership().then(() => {
      this.updateInformesYRecomendacionesOptions();
      this.applyLocalFilters();
    });
  }

  /**
   * Carga desde el backend la pertenencia real de informes, recomendaciones y
   * responsables a los periodos seleccionados. Esto reemplaza el filtro por
   * fechas aproximado para reflejar exactamente qué registros están incluidos
   * en cada Periodo de Evaluación (incluyendo exclusiones granulares).
   */
  private loadPeriodosMembership(): Promise<void> {
    const informesSet = new Set<string>();
    const recsSet = new Set<number>();
    const respMap = new Map<number, Set<number>>();

    if (!this.periodosSeleccionados || this.periodosSeleccionados.length === 0) {
      this.periodoInformesCodigos = informesSet;
      this.periodoRecomendacionesCodigos = recsSet;
      this.periodosResponsablesMap = respMap;
      this.modalResponsablesSrv.setResponsablesPeriodo(null);
      return Promise.resolve();
    }

    const periodos = this.selectPeriodos.filter((p) =>
      this.periodosSeleccionados.includes(p.arcev_codigo)
    );

    const requests: Observable<ResponseReadMultiple<any>>[] = [];
    periodos.forEach((p) => {
      requests.push(this.periodoSrv.getInformesPorPeriodo(p.arcev_codigo) as Observable<ResponseReadMultiple<any>>);
      requests.push(this.periodoSrv.getRecomendacionesPorPeriodo(p.arcev_codigo));
      requests.push(this.periodoSrv.getResponsablesPorPeriodo(p.arcev_codigo));
    });

    return new Promise<void>((resolve) => {
      if (requests.length === 0) {
        resolve();
        return;
      }
      forkJoin(requests).subscribe({
        next: (responses) => {
          responses.forEach((resp, idx) => {
            const datos = (resp as ResponseReadMultiple<any>)?.datos || [];
            const tipo = idx % 3;
            if (tipo === 0) {
              datos.forEach((inf: any) => {
                if (inf.ainin_codigo != null) informesSet.add(String(inf.ainin_codigo));
              });
            } else if (tipo === 1) {
              datos.forEach((rec: any) => {
                if (rec.arere_codigo != null && Number(rec.incluido) !== 0) {
                  recsSet.add(Number(rec.arere_codigo));
                }
              });
            } else {
              datos.forEach((respItem: any) => {
                if (
                  respItem.arere_codigo != null &&
                  respItem.arers_codigo != null &&
                  Number(respItem.incluido) !== 0
                ) {
                  const recCode = Number(respItem.arere_codigo);
                  if (!respMap.has(recCode)) respMap.set(recCode, new Set<number>());
                  respMap.get(recCode)!.add(Number(respItem.arers_codigo));
                }
              });
            }
          });
          this.periodoInformesCodigos = informesSet;
          this.periodoRecomendacionesCodigos = recsSet;
          this.periodosResponsablesMap = respMap;
          this.modalResponsablesSrv.setResponsablesPeriodo(respMap);
          resolve();
        },
        error: () => {
          this.periodoInformesCodigos = informesSet;
          this.periodoRecomendacionesCodigos = recsSet;
          this.periodosResponsablesMap = respMap;
          this.modalResponsablesSrv.setResponsablesPeriodo(respMap);
          resolve();
        },
      });
    });
  }

  getPeriodosSeleccionadosLabel(): string {
    if (!this.periodosSeleccionados || this.periodosSeleccionados.length === 0) {
      return 'Todos los Periodos';
    }
    if (this.periodosSeleccionados.length === 1) {
      const p = this.selectPeriodos.find(item => item.arcev_codigo === this.periodosSeleccionados[0]);
      return p ? p.arcev_nombre : '1 Periodo Seleccionado';
    }
    return `${this.periodosSeleccionados.length} Periodos Seleccionados`;
  }

  private getPeriodosDefaultList(): PeriodoEvaluacion[] {
    const anio = this.currentYearControl?.value || new Date().getFullYear();
    return [
      { arcev_codigo: 1, arcev_nombre: `I Trimestre ${anio}`, arcev_fecha_inicio: `${anio}-01-01`, arcev_fecha_fin: `${anio}-03-31`, arcev_fecha_corte: `${anio}-03-31`, arcev_anio: anio, arcev_tipo: 'TRIMESTRAL' as any, arcev_estado: 1 },
      { arcev_codigo: 2, arcev_nombre: `II Trimestre ${anio}`, arcev_fecha_inicio: `${anio}-04-01`, arcev_fecha_fin: `${anio}-06-30`, arcev_fecha_corte: `${anio}-06-30`, arcev_anio: anio, arcev_tipo: 'TRIMESTRAL' as any, arcev_estado: 1 },
      { arcev_codigo: 3, arcev_nombre: `III Trimestre ${anio}`, arcev_fecha_inicio: `${anio}-07-01`, arcev_fecha_fin: `${anio}-09-30`, arcev_fecha_corte: `${anio}-09-30`, arcev_anio: anio, arcev_tipo: 'TRIMESTRAL' as any, arcev_estado: 1 },
      { arcev_codigo: 4, arcev_nombre: `IV Trimestre ${anio}`, arcev_fecha_inicio: `${anio}-10-01`, arcev_fecha_fin: `${anio}-12-31`, arcev_fecha_corte: `${anio}-12-31`, arcev_anio: anio, arcev_tipo: 'TRIMESTRAL' as any, arcev_estado: 1 },
      { arcev_codigo: 5, arcev_nombre: `Cierre de Año ${anio}`, arcev_fecha_inicio: `${anio}-01-01`, arcev_fecha_fin: `${anio}-12-31`, arcev_fecha_corte: `${anio}-12-31`, arcev_anio: anio, arcev_tipo: 'CIERRE_ANIO' as any, arcev_estado: 1 },
    ];
  }

  private async loadSelectData(): Promise<void> {
    try {
      await Promise.all([
        new Promise<void>((resolve) => {
          this.recomendacionSrv.getEstadoSeg().subscribe({
            next: (response: ResponseReadMultiple<EstadoSeg>) => {
              this.selectEstadoSeg = response.datos;
              resolve();
            },
            error: () => resolve(),
          });
        }),
        new Promise<void>((resolve) => {
          this.recomendacionSrv.getDepartamentos().subscribe({
            next: (response: ResponseReadMultiple<string>) => {
              this.selectDepartamento = response.datos;
              resolve();
            },
            error: () => resolve(),
          });
        }),
        new Promise<void>((resolve) => {
          this.recomendacionSrv.getOrganismos().subscribe({
            next: (response: any) => {
              this.selectOrgCtrl = response.datos || [];
              resolve();
            },
            error: () => resolve(),
          });
        }),
        new Promise<void>((resolve) => {
          this.periodoSrv.getPeriodos().subscribe({
            next: (response: ResponseReadMultiple<PeriodoEvaluacion>) => {
              this.selectPeriodos = response.datos?.length ? response.datos : this.getPeriodosDefaultList();
              resolve();
            },
            error: () => {
              this.selectPeriodos = this.getPeriodosDefaultList();
              resolve();
            },
          });
        }),
        // Combinar auditores operativos (rol 3) + auditores jefe interno (rol 2)
        new Promise<void>((resolve) => {
          forkJoin([
            this.recomendacionSrv.getAuditores(),
            this.recomendacionSrv.getAuditoresJefe(),
          ]).subscribe({
            next: ([respOp, respJefe]) => {
              const operativos: UsuarioAuditor[] = respOp.datos?.usuarios || [];
              const jefes: UsuarioAuditor[] = respJefe.datos?.usuarios || [];
              const cuentasVistas = new Set<string>();
              const todos: UsuarioAuditor[] = [];
              [...operativos, ...jefes].forEach((u) => {
                if (!cuentasVistas.has(u.dsgus_cuenta)) {
                  cuentasVistas.add(u.dsgus_cuenta);
                  todos.push(u);
                }
              });
              this.selectAuditor = todos.sort((a, b) =>
                a.nombre_completo.localeCompare(b.nombre_completo)
              );
              resolve();
            },
            error: () => {
              this.recomendacionSrv.getAuditores().subscribe({
                next: (r) => { this.selectAuditor = r.datos?.usuarios || []; resolve(); },
                error: () => resolve(),
              });
            },
          });
        }),
      ]);
    } catch (error) {
      console.error('Error cargando datos de filtros', error);
    }
  }

  private processUrlParams(): void {
    this.route.queryParams.subscribe((params) => {
      const hasParams =
        params['departamento'] ||
        params['estado'] ||
        params['anio'] ||
        params['fromChart'] ||
        params['fromReport'] ||
        params['arere'] ||
        params['ainin'] ||
        params['memo'] ||
        params['recNum'];

      if (hasParams) {
        this.isFromChart = params['fromChart'] === 'true';
        this.isFromReport = params['fromReport'] === 'true' || Boolean(params['arere'] || params['memo']);
        this.targetArere = params['arere'] ? Number(params['arere']) : null;
        this.targetAinin = params['ainin'] ? String(params['ainin']) : null;
        this.targetMemo = params['memo'] ? String(params['memo']).trim() : null;
        this.targetRecNum = params['recNum'] ? Number(params['recNum']) : null;

        setTimeout(() => {
          if (this.isFromReport) {
            let year = new Date().getFullYear();
            if (params['anio']) {
              year = parseInt(params['anio'], 10);
            } else if (this.targetMemo) {
              const match = this.targetMemo.match(/\b(19\d{2}|20\d{2})\b/);
              if (match) year = parseInt(match[1], 10);
            }

            this.filterForm.patchValue({
              startDate: `${year}-01-01`,
              endDate: `${year}-12-31`,
              departamento: '0',
              estadoSeg: '0',
              auditor: '0',
              searchTerm: ''
            }, { emitEvent: false });
          } else {
            if (
              params['departamento'] &&
              this.selectDepartamento.includes(params['departamento'])
            ) {
              this.filterForm
                .get('departamento')
                ?.setValue(params['departamento'], { emitEvent: false });
            }

            if (params['estado']) {
              this.filterForm
                .get('estadoSeg')
                ?.setValue(params['estado'], { emitEvent: false });
            }

            if (params['anio']) {
              const year = parseInt(params['anio'], 10);
              this.filterForm.patchValue({
                startDate: `${year}-01-01`,
                endDate: `${year}-12-31`
              }, { emitEvent: false });
            }
          }

          if (this.isFromChart) {
            this.router.navigate([], {
              queryParams: {},
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          }

          this.applyFilter();
        }, 500);
      } else {
        this.applyFilter();
      }
    });
  }

  private debounceTimer: any = null;
  private lastLoadedYearsKey: string = '';

  private triggerDebouncedFilter(): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.filtersReady) this.applyFilter();
    }, 400);
  }

  private checkYearsAndTriggerFilter(): void {
    const startDateVal = this.startDateControl.value;
    const endDateVal = this.endDateControl.value;

    let startYear = this.extractYearFromDateString(startDateVal);
    let endYear = this.extractYearFromDateString(endDateVal);

    if (startYear > endYear) {
      const temp = startYear;
      startYear = endYear;
      endYear = temp;
    }

    const isMultiYearFrom2022 = startYear <= 2022 && endYear > startYear;
    const fetchStart = isMultiYearFrom2022 ? 2020 : startYear;

    const yearsToFetch: number[] = [];
    for (let yr = fetchStart; yr <= endYear; yr++) {
      yearsToFetch.push(yr);
    }

    const newKey = yearsToFetch.join(',');
    if (this.lastLoadedYearsKey !== newKey) {
      this.triggerDebouncedFilter();
    } else if (this.filtersReady) {
      this.applyLocalFilters();
    }
  }

  private setupFilterListeners(): void {
    this.filterForm.valueChanges.subscribe((val) => {
      if (this.filtersReady) {
        this.saveState();
      }
    });

    this.startDateControl.valueChanges.subscribe((val) => {
      if (!val) return;
      this.checkYearsAndTriggerFilter();
    });

    this.endDateControl.valueChanges.subscribe((val) => {
      if (!val) return;
      this.checkYearsAndTriggerFilter();
    });

    this.selectEstadoSegForm.valueChanges.subscribe(() => this.triggerDebouncedFilter());
    this.selectDepartamentoForm.valueChanges.subscribe(() => this.triggerDebouncedFilter());
    this.selectAuditorForm.valueChanges.subscribe(() => this.triggerDebouncedFilter());

    this.searchTermControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        if (!this.filtersReady) return;
        this.applyLocalFilters();
      });
  }

  private parseToYYYYMMDD(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim().split(' ')[0].split('T')[0];
    if (cleanStr.includes('/')) {
      const parts = cleanStr.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    return cleanStr;
  }

  private getItemDates(item: any): string[] {
    // Para el filtro de rango Fecha Desde/Hasta se usan SOLO las fechas del informe:
    // - ainin_fecha_emision (fecha de emisión del informe)
    // - ainin_fecha_aprobacion (fecha de aprobación del informe)
    // Igual que el Reporte por Fecha de Corte. NO se usa arere_fecha_maxima
    // ni ainin_fecha_memo ya que pueden distorsionar el filtro de rango.
    const dates: string[] = [];
    if (item.ainin_fecha_emision) {
      const d = this.parseToYYYYMMDD(item.ainin_fecha_emision);
      if (d) dates.push(d);
    }
    if (item.ainin_fecha_aprobacion) {
      const d = this.parseToYYYYMMDD(item.ainin_fecha_aprobacion);
      if (d) dates.push(d);
    }
    return dates;
  }

  private saveState(): void {
    const existing = this.filterStateService.getFilters('seguim_recomendaciones') || {};
    const val = {
      ...existing,
      ...this.filterForm.value,
      selectedInformes: this.selectedInformes,
      selectedRecomendaciones: this.selectedRecomendaciones,
      organismosSeleccionados: this.organismosSeleccionados,
      periodosSeleccionados: this.periodosSeleccionados,
    };
    this.filterStateService.setFilters('seguim_recomendaciones', val);
  }

  protected toggleDropdownInformes(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.dropdownInformesOpen = !this.dropdownInformesOpen;
    this.dropdownRecomendacionesOpen = false;
  }

  protected toggleDropdownRecomendaciones(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.dropdownRecomendacionesOpen = !this.dropdownRecomendacionesOpen;
    this.dropdownInformesOpen = false;
  }

  protected toggleInforme(codigo: string): void {
    const index = this.selectedInformes.indexOf(codigo);
    if (index >= 0) {
      this.selectedInformes.splice(index, 1);
    } else {
      this.selectedInformes.push(codigo);
    }
    this.updateRecomendacionesOptions();
    this.applyLocalFilters();
  }

  protected selectAllInformes(): void {
    this.selectedInformes = [];
    this.updateRecomendacionesOptions();
    this.applyLocalFilters();
  }

  protected clearInformesSelection(): void {
    this.selectedInformes = [];
    this.updateRecomendacionesOptions();
    this.applyLocalFilters();
  }

  protected toggleRecomendacion(code: number): void {
    const index = this.selectedRecomendaciones.indexOf(code);
    if (index >= 0) {
      this.selectedRecomendaciones.splice(index, 1);
    } else {
      this.selectedRecomendaciones.push(code);
    }
    this.applyLocalFilters();
  }

  protected selectAllRecomendaciones(): void {
    this.selectedRecomendaciones = [];
    this.applyLocalFilters();
  }

  protected clearRecomendacionesSelection(): void {
    this.selectedRecomendaciones = [];
    this.applyLocalFilters();
  }

  protected getFilteredInformesOptions(): { codigo: string; titulo: string; memorando: string }[] {
    if (!this.searchInformeText.trim()) return this.selectInformes;
    const term = this.searchInformeText.toLowerCase();
    return this.selectInformes.filter((i) => i.titulo.toLowerCase().includes(term));
  }

  protected getFilteredRecomendacionesOptions(): Recomendacion[] {
    let list = this.selectRecomendaciones;
    if (this.searchRecomendacionText.trim()) {
      const term = this.searchRecomendacionText.toLowerCase();
      list = list.filter(
        (r) =>
          `rec. n° ${r.arere_num_rec}`.includes(term) ||
          r.arere_descripcion.toLowerCase().includes(term)
      );
    }
    return list;
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    this.selectedInformes = [];
    this.selectedRecomendaciones = [];
    this.organismosSeleccionados = [];
    this.periodosSeleccionados = [];
    this.searchInformeText = '';
    this.searchRecomendacionText = '';
    this.dropdownInformesOpen = false;
    this.dropdownRecomendacionesOpen = false;

    this.activeReportBanner = null;
    this.targetArere = null;
    this.targetAinin = null;
    this.targetMemo = null;
    this.targetRecNum = null;
    this.isFromReport = false;

    this.filterForm.setValue(
      {
        startDate: this.formatDate(firstDayOfYear),
        endDate: this.formatDate(today),
        estadoSeg: '0',
        departamento: '0',
        auditor: '0',
        searchTerm: '',
      },
      { emitEvent: false }
    );

    this.filterStateService.clearFilters('seguim_recomendaciones');
    this.applyFilter();
  }

  reloadTable(): void {
    this.loadingChange.emit(true);
    this.isLoading = true;
    setTimeout(() => {
      this.applyFilter();
    }, 0);
  }

  private extractYearFromDateString(dateVal: string | null | undefined): number {
    if (!dateVal) return new Date().getFullYear();
    const clean = String(dateVal).trim();
    const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      return parseInt(yearMatch[1], 10);
    }
    return new Date().getFullYear();
  }

  private extractYearFromItem(item: any): number {
    if (item.recomendaciones?.arere_anio_inicio_control) {
      return Number(item.recomendaciones.arere_anio_inicio_control);
    }
    if (item.recomendaciones?.arere_fecha_inicio_control) {
      return this.extractYearFromDateString(item.recomendaciones.arere_fecha_inicio_control);
    }
    if (item.recomendaciones?.arere_fecha_maxima) {
      return this.extractYearFromDateString(item.recomendaciones.arere_fecha_maxima);
    }
    if (item.ainin_memorando) {
      const match = item.ainin_memorando.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) return parseInt(match[1], 10);
    }
    return new Date().getFullYear();
  }

  private applyFilter(): void {
    if (this.filterForm.valid) {
      this.filterSubscription?.unsubscribe();

      this.isLoading = true;
      this.loadingChange.emit(true);

      const startDateVal = this.startDateControl.value;
      const endDateVal = this.endDateControl.value;

      let startYear = this.extractYearFromDateString(startDateVal);
      let endYear = this.extractYearFromDateString(endDateVal);

      if (startYear > endYear) { const tmp = startYear; startYear = endYear; endYear = tmp; }

      const yearsToFetch: number[] = [];
      // En rangos multi-año que inician en 2022 o antes, incluir 2020-2021 para traer
      // el informe histórico y las 40 recomendaciones activas de 2021 (total 82 inf / 725 recs)
      const isMultiYearFrom2022 = startYear <= 2022 && endYear > startYear;
      const fetchStart = isMultiYearFrom2022 ? 2020 : startYear;

      for (let yr = fetchStart; yr <= endYear; yr++) {
        yearsToFetch.push(yr);
      }
      this.lastLoadedYearsKey = yearsToFetch.join(',');

      const isSingleYear = fetchStart === endYear;
      // Si es un solo año específico se envía ese año; si es rango multi-año se envía 0
      // para traer todos los registros en una sola consulta de backend unificada y rápida.
      const yearParam = isSingleYear ? endYear : 0;

      const estadoSeg = this.selectEstadoSegForm.value;
      const departamento = this.selectDepartamentoForm.value;
      const auditor = this.selectAuditorForm.value || '0';

      this.filterSubscription = this.recomendacionSrv
        .getFilteredRecomendaciones(estadoSeg, departamento, yearParam, auditor)
        .subscribe({
          next: (response) => {
            const seenCodes = new Set<number>();
            let combined: any[] = [];
            const datos = response.datos || [];
            datos.forEach((item: any) => {
              const code = item.recomendaciones?.arere_codigo;
              if (code === undefined || code === null || !seenCodes.has(code)) {
                if (code !== undefined && code !== null) seenCodes.add(code);
                combined.push(item);
              }
            });

            // Si es un sub-rango multi-año específico que no abarca desde 2022 hacia atrás (ej. 2024 a 2025),
            // filtramos localmente los registros para que coincidan con los años solicitados.
            if (!isSingleYear && !isMultiYearFrom2022) {
              combined = combined.filter((item: any) => {
                const yr = this.extractYearFromItem(item);
                return yr >= fetchStart && yr <= endYear;
              });
            }

            this.rawBackendData = combined;
            this.updateInformesYRecomendacionesOptions();

            if (this.targetArere || this.targetMemo || this.targetAinin) {
              this.seleccionarRecomendacionObjetivo();
            }

            this.applyLocalFilters();
            this.isLoading = false;
            this.loadingChange.emit(false);
          },
          error: () => {
            this.alertsService.showAlert('Error al cargar los registros', 'error');
            this.rawBackendData = [];
            this.hasData = false;
            this.isLoading = false;
            this.loadingChange.emit(false);
          },
        });
    }
  }

  private updateInformesYRecomendacionesOptions(): void {
    const informesMap = new Map<string, { titulo: string; memorando: string }>();
    this.rawBackendData.forEach((item) => {
      if (item.ainin_codigo != null && item.ainin_titulo && item.ainin_titulo.trim()) {
        const codigo = String(item.ainin_codigo);
        // Si hay periodos seleccionados, solo mostrar informes incluidos en ellos
        if (
          this.periodosSeleccionados.length > 0 &&
          !this.periodoInformesCodigos.has(codigo)
        ) {
          return;
        }
        if (!informesMap.has(codigo)) {
          informesMap.set(codigo, {
            titulo: item.ainin_titulo.trim(),
            memorando: item.ainin_memorando || '',
          });
        }
      }
    });
    this.selectInformes = Array.from(informesMap.entries())
      .map(([codigo, val]) => ({ codigo, titulo: val.titulo, memorando: val.memorando }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo));

    // Mantener solo los informes seleccionados que aún existan en el dataset
    const codigosDisponibles = new Set(this.selectInformes.map((i) => i.codigo));
    this.selectedInformes = this.selectedInformes.filter((codigo) =>
      codigosDisponibles.has(codigo)
    );

    this.updateRecomendacionesOptions();
  }

  private updateRecomendacionesOptions(): void {
    let dataset = this.rawBackendData;

    // Si hay periodos seleccionados, solo mostrar recomendaciones incluidas en ellos
    if (this.periodosSeleccionados.length > 0) {
      dataset = dataset.filter(
        (item) =>
          item.recomendaciones &&
          this.periodoRecomendacionesCodigos.has(item.recomendaciones.arere_codigo)
      );
    }

    // Si hay informes seleccionados, filtrar el dataset para las recomendaciones
    if (this.selectedInformes.length > 0) {
      dataset = dataset.filter(
        (item) => item.ainin_codigo != null && this.selectedInformes.includes(String(item.ainin_codigo))
      );
    }

    const recMap = new Map<number, Recomendacion>();
    dataset.forEach((item) => {
      if (item.recomendaciones && item.recomendaciones.arere_codigo) {
        recMap.set(item.recomendaciones.arere_codigo, item.recomendaciones);
      }
    });
    this.selectRecomendaciones = Array.from(recMap.values()).sort(
      (a, b) => a.arere_num_rec - b.arere_num_rec
    );

    // Mantener solo las recomendaciones seleccionadas que aún pertenecen al dataset activo
    this.selectedRecomendaciones = this.selectedRecomendaciones.filter((code) =>
      recMap.has(code)
    );
  }

  private applyLocalFilters(): void {
    let result = [...this.rawBackendData];

    // 0. Filtrar por Organismos seleccionados
    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const selectedDescs = this.organismosSeleccionados
        .map((cod: number) => {
          const org = this.selectOrgCtrl.find(o => Number(o.ainoc_codigo) === cod);
          return org ? org.ainoc_descripcion : '';
        })
        .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
        .map((desc: string) => desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());

      if (selectedDescs.length > 0) {
        result = result.filter((item: any) => {
          const normOrg = (item.ainoc_descripcion || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          return selectedDescs.includes(normOrg);
        });
      }
    }

    // 0.1. Filtrar por Periodos de Evaluación seleccionados.
    // Se usa la pertenencia real (informes/recomendaciones incluidos en el
    // periodo) obtenida del backend, no un cruce aproximado por fechas.
    if (this.periodosSeleccionados && this.periodosSeleccionados.length > 0) {
      if (this.periodoInformesCodigos.size > 0) {
        result = result.filter((item: any) =>
          this.periodoInformesCodigos.has(String(item.ainin_codigo))
        );
      } else {
        result = [];
      }

      if (this.periodoRecomendacionesCodigos.size > 0) {
        result = result.filter((item: any) =>
          item.recomendaciones &&
          this.periodoRecomendacionesCodigos.has(item.recomendaciones.arere_codigo)
        );
      } else {
        result = [];
      }
    }

    // 1. Filtrar por Informes seleccionados (si hay selección explícita)
    if (this.selectedInformes.length > 0) {
      result = result.filter(
        (item) =>
          item.ainin_codigo != null && this.selectedInformes.includes(String(item.ainin_codigo))
      );
    }

    // 2. Filtrar por Recomendaciones seleccionadas (si hay selección explícita)
    if (this.selectedRecomendaciones.length > 0) {
      result = result.filter(
        (item) =>
          item.recomendaciones &&
          this.selectedRecomendaciones.includes(item.recomendaciones.arere_codigo)
      );
    }

    // 3. Filtrar por palabra clave en título del informe o texto de la recomendación
    const term = this.searchTermControl.value?.trim();
    if (term) {
      const lowerTerm = term.toLowerCase();
      result = result.filter(
        (item) =>
          item.ainin_memorando?.toLowerCase().includes(lowerTerm) ||
          item.ainin_orden_trabajo?.toLowerCase().includes(lowerTerm) ||
          item.ainin_titulo?.toLowerCase().includes(lowerTerm) ||
          item.ainoc_descripcion?.toLowerCase().includes(lowerTerm) ||
          item.recomendaciones?.arere_descripcion
            ?.toLowerCase()
            .includes(lowerTerm)
      );
    }

    // 4. Ajustar el contador de responsables al periodo de evaluación seleccionado
    //    (solo los responsables incluidos en el periodo, excluyendo los no incluidos).
    if (this.periodosSeleccionados && this.periodosSeleccionados.length > 0) {
      result = result.map((item: any) => {
        const recCode = item.recomendaciones?.arere_codigo;
        const incluidos = this.periodosResponsablesMap.get(recCode);
        if (recCode != null && incluidos) {
          return {
            ...item,
            recomendaciones: {
              ...item.recomendaciones,
              responsables: incluidos.size,
            },
          };
        }
        return item;
      });
    }

    this.saveState();
    this.hasData = result.length > 0;
    this.filterChange.emit(result);
  }

  private seleccionarRecomendacionObjetivo(): void {
    let matchedItem: any = null;

    if (this.targetArere) {
      matchedItem = this.rawBackendData.find(
        (item) => item.recomendaciones?.arere_codigo === this.targetArere
      );
    }

    if (!matchedItem && this.targetMemo && this.targetRecNum) {
      matchedItem = this.rawBackendData.find(
        (item) =>
          item.ainin_memorando?.trim().toLowerCase() === this.targetMemo!.toLowerCase() &&
          item.recomendaciones?.arere_num_rec == this.targetRecNum
      );
    }

    if (!matchedItem && this.targetMemo) {
      matchedItem = this.rawBackendData.find(
        (item) =>
          item.ainin_memorando?.trim().toLowerCase() === this.targetMemo!.toLowerCase()
      );
    }

    if (!matchedItem && this.targetAinin) {
      matchedItem = this.rawBackendData.find(
        (item) => String(item.ainin_codigo) === String(this.targetAinin)
      );
    }

    if (matchedItem) {
      if (matchedItem.ainin_codigo != null) {
        this.selectedInformes = [String(matchedItem.ainin_codigo)];
      }
      this.updateRecomendacionesOptions();
      if (matchedItem.recomendaciones?.arere_codigo) {
        this.selectedRecomendaciones = [matchedItem.recomendaciones.arere_codigo];
      }
      this.activeReportBanner = {
        memorando: matchedItem.ainin_memorando,
        numRec: matchedItem.recomendaciones?.arere_num_rec,
        titulo: matchedItem.ainin_titulo,
        descripcion: matchedItem.recomendaciones?.arere_descripcion
      };
    } else if (this.isFromReport && this.rawBackendData.length > 0) {
      // Si no se encontró en el año inicial pero es del reporte, ampliar búsqueda de 2020 a presente
      const currentStartYear = this.extractYearFromDateString(this.startDateControl.value);
      if (currentStartYear > 2020) {
        this.filterForm.patchValue({
          startDate: '2020-01-01',
          endDate: `${new Date().getFullYear() + 1}-12-31`
        }, { emitEvent: false });
        this.applyFilter();
      }
    }
  }

  public clearReportFilter(): void {
    this.activeReportBanner = null;
    this.targetArere = null;
    this.targetAinin = null;
    this.targetMemo = null;
    this.targetRecNum = null;
    this.isFromReport = false;
    this.selectedInformes = [];
    this.selectedRecomendaciones = [];
    this.updateRecomendacionesOptions();
    this.applyLocalFilters();
  }

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get currentYearControl(): FormControl {
    const start = this.startDateControl?.value;
    const year = start ? parseInt(start.split('-')[0], 10) : new Date().getFullYear();
    return new FormControl(year);
  }

  get selectEstadoSegForm(): FormControl {
    return this.filterForm.get('estadoSeg') as FormControl;
  }

  get selectDepartamentoForm(): FormControl {
    return this.filterForm.get('departamento') as FormControl;
  }

  get selectAuditorForm(): FormControl {
    return this.filterForm.get('auditor') as FormControl;
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }
}
