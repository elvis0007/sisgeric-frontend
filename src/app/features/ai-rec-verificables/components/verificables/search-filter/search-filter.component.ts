import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, OnInit, OnDestroy, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { User } from '@core/auth/models/authentication';
import { FilterStateService } from '@core/services/filter-state.service';
import { Responsable } from '@features/ai-rec-verificables/models/Responsable';
import { RecomendacionVerificable } from '@features/ai-rec-verificables/models/Verificable';
import { VerificablesService } from '@features/ai-rec-verificables/services/verificables/verificables.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search-filter.component.html',
  styleUrl: './search-filter.component.css',
})
export class SearchFilterComponent implements OnInit, OnDestroy {
  private paramsSub!: Subscription;
  private readonly route = inject(ActivatedRoute);
  @Output() loadingChange = new EventEmitter<boolean>();
  @Output() filterChange = new EventEmitter<any>();
  @Output() responsablesStatusChange = new EventEmitter<boolean>();

  private readonly verificableSrv: VerificablesService =
    inject(VerificablesService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly filterStateService = inject(FilterStateService);

  public selectResponsable: Responsable[] = [];

  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);

  protected hasData = false;
  protected isLoading = false;
  protected filterForm: FormGroup<any>;
  protected user: User | null = null;
  private recomendacionVerificables: RecomendacionVerificable | null = null;

  constructor(private formBuilder: FormBuilder) {
    this.filterForm = this.formBuilder.group({
      arers_codigo_per: ['0'],
    });
  }

  ngOnInit() {
    this.user = this.auxiliarSrv.getUserInfo();
    
    this.paramsSub = this.route.params.subscribe(params => {
       const id = params['id'];
       if (id) {
         const codRecom = atob(id);
         this.getResponsablesFilter(codRecom);
       }
    });

    const savedFilters = this.filterStateService.getFilters('rec_verificables_verificables');
    if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    this.filterForm.valueChanges.subscribe((val) => {
      this.filterStateService.setFilters('rec_verificables_verificables', val);
    });

    this.filterForm
      .get('arers_codigo_per')
      ?.valueChanges.subscribe(() => this.applyFilter());
  }

  ngOnDestroy() {
    if (this.paramsSub) {
      this.paramsSub.unsubscribe();
    }
  }

  clearFilters(): void {
    this.filterForm.setValue({
      arers_codigo_per: '0'
    }, { emitEvent: false });

    this.filterStateService.clearFilters('rec_verificables_verificables');
    this.applyFilter();
  }

  reloadTable(): void {
    this.loadingChange.emit(true);
    setTimeout(() => {
      this.applyFilter();
    }, 0);
  }

  get selectRespControl(): FormControl {
    return this.filterForm.get('arers_codigo_per') as FormControl;
  }

  private checkResponsablesStatus(): void {
    if (!this.recomendacionVerificables || !this.selectResponsable) return;

    const allResponsablesHaveJustifica = this.selectResponsable.every(responsable => {
      const verificablesForResponsable = this.recomendacionVerificables?.verificables.filter(
        v => v.responsable.arers_codigo_per === responsable.arers_codigo_per
      );

      // Si el responsable no tiene verificables, retornamos false para mantener el botón habilitado
      if (!verificablesForResponsable || verificablesForResponsable.length === 0) {
        return false;
      }

      // Verificar si al menos uno de los verificables tiene estado JUSTIFICA
      return verificablesForResponsable.some(
        v => v.estado_seguimiento.areev_descripcion === 'JUSTIFICA'
      );
    });

    this.responsablesStatusChange.emit(allResponsablesHaveJustifica);
  }

  private applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      this.loadingChange.emit(true);
      let responsable = this.selectRespControl.value;
      const codRecom = this.auxiliarSrv.getUrlParameter('id_det_rec');
      this.verificableSrv
        .getVerificables(codRecom, responsable.toString())
        .subscribe({
          next: (response) => {
            this.recomendacionVerificables = response.datos;
            this.filterChange.emit(this.recomendacionVerificables);
            this.checkResponsablesStatus();
            this.isLoading = false;
            this.loadingChange.emit(false);
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

  protected getResponsablesFilter(codRecom: string): void {
    this.isLoading = true;
    this.loadingChange.emit(true);
    this.verificableSrv
      .getResposablesForFilter(codRecom)
      .subscribe({
        next: (response) => {
          this.selectResponsable = response.datos.filter(
            (responsable: Responsable) => responsable.arers_estado === '1'
          );
          this.applyFilter();
        },
        error: () => {
          this.isLoading = false;
          this.loadingChange.emit(false);
        }
      });
  }
}
