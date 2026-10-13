import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { Informe } from '@features/ai-director-informes/models/Informe';
import { InformesDirectorService } from '@features/ai-director-informes/services/informes/informes-director.service';
import {
  OrganismoControl,
  TipoInforme,
} from '@features/ai-rec-verificables/models/Informe';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search-filter.component.html',
  styleUrl: './search-filter.component.css',
})
export class SearchFilterComponent implements OnInit {
  @Output() filterChange = new EventEmitter<Informe[]>();
  @Output() loadingChange = new EventEmitter<boolean>();

  private readonly informesDirecSrv: InformesDirectorService = inject(InformesDirectorService);
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly filterStateService = inject(FilterStateService);
  
  protected filterForm: FormGroup<any>;
  protected hasData = false;
  protected selectOrgCtrl: OrganismoControl[] = [];
  protected selectTipInforme: TipoInforme[] = [];
  protected isLoading = false;

  constructor(private formBuilder: FormBuilder) {
    const today = new Date();
    const firstDayOfYear = new Date(2022, 0, 1);
    this.filterForm = this.formBuilder.group(
      {
        startDate: [this.formatDate(firstDayOfYear)],
        endDate: [this.formatDate(today)],
        orgCtrl: ['0'],
        tipInforme: ['0'],
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
    
    const savedFilters = this.filterStateService.getFilters('director_informes');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.applyFilter();
    this.loadingChange.emit(true);

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('director_informes', val);
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
    const firstDayOfYear = new Date(2022, 0, 1);

    this.filterForm.setValue({
      startDate: this.formatDate(firstDayOfYear),
      endDate: this.formatDate(today),
      orgCtrl: '0',
      tipInforme: '0',
      searchTerm: ''
    }, { emitEvent: false });

    this.filterStateService.clearFilters('director_informes');
    this.applyFilter();
  }

  private applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      this.loadingChange.emit(true);

      const startDate = this.startDateControl.value;
      const endDate = this.endDateControl.value;
      const orgCtrl = this.selectOrgCtrlForm.value;
      const tipInforme = this.selectTipInformeForm.value;
      const departDirector = this.auxiliarSrv.getUserInfo().departamento;
      this.informesDirecSrv
        .getFilteredInformes(orgCtrl, tipInforme, startDate, endDate, departDirector)
        .subscribe({
          next: (response) => {
            this.hasData = response.datos.length > 0;
            const term = this.searchTermControl.value;
            if (term && term.trim() !== '') {
              this.applySearchFilter(term.trim());
            } else {
              this.filterChange.emit(response.datos);
              this.isLoading = false;
              this.loadingChange.emit(false);
            }
          },
          error: () => {
            this.alertsService.showAlert(
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
    const currentData = this.informesDirecSrv.getCurrentData();
    if (currentData) {
      const filteredData = currentData.filter(
        (item) =>
          item.ainin_titulo.toLowerCase().includes(term.toLowerCase()) ||
        item.ainin_ordenTrabajo.toLowerCase().includes(term.toLowerCase()) ||
        item.ainin_memoAprobacion.toLowerCase().includes(term.toLowerCase()) ||
        item.ainin_memorando.toLowerCase().includes(term.toLowerCase())
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

  get searchTermControl(): FormControl {
    return this.filterForm.get('searchTerm') as FormControl;
  }

  private getOrganismosCtrl(): void {
    this.informesDirecSrv.getOrganismoControl().subscribe((response) => {
      this.selectOrgCtrl = response.datos;
    });
  }

  private getTipInforme(): void {
    this.informesDirecSrv.getTipoInforme().subscribe((response) => {
      this.selectTipInforme = response.datos;
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
