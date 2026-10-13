import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, Input, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import {
  OrganismoControl,
  UsuarioAuditor,
} from '@features/ai-seguim-auditor-general/models/informe-ag';
import { TipoInforme } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { InformesAgService } from '@features/ai-seguim-auditor-general/services/informes-ag/informes-ag.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-search-filter-ag',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './search-filter-ag.component.html',
  styleUrl: './search-filter-ag.component.css',
})
export class SearchFilterAgComponent {
  @Output() filterChange = new EventEmitter<any>();
  @Output() loadingChange = new EventEmitter<boolean>();
  private readonly informesSrv: InformesAgService = inject(InformesAgService);
  protected readonly alertService = inject(AlertsStateService);
  private readonly filterStateService = inject(FilterStateService);

  protected filterForm: FormGroup<any>;
  protected hasData = false;
  protected isLoading = false;

  protected selectOrgCtrl: OrganismoControl[] = [];
  protected selectTipInforme: TipoInforme[] = [];
  protected selectAuditorOp: UsuarioAuditor[] = [];

  constructor(private formBuilder: FormBuilder) {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        orgCtrl: ['0'],
        tipInforme: ['0'],
        auditorOp: ['0'],
        searchTerm: [''],
      },
      { validators: this.dateRangeValidator }
    );
  }

  reloadTable(): void {
    this.loadingChange.emit(true);
    setTimeout(() => {
      this.applyFilter();
    }, 0);
  }

  ngOnInit() {
    this.getOrganismosCtrl();
    this.getTipInforme();
    this.getAuditoresOperativos();

    const savedFilters = this.filterStateService.getFilters('seguim_auditor_general');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }
    
    this.loadingChange.emit(true);
    this.applyFilter();

    this.filterForm.valueChanges.subscribe((val) => {
      const existing = this.filterStateService.getFilters('seguim_auditor_general') || {};
      this.filterStateService.setFilters('seguim_auditor_general', { ...existing, ...val, currentPage: 1 });
    });

    this.filterForm
      .get('startDate')
      ?.valueChanges.subscribe(() => this.applyFilter());
    this.filterForm
      .get('endDate')
      ?.valueChanges.subscribe(() => this.applyFilter());
    this.filterForm
      .get('orgCtrl')
      ?.valueChanges.subscribe(() => this.applyFilter());
    this.filterForm
      .get('tipInforme')
      ?.valueChanges.subscribe(() => this.applyFilter());
    this.filterForm
      .get('auditorOp')
      ?.valueChanges.subscribe(() => this.applyFilter());

    this.searchTermControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((term) => {
        if (term === '') {
          this.applyFilter();
        } else {
          this.applySearchFilter(term);
        }
      });
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      orgCtrl: '0',
      tipInforme: '0',
      auditorOp: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.organismosSeleccionados = [];
    this.filterStateService.clearFilters('seguim_auditor_general');
    this.applyFilter();
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
    this.applyFilter();
  }

  toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.applyFilter();
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

  private applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      this.loadingChange.emit(true);
      
      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      const tipInforme = this.selectTipInformeForm.value;
      const auditorOp = this.selectAuditorOpForm.value;

      this.informesSrv
        .getFilteredInformes(0, tipInforme, startDate, endDate, auditorOp)
        .subscribe({
          next: (response) => {
            let data = response.datos || [];

            if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
              const selectedDescs = this.organismosSeleccionados
                .map((cod: number) => {
                  const org = this.selectOrgCtrl.find(o => Number(o.ainoc_codigo) === cod);
                  return org ? org.ainoc_descripcion : '';
                })
                .filter((desc: string) => Boolean(desc) && desc !== 'Todos')
                .map((desc: string) => desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());

              if (selectedDescs.length > 0) {
                data = data.filter((item: any) => {
                  const normOrg = (item.ainoc_descripcion || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                  return selectedDescs.includes(normOrg);
                });
              }
            }

            this.hasData = data.length > 0;
            const term = this.searchTermControl.value;
            if (term && term.trim() !== '') {
              this.applySearchFilter(term.trim());
            } else {
              this.filterChange.emit(data);
              this.isLoading = false;
              this.loadingChange.emit(false);
            }
          },
          error: () => {
            this.alertService.showAlert(
              'Error al cargar los registros',
              'error'
            );
            this.hasData = false;
            this.isLoading = false;
            this.loadingChange.emit(false);
          },
        });
    }
  }

  private applySearchFilter(term: string): void {
    const currentData = this.informesSrv.getCurrentData();
    if (currentData) {
      this.isLoading = true;
      this.loadingChange.emit(true);
      
      const filteredData = currentData.filter(
        (item) =>
          item.ainin_ordenTrabajo.toLowerCase().includes(term.toLowerCase()) ||
          item.ainin_memorando.toLowerCase().includes(term.toLowerCase()) ||
          item.ainin_titulo.toLowerCase().includes(term.toLowerCase()) ||
          item.ainin_memoAprobacion.toLowerCase().includes(term.toLowerCase())
      );
      this.hasData = filteredData.length > 0;
      this.filterChange.emit(filteredData);
      
      this.isLoading = false;
      this.loadingChange.emit(false);
    }
  }

  get startDateControl(): FormControl {
    return this.filterForm.get('startDate') as FormControl;
  }

  get endDateControl(): FormControl {
    return this.filterForm.get('endDate') as FormControl;
  }

  get selectOrgCtrlForm(): FormControl {
    return this.filterForm.get('orgCtrl') as FormControl;
  }

  get selectTipInformeForm(): FormControl {
    return this.filterForm.get('tipInforme') as FormControl;
  }

  get selectAuditorOpForm(): FormControl {
    return this.filterForm.get('auditorOp') as FormControl;
  }

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  private getOrganismosCtrl(): void {
    this.informesSrv.getOrganismoControl().subscribe((response) => {
      this.selectOrgCtrl = response.datos;
    });
  }

  private getTipInforme(): void {
    this.informesSrv.getTipoInforme().subscribe((response) => {
      this.selectTipInforme = response.datos;
    });
  }

  private getAuditoresOperativos(): void {
    this.informesSrv.getAuditores().subscribe((response) => {
      this.selectAuditorOp = response.datos.usuarios;
    });
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
}
