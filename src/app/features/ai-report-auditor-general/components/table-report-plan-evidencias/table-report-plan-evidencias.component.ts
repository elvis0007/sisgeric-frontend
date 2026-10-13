import { CommonModule } from '@angular/common';
import { Component, OnInit, Input, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ReportLoadingComponent } from '@core/ui/report-loading/report-loading.component';
import { ReportGeneralAIJ } from '@features/ai-report-auditor-general/models/reports-auditor-gen';
import { ReportsAuditorGenService } from '@features/ai-report-auditor-general/services/reports-auditor-gen.service';
import { ReportsAuditorOperService } from '@features/ai-report-auditor-operativo/services/reports-auditor-oper.service';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { OrganismoControl } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { UsuarioAuditor } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-table-report-plan-evidencias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginationComponent, ReportLoadingComponent, StatusColorPipe],
  templateUrl: './table-report-plan-evidencias.component.html',
  styleUrl: './table-report-plan-evidencias.component.css'
})
export class TableReportPlanEvidenciasComponent implements OnInit {
  @Input() modo?: 'AIJ' | 'AO';
  protected evidenciasAbiertas: string[] | null = null;

  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportsService = inject(ReportsAuditorGenService);
  private readonly reportsOperService = inject(ReportsAuditorOperService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly filterStateService = inject(FilterStateService);
  private readonly auxiliaryService = inject(AuxiliaryService);

  protected filterForm: FormGroup;
  protected reports: ReportGeneralAIJ[] = [];
  protected filteredReports: ReportGeneralAIJ[] = [];
  protected displayedReports: ReportGeneralAIJ[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected currentPage = 1;
  protected itemsPerPage = 10;

  protected estadosSeguimiento: EstadoSeg[] = [
    { arees_codigo: 1, arees_descripcion: 'CUMPLIDA' },
    { arees_codigo: 2, arees_descripcion: 'EN PROCESO' },
    { arees_codigo: 3, arees_descripcion: 'NO CUMPLIDA' },
    { arees_codigo: 4, arees_descripcion: 'NO APLICABLE' }
  ];
  protected organismos: OrganismoControl[] = [];
  protected auditores: UsuarioAuditor[] = [];
  protected departamentos: string[] = [];
  protected organismosSeleccionados: number[] = [];

  // Dropdowns multiselect
  protected estadoRecDropdownOpen = false;
  protected estadoVerificableDropdownOpen = false;
  protected estadosVerificableDisponibles: string[] = [
    'JUSTIFICA',
    'PENDIENTE DE REVISIÓN',
    'PENDIENTE',
    'NO JUSTIFICA',
    'SIN VERIFICABLE'
  ];

  // Distinción de rol y alcance
  protected isAuditorJefe = false;
  protected currentUser = '';

  constructor() {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    this.filterForm = this.formBuilder.group({
      startDate: [this.formatDate(firstDayOfYear)],
      endDate: [this.formatDate(today)],
      organismoControl: ['0'],
      estadoSeg: [[]],
      estadoVerificable: [[]],
      planAccionFiltro: ['TODOS'],
      auditor: ['0'],
      departamento: ['0'],
      searchTerm: ['']
    });
  }

  ngOnInit(): void {
    const currentUrl = this.router.url || '';
    if (this.modo) {
      this.isAuditorJefe = this.modo === 'AIJ';
    } else if (currentUrl.includes('operativo') || currentUrl.includes('-ao')) {
      this.isAuditorJefe = false;
    } else {
      this.isAuditorJefe = this.auxiliaryService.hasRole([2]);
    }
    this.currentUser = this.auxiliaryService.getUserCuenta();

    const cacheKey = this.getCacheKey();
    const savedFilters = this.filterStateService.getFilters(cacheKey);
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
      if (Array.isArray(savedFilters.organismosSeleccionados)) {
        this.organismosSeleccionados = savedFilters.organismosSeleccionados;
      }
    }

    this.cargarCombos();
    this.configureFormChanges();

    this.filterForm.valueChanges.subscribe(() => {
      this.saveCurrentFilters();
    });

    this.applyFilter();
  }

  private getCacheKey(): string {
    return this.isAuditorJefe ? 'rep_planes_evidencias_aij' : 'rep_planes_evidencias_ao';
  }

  private saveCurrentFilters(): void {
    this.filterStateService.setFilters(this.getCacheKey(), {
      ...this.filterForm.value,
      organismosSeleccionados: this.organismosSeleccionados
    });
  }

  get startDateControl(): FormControl { return this.filterForm.get('startDate') as FormControl; }
  get endDateControl(): FormControl { return this.filterForm.get('endDate') as FormControl; }
  get auditorControl(): FormControl { return this.filterForm.get('auditor') as FormControl; }
  get departamentoControl(): FormControl { return this.filterForm.get('departamento') as FormControl; }
  get planAccionControl(): FormControl { return this.filterForm.get('planAccionFiltro') as FormControl; }
  get searchTermControl(): FormControl { return this.filterForm.get('searchTerm') as FormControl; }
  get estadoSegControl(): FormControl { return this.filterForm.get('estadoSeg') as FormControl; }
  get estadoVerificableControl(): FormControl { return this.filterForm.get('estadoVerificable') as FormControl; }

  private configureFormChanges(): void {
    this.startDateControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((val) => {
      if (val && this.endDateControl.value && val <= this.endDateControl.value) {
        this.reloadReport();
      }
    });

    this.endDateControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((val) => {
      if (val && this.startDateControl.value && this.startDateControl.value <= val) {
        this.reloadReport();
      }
    });

    this.auditorControl.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.saveCurrentFilters();
      this.applyLocalFilters();
    });

    this.departamentoControl.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.saveCurrentFilters();
      this.applyLocalFilters();
    });

    this.planAccionControl.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.saveCurrentFilters();
      this.applyLocalFilters();
    });

    this.estadoSegControl.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.saveCurrentFilters();
      this.applyLocalFilters();
    });

    this.estadoVerificableControl.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.saveCurrentFilters();
      this.applyLocalFilters();
    });

    this.searchTermControl.valueChanges.pipe(
      debounceTime(250)
    ).subscribe(() => {
      this.currentPage = 1;
      this.saveCurrentFilters();
      this.applyLocalFilters();
    });
  }

  private cargarCombos(): void {
    this.reportsService.getEstadoSeg().subscribe({
      next: (res) => {
        if (res && res.datos) {
          this.estadosSeguimiento = res.datos;
          if (this.reports.length > 0) {
            this.applyLocalFilters();
          }
        }
      },
      error: (err) => console.error('Error al cargar estados de seguimiento:', err)
    });

    this.reportsService.getOrganismos().subscribe({
      next: (res) => {
        if (res && res.datos) {
          this.organismos = res.datos;
          if (this.reports.length > 0) {
            this.applyLocalFilters();
          }
        }
      },
      error: (err) => console.error('Error al cargar organismos:', err)
    });

    if (this.isAuditorJefe) {
      this.reportsService.getAuditores().subscribe({
        next: (res) => {
          if (res && res.datos && res.datos.usuarios) {
            this.auditores = res.datos.usuarios;
          }
        },
        error: (err) => console.error('Error al cargar auditores:', err)
      });
    }

    this.reportsOperService.getDepartamentos().subscribe({
      next: (res) => {
        if (res && res.datos) {
          this.departamentos = res.datos;
        }
      },
      error: (err) => console.error('Error al cargar departamentos:', err)
    });
  }

  public reloadReport(): void {
    if (this.filterForm.valid) {
      this.currentPage = 1;
      this.applyFilter();
    }
  }

  public applyFilter(): void {
    const { startDate, endDate } = this.filterForm.value;

    if (!startDate || !endDate) {
      this.alertsService.showAlert('Debe seleccionar fechas válidas.', 'error');
      return;
    }

    this.isLoading = true;
    const auditorVal = this.isAuditorJefe ? '0' : this.currentUser;
    const dptoVal = '0';

    const req$ = this.isAuditorJefe
      ? this.reportsService.getReportPlanesEvidenciasAIJ(startDate, endDate, 0, 0, auditorVal, dptoVal)
      : this.reportsOperService.getReportPlanesEvidenciasAO(startDate, endDate, 0, 0, auditorVal, dptoVal);

    req$.subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.datos) {
          this.reports = (res.datos as ReportGeneralAIJ[]).map((r) => ({
            ...r,
            diasVencidos: this.normalizeDiasVencidos(r.estadoPlazo, r.diasVencidos),
          }));

          // Recoger estados de verificable presentes dinámicamente sin duplicados normalizados
          const baseNorm = this.estadosVerificableDisponibles.map((e) => this.normalizeText(e));
          const adicionales: string[] = [];
          this.reports.forEach((r) => {
            const val = (r.estadoVerificable || '').trim();
            if (val && !baseNorm.includes(this.normalizeText(val))) {
              baseNorm.push(this.normalizeText(val));
              adicionales.push(val.toUpperCase());
            }
          });
          if (adicionales.length > 0) {
            this.estadosVerificableDisponibles = [...this.estadosVerificableDisponibles, ...adicionales];
          }

          this.applyLocalFilters();
        } else {
          this.reports = [];
          this.filteredReports = [];
          this.displayedReports = [];
          this.hasData = false;
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.reports = [];
        this.filteredReports = [];
        this.displayedReports = [];
        this.hasData = false;
        console.error('Error al consultar reporte:', err);
        this.alertsService.showAlert('Error al consultar el reporte.', 'error');
      }
    });
  }

  public applyLocalFilters(): void {
    const { estadoSeg, estadoVerificable, planAccionFiltro, searchTerm, departamento, auditor } = this.filterForm.value;

    let temp = [...this.reports];

    // 1. Filtro por Ente de Control multiselección (exacto)
    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      const todosOrgSeleccionados = this.organismos.length > 0 && this.organismosSeleccionados.length >= this.organismos.length;
      if (!todosOrgSeleccionados) {
        const selectedDescs = this.organismosSeleccionados
          .map((cod: number) => this.organismos.find((o) => Number(o.ainoc_codigo) === cod)?.ainoc_descripcion || '')
          .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
          .map((desc: string) => this.normalizeText(desc));

        if (selectedDescs.length > 0) {
          temp = temp.filter((r) => {
            const normOrg = this.normalizeText(r.organismoControl);
            return selectedDescs.some((desc) => {
              if (normOrg === desc) return true;
              if (desc.includes('interna') && normOrg.includes('interna') && !desc.includes('externa') && !normOrg.includes('externa')) return true;
              if (desc.includes('contraloria') && normOrg.includes('contraloria')) return true;
              return false;
            });
          });
        }
      }
    }

    // 2. Filtro por Estado de Recomendación (multiselección exacto sin falsos positivos de subcadena)
    const selectedEstadoSeg: number[] = (estadoSeg || []).map((v: string | number) => Number(v));
    const todosEstadosRec = this.estadosSeguimiento.length > 0 && selectedEstadoSeg.length >= this.estadosSeguimiento.length;
    if (selectedEstadoSeg.length > 0 && !todosEstadosRec) {
      const estadoSegNorm = selectedEstadoSeg
        .map((code) => {
          const found = this.estadosSeguimiento.find((e) => Number(e.arees_codigo) === code);
          return found ? this.normalizeEstado(found.arees_descripcion) : '';
        })
        .filter(Boolean);

      if (estadoSegNorm.length > 0) {
        temp = temp.filter((r) => {
          const rowNorm = this.normalizeEstado(r.estadoRecomendacion);
          return estadoSegNorm.includes(rowNorm);
        });
      }
    }

    // 3. Filtro por Estado del Verificable (multiselección exacto)
    const selectedEstadoVerificable: string[] = (estadoVerificable || []).map((v: string) => this.normalizeEstadoVerificable(v));
    const todosVerificables = this.estadosVerificableDisponibles.length > 0 && selectedEstadoVerificable.length >= this.estadosVerificableDisponibles.length;
    if (selectedEstadoVerificable.length > 0 && !todosVerificables) {
      temp = temp.filter((r) => {
        const rowNorm = this.normalizeEstadoVerificable(r.estadoVerificable);
        return selectedEstadoVerificable.includes(rowNorm);
      });
    }

    // 4. Filtro por Plan de Acción (TODOS / SI / NO)
    if (planAccionFiltro && planAccionFiltro !== 'TODOS') {
      if (planAccionFiltro === 'SI') {
        temp = temp.filter((r) => {
          const normPlan = this.normalizeText(r.tienePlanAccion);
          return normPlan === 'si' || (Number(r.cantidadActividadesPlan) > 0);
        });
      } else if (planAccionFiltro === 'NO') {
        temp = temp.filter((r) => {
          const normPlan = this.normalizeText(r.tienePlanAccion);
          return (normPlan === 'no' || normPlan === '') && (!r.cantidadActividadesPlan || Number(r.cantidadActividadesPlan) === 0);
        });
      }
    }

    // 5. Filtro por Departamento (con limpieza profunda de prefijos y sufijos institucionales)
    if (departamento && departamento !== '0') {
      const cleanSel = this.cleanDepartment(departamento);
      const normSel = this.normalizeText(departamento);
      temp = temp.filter((r) => {
        const rDept = r.departamento || '';
        const normRow = this.normalizeText(rDept);
        const cleanRow = this.cleanDepartment(rDept);
        return normRow === normSel ||
               normRow.includes(normSel) ||
               normSel.includes(normRow) ||
               (cleanSel && cleanRow && (cleanRow === cleanSel || cleanRow.includes(cleanSel) || cleanSel.includes(cleanRow)));
      });
    }

    // 6. Filtro por Auditor (solo para AIJ, contrastando cuenta y nombre completo)
    if (this.isAuditorJefe && auditor && auditor !== '0') {
      const selectedObj = this.auditores.find((a) => a.dsgus_cuenta === auditor);
      const targetCuenta = this.normalizeText(auditor);
      const targetNombre = selectedObj ? this.normalizeText(selectedObj.nombre_completo) : '';

      temp = temp.filter((r) => {
        const rAud = this.normalizeText(r.auditor);
        if (!rAud) return false;
        return rAud === targetCuenta ||
               rAud.includes(targetCuenta) ||
               targetCuenta.includes(rAud) ||
               (targetNombre && (rAud.includes(targetNombre) || targetNombre.includes(rAud)));
      });
    }

    // 7. Búsqueda libre / Palabra clave (con normalización integral)
    if (searchTerm && searchTerm.trim() !== '') {
      const term = this.normalizeText(searchTerm);
      temp = temp.filter((r) =>
        this.normalizeText(r.memoAuditoria).includes(term) ||
        this.normalizeText(r.memoPresidencia).includes(term) ||
        this.normalizeText(r.tituloInforme).includes(term) ||
        this.normalizeText(r.recomendacion).includes(term) ||
        this.normalizeText(r.hallazgo).includes(term) ||
        this.normalizeText(r.conclusion).includes(term) ||
        this.normalizeText(r.organismoControl).includes(term) ||
        this.normalizeText(r.responsable).includes(term) ||
        this.normalizeText(r.departamento).includes(term) ||
        this.normalizeText(r.evidenciaRequerida).includes(term) ||
        this.normalizeText(r.observacionAuditor).includes(term) ||
        this.normalizeText(r.estadoRecomendacion).includes(term) ||
        this.normalizeText(r.estadoVerificable).includes(term) ||
        this.normalizeText(r.estadoPlazo).includes(term) ||
        this.normalizeText(r.riesgo).includes(term) ||
        this.normalizeText(r.auditor).includes(term) ||
        String(r.codigoInforme || '').includes(term) ||
        String(r.codigoRecomendacion || '').includes(term) ||
        String(r.numeroRecomendacion || '').includes(term)
      );
    }

    this.filteredReports = temp;
    this.hasData = this.filteredReports.length > 0;
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

  public onItemsPerPageChange(count: number): void {
    this.itemsPerPage = count;
    this.currentPage = 1;
    this.updateDisplayedReports();
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
      planAccionFiltro: 'TODOS',
      auditor: '0',
      departamento: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.organismosSeleccionados = [];
    this.filterStateService.clearFilters(this.getCacheKey());
    this.reloadReport();
  }

  // Métodos dropdowns idénticos a table-report-general-aij
  protected toggleEstadoRecDropdown(): void {
    this.estadoRecDropdownOpen = !this.estadoRecDropdownOpen;
    if (this.estadoRecDropdownOpen) this.estadoVerificableDropdownOpen = false;
  }

  protected toggleEstadoVerificableDropdown(): void {
    this.estadoVerificableDropdownOpen = !this.estadoVerificableDropdownOpen;
    if (this.estadoVerificableDropdownOpen) this.estadoRecDropdownOpen = false;
  }

  protected closeDropdowns(): void {
    this.estadoRecDropdownOpen = false;
    this.estadoVerificableDropdownOpen = false;
  }

  protected get estadoRecSeleccionadosTexto(): string {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    if (selected.length === 0) return 'Todos los estados';

    const labels = selected
      .map((code) => this.estadosSeguimiento.find((e) => Number(e.arees_codigo) === code)?.arees_descripcion)
      .filter(Boolean) as string[];

    return labels.length === this.estadosSeguimiento.length
      ? 'Todos los estados'
      : labels.join(', ');
  }

  protected get estadoVerificableSeleccionadosTexto(): string {
    const selected: string[] = this.estadoVerificableControl.value || [];
    if (selected.length === 0) return 'Todos los estados';
    return selected.length === this.estadosVerificableDisponibles.length
      ? 'Todos los estados'
      : selected.join(', ');
  }

  protected isEstadoRecSeleccionado(codigo: number): boolean {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    return selected.includes(Number(codigo));
  }

  protected isEstadoVerificableSeleccionado(estado: string): boolean {
    const selected: string[] = this.estadoVerificableControl.value || [];
    const norm = this.normalizeText(estado);
    return selected.some((s) => this.normalizeText(s) === norm);
  }

  protected toggleEstadoRec(codigo: number): void {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    const target = Number(codigo);
    const updated = selected.includes(target)
      ? selected.filter((v) => v !== target)
      : [...selected, target];
    this.estadoSegControl.setValue(updated);
    this.saveCurrentFilters();
    this.applyLocalFilters();
  }

  protected toggleEstadoVerificable(estado: string): void {
    const selected: string[] = this.estadoVerificableControl.value || [];
    const norm = this.normalizeText(estado);
    const exists = selected.some((s) => this.normalizeText(s) === norm);
    const updated = exists
      ? selected.filter((v) => this.normalizeText(v) !== norm)
      : [...selected, estado];
    this.estadoVerificableControl.setValue(updated);
    this.saveCurrentFilters();
    this.applyLocalFilters();
  }

  protected areAllEstadoRecSelected(): boolean {
    const selected: number[] = (this.estadoSegControl.value || []).map((v: string | number) => Number(v));
    return this.estadosSeguimiento.length > 0 && selected.length === this.estadosSeguimiento.length;
  }

  protected areAllEstadoVerificableSelected(): boolean {
    const selected: string[] = this.estadoVerificableControl.value || [];
    return this.estadosVerificableDisponibles.length > 0 && selected.length === this.estadosVerificableDisponibles.length;
  }

  protected toggleSelectAllEstadoRec(): void {
    if (this.areAllEstadoRecSelected()) {
      this.estadoSegControl.setValue([]);
    } else {
      this.estadoSegControl.setValue(this.estadosSeguimiento.map((e) => Number(e.arees_codigo)));
    }
    this.saveCurrentFilters();
    this.applyLocalFilters();
  }

  protected toggleSelectAllEstadoVerificable(): void {
    if (this.areAllEstadoVerificableSelected()) {
      this.estadoVerificableControl.setValue([]);
    } else {
      this.estadoVerificableControl.setValue([...this.estadosVerificableDisponibles]);
    }
    this.saveCurrentFilters();
    this.applyLocalFilters();
  }

  // Organismo control multiselect
  public isOrganismoSeleccionado(codigo: number | string): boolean {
    return this.organismosSeleccionados.includes(Number(codigo));
  }

  toggleOrganismo(codigo: number | string): void {
    const num = Number(codigo);
    const idx = this.organismosSeleccionados.indexOf(num);
    if (idx >= 0) {
      this.organismosSeleccionados.splice(idx, 1);
    } else {
      this.organismosSeleccionados.push(num);
    }
    this.saveCurrentFilters();
    this.applyLocalFilters();
  }

  toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.saveCurrentFilters();
    this.applyLocalFilters();
  }

  getOrganismosSeleccionadosLabel(): string {
    if (!this.organismosSeleccionados || this.organismosSeleccionados.length === 0) {
      return 'Todos los Entes';
    }
    if (this.organismosSeleccionados.length === 1) {
      const org = this.organismos.find((o) => Number(o.ainoc_codigo) === this.organismosSeleccionados[0]);
      return org ? org.ainoc_descripcion : '1 Ente Seleccionado';
    }
    return `${this.organismosSeleccionados.length} Entes Seleccionados`;
  }

  private normalizeDiasVencidos(estadoPlazo: string | null | undefined, diasVencidos: number | null | undefined): number {
    return typeof diasVencidos === 'number' ? Math.abs(diasVencidos) : 0;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private normalizeEstado(est: string | null | undefined): string {
    const norm = this.normalizeText(est);
    if (!norm) return '';
    if (norm === 'cumplida' || norm === 'cumplido') return 'cumplida';
    if (norm === 'no cumplida' || norm === 'no cumplido') return 'no cumplida';
    if (norm === 'en proceso') return 'en proceso';
    if (norm === 'no aplicable' || norm === 'no aplica') return 'no aplicable';
    return norm;
  }

  private normalizeEstadoVerificable(val: string | null | undefined): string {
    const norm = this.normalizeText(val);
    if (!norm || norm === 'sin verificable' || norm === 'n/a' || norm === 'ninguno') return 'sin verificable';
    if (norm.includes('revision')) return 'pendiente de revision';
    if (norm === 'pendiente') return 'pendiente';
    if (norm === 'no justifica') return 'no justifica';
    if (norm === 'justifica') return 'justifica';
    return norm;
  }

  private cleanDepartment(dept: string | null | undefined): string {
    if (!dept) return '';
    return this.normalizeText(dept)
      .replace(/\b(dpto|departamento|direccion|subgerencia|gerencia|area|seccion|unidad|de|del|la|los|el|las)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  // Badges y utilitarios
  getRiesgoBadgeClass(riesgo?: string): string {
    const r = (riesgo || '').toUpperCase().trim();
    if (r.includes('ALTO')) {
      return 'bg-rose-600 text-white border-none shadow-xs font-bold';
    }
    if (r.includes('MODERAD') || r.includes('MEDIO')) {
      return 'bg-amber-500 text-slate-950 border-none shadow-xs font-bold';
    }
    if (r.includes('BAJO')) {
      return 'bg-emerald-600 text-white border-none shadow-xs font-bold';
    }
    return 'badge-ghost text-base-content/70 font-semibold';
  }

  getEstadoPlazoBadgeClass(estadoPlazo?: string): string {
    const ep = (estadoPlazo || '').toUpperCase().trim();
    if (ep.includes('VENCID')) {
      return 'bg-rose-600 text-white border-none shadow-xs font-bold';
    }
    if (ep.includes('CUMPLID')) {
      return 'bg-emerald-600 text-white border-none shadow-xs font-bold';
    }
    if (ep.includes('PLAZO') || ep.includes('TIEMPO') || ep.includes('PROCESO')) {
      return 'bg-sky-600 text-white border-none shadow-xs font-bold';
    }
    return 'badge-ghost text-base-content/70 font-semibold';
  }

  desglosarEvidencias(texto?: string | null): string[] {
    const contenido = texto?.trim() || '';
    if (!contenido || contenido.toUpperCase() === 'N/A') return [];

    let items: string[] = [];
    if (contenido.includes('|')) {
      items = contenido.split('|')
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (/^1[.)]\s+/.test(contenido)) {
      items = contenido.split(/(?:\r?\n)+(?=\d+[.)]\s+)/)
        .map((item) => item.replace(/^\d+[.)]\s+/, '').trim())
        .filter(Boolean);
    } else if (contenido.includes('\n')) {
      items = contenido.split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      items = [contenido];
    }

    // Deduplicar manteniendo orden
    return Array.from(new Set(items));
  }

  // Exportar Excel
  exportToExcel(): void {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.alertsService.showAlert('No hay datos para exportar.', 'warning');
      return;
    }

    try {
      const headerData = [
        ['EMPRESA ELÉCTRICA AMBATO REGIONAL CENTRO NORTE S.A. - EEASA'],
        ['SISTEMA SISREC - REPORTE DE PLANES DE ACCIÓN Y EVIDENCIAS POR RESPONSABLE'],
        [this.isAuditorJefe ? 'ALCANCE: GENERAL INSTITUCIONAL' : `ALCANCE: INFORMES ASIGNADOS AL AUDITOR OPERATIVO (${this.currentUser})`],
        [''],
        ['Filtros aplicados:'],
        ['Fecha Desde:', this.filterForm.get('startDate')?.value],
        ['Fecha Hasta:', this.filterForm.get('endDate')?.value],
        ['Auditor Responsable:', this.isAuditorJefe ? (this.filterForm.get('auditor')?.value === '0' ? 'Todos los Auditores' : this.filterForm.get('auditor')?.value) : this.currentUser],
        ['Ente de Control:', this.getOrganismosSeleccionadosLabel()],
        ['Estado Recomendación:', this.estadoRecSeleccionadosTexto],
        ['Estado Verificable:', this.estadoVerificableSeleccionadosTexto],
        ['Plan de Acción:', this.filterForm.get('planAccionFiltro')?.value],
        ['Departamento:', this.filterForm.get('departamento')?.value === '0' ? 'Todos los Departamentos' : this.filterForm.get('departamento')?.value],
        ['Búsqueda / Palabra Clave:', this.filterForm.get('searchTerm')?.value || 'Ninguna'],
        ['Fecha de Generación:', new Date().toLocaleString()],
        ['Total Registros:', this.filteredReports.length],
        ['']
      ];

      const tableHeaders = [
        'Memorando',
        'Memo Aprobación',
        'Título del Informe',
        'Recomendación',
        'Ente de Control',
        'Estado Recomendación',
        'Riesgo',
        'Evidencias Requeridas',
        'Departamento',
        'Responsable',
        'Tiene Plan de Acción',
        'Actividades Plan',
        'Fecha Máxima',
        'Estado del Verificable',
        'Observación de Auditora',
        'Auditor Asignado'
      ];

      const rows = this.filteredReports.map((r) => [
        r.memoAuditoria || '',
        r.memoPresidencia || '',
        r.tituloInforme || '',
        r.recomendacion || '',
        r.organismoControl || '',
        r.estadoRecomendacion || '',
        r.riesgo || '',
        r.evidenciaRequerida || '',
        r.departamento || '',
        r.responsable || '',
        r.tienePlanAccion || 'NO',
        r.cantidadActividadesPlan || 0,
        r.fechaVencimiento || '',
        r.estadoVerificable || 'SIN VERIFICABLE',
        r.observacionAuditor || '',
        r.auditor || ''
      ]);

      const worksheetData = [...headerData, tableHeaders, ...rows];
      const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(worksheetData);

      worksheet['!cols'] = [
        { wch: 18 }, // Memorando
        { wch: 18 }, // Memo Aprobación
        { wch: 45 }, // Título Informe
        { wch: 55 }, // Recomendación
        { wch: 20 }, // Ente de Control
        { wch: 22 }, // Estado Recomendación
        { wch: 14 }, // Riesgo
        { wch: 45 }, // Evidencias Requeridas
        { wch: 30 }, // Departamento
        { wch: 35 }, // Responsable
        { wch: 18 }, // Plan Acción
        { wch: 15 }, // Actividades
        { wch: 15 }, // Fecha Máxima
        { wch: 24 }, // Estado Verificable
        { wch: 45 }, // Obs Auditora
        { wch: 25 }  // Auditor Asignado
      ];

      const workbook: XLSX.WorkBook = {
        Sheets: { 'Planes y Evidencias': worksheet },
        SheetNames: ['Planes y Evidencias']
      };

      const dateStr = this.formatDate(new Date()).replace(/-/g, '');
      const fileName = `Reporte_Planes_Y_Evidencias_${dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.alertsService.showAlert('Reporte exportado exitosamente a Excel.', 'success');
    } catch (e) {
      console.error('Error al exportar a Excel:', e);
      this.alertsService.showAlert('Error al exportar a Excel.', 'error');
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
