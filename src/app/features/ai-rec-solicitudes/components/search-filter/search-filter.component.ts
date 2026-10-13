import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, OnInit, OnDestroy, Output } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { Solicitud, UsuarioResponsable } from '@features/ai-rec-solicitudes/models/solicitud';
import { SolicitudesAuditorService } from '@features/ai-rec-solicitudes/services/solicitudes.service';

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

  private readonly solicitudesSrv: SolicitudesAuditorService =
    inject(SolicitudesAuditorService);
  private readonly alertStateService = inject(AlertsStateService);
  private readonly filterStateService = inject(FilterStateService);
  private readonly route = inject(ActivatedRoute);

  protected usersResponsables: UsuarioResponsable[] = [];
  protected usersResponsablesFilter: UsuarioResponsable[] = [];
  protected filterForm: FormGroup<any>;
  protected searchTermControl = new FormControl('');
  private rawSolicitudes: Solicitud[] = [];
  protected hasData = false;
  protected isLoading = false;

  selectDepartamento: string[] = [];
  aniosDisponibles: number[] = [];
  private subscriptions = new Subscription();

  constructor(private formBuilder: FormBuilder) {
    this.filterForm = this.formBuilder.group({
      anio: [new Date().getFullYear()],
      departamento: ['0'],
    });
  }

  ngOnInit() {
    this.initAniosDisponibles();
    this.getDepartamento();

    const queryAnio = this.route.snapshot.queryParams['anio'];
    const querySol = this.route.snapshot.queryParams['solicitud'];
    const queryArere = this.route.snapshot.queryParams['arere'];

    const savedFilters = this.filterStateService.getFilters('rec_solicitudes');
    if (queryAnio !== undefined && queryAnio !== null) {
      this.filterForm.patchValue({ anio: Number(queryAnio) }, { emitEvent: false });
    } else if (savedFilters) {
      this.filterForm.patchValue(savedFilters, { emitEvent: false });
    }

    if (querySol) {
      this.searchTermControl.setValue(querySol, { emitEvent: false });
    } else if (queryArere) {
      this.searchTermControl.setValue(queryArere, { emitEvent: false });
    }

    this.loadingChange.emit(true);
    this.applyFilter();

    this.subscriptions.add(
      this.filterForm.valueChanges.subscribe((val) => {
        this.filterStateService.setFilters('rec_solicitudes', val);
      })
    );

    this.subscriptions.add(
      this.filterForm
        .get('anio')
        ?.valueChanges.subscribe(() => this.applyFilter())
    );
    this.subscriptions.add(
      this.filterForm
        .get('departamento')
        ?.valueChanges.subscribe(() => this.applyFilter())
    );

    this.subscriptions.add(
      this.searchTermControl.valueChanges
        .pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(() => {
          this.filterAndEmit();
        })
    );

    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        let changed = false;
        if (params['anio'] && Number(params['anio']) !== this.selectAnioForm.value) {
          this.filterForm.patchValue({ anio: Number(params['anio']) }, { emitEvent: false });
          changed = true;
        }
        if (params['solicitud'] && params['solicitud'] !== this.searchTermControl.value) {
          this.searchTermControl.setValue(params['solicitud'], { emitEvent: false });
          changed = true;
        } else if (params['arere'] && params['arere'] !== this.searchTermControl.value) {
          this.searchTermControl.setValue(params['arere'], { emitEvent: false });
          changed = true;
        }
        if (changed) {
          this.applyFilter();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  clearFilters(): void {
    this.filterForm.setValue({
      anio: new Date().getFullYear(),
      departamento: '0'
    }, { emitEvent: false });
    this.searchTermControl.setValue('', { emitEvent: false });

    this.filterStateService.clearFilters('rec_solicitudes');
    this.applyFilter();
  }

  private applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      this.loadingChange.emit(true);

      const departamento = this.selectDepartamentoForm.value;

      this.solicitudesSrv
        .getFilteredSolicitudesAud(departamento, this.selectAnioForm.value)
        .subscribe({
          next: (response) => {
            this.rawSolicitudes = response.datos || [];
            this.filterAndEmit();
          },
          error: () => {
            this.alertStateService.showAlert(
              'Error al cargar las solicitudes',
              'error'
            );
            this.rawSolicitudes = [];
            this.hasData = false;
            this.isLoading = false;
            this.loadingChange.emit(false);
          },
        });
    }
  }

  private filterAndEmit(): void {
    const term = (this.searchTermControl.value || '').trim().toLowerCase();
    let filtered = this.rawSolicitudes;
    if (term) {
      filtered = this.rawSolicitudes.filter((s: Solicitud) => {
        const codSol = String(s.areso_codigo || '');
        const numSol = String(s.numeroSolicitud || '');
        const memo = (s.areso_memorando || '').toLowerCase();
        const desc = (s.areso_descripcion || '').toLowerCase();
        const respNom = (s.responsable?.nombre_completo || '').toLowerCase();
        const respUsu = (s.responsable?.arers_usuario || '').toLowerCase();
        const arereCod = String(s.recomendacion?.arere_codigo || '');
        const arereDesc = (s.recomendacion?.arere_descripcion || '').toLowerCase();

        return (
          codSol.includes(term) ||
          numSol.includes(term) ||
          memo.includes(term) ||
          desc.includes(term) ||
          respNom.includes(term) ||
          respUsu.includes(term) ||
          arereCod.includes(term) ||
          arereDesc.includes(term)
        );
      });
    }
    this.hasData = filtered.length > 0;
    this.filterChange.emit(filtered);
    this.isLoading = false;
    this.loadingChange.emit(false);
  }

  reloadTable(): void {
    this.loadingChange.emit(true);
    setTimeout(() => {
      this.applyFilter();
    }, 0);
  }

  get selectAnioForm(): FormControl {
    return this.filterForm.get('anio') as FormControl;
  }

  get selectDepartamentoForm(): FormControl {
    return this.filterForm.get('departamento') as FormControl;
  }

  private getDepartamento() {
    this.solicitudesSrv.getDepartamentos().subscribe({
      next: (response) => {
        this.selectDepartamento = response.datos;
      },
      error: (error) => {
        console.error(error);
      },
    });
  }

  private initAniosDisponibles(): void {
    const currentYear = new Date().getFullYear();
    this.aniosDisponibles = [];
    for (let y = currentYear + 1; y >= 2018; y--) {
      this.aniosDisponibles.push(y);
    }
  }
}
