import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, OnInit, OnDestroy, Output } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { Solicitud, UsuarioResponsable } from '@features/ai-director-departamental/models/solicitud';
import { SolicitudesDirectorService } from '@features/ai-director-departamental/services/solicitudes.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-search-filter-director',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search-filter.component.html',
  styleUrl: './search-filter.component.css',
})
export class SearchFilterComponent implements OnInit, OnDestroy {
  @Output() filterChange = new EventEmitter<any>();
  @Output() loadingChange = new EventEmitter<boolean>();

  private readonly solicitudesSrv: SolicitudesDirectorService =
    inject(SolicitudesDirectorService);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly filterStateService = inject(FilterStateService);
  private readonly route = inject(ActivatedRoute);

  protected usersResponsables: UsuarioResponsable[] = [];
  protected usersResponsablesFilter: UsuarioResponsable[] = [];
  protected filterForm: FormGroup<any>;
  protected searchTermControl = new FormControl('');
  private rawSolicitudes: Solicitud[] = [];
  protected hasData = false;
  protected isLoading = false;
  protected aniosDisponibles: number[] = [];
  private subscriptions = new Subscription();

  constructor(private formBuilder: FormBuilder) {
    this.filterForm = this.formBuilder.group({
      cod_resp: ['0'],
      anio: [new Date().getFullYear()],
    });
  }

  ngOnInit() {
    this.initAniosDisponibles();
    this.getResponsables();
    
    const queryAnio = this.route.snapshot.queryParams['anio'];
    const querySol = this.route.snapshot.queryParams['solicitud'];
    const queryArere = this.route.snapshot.queryParams['arere'];

    const savedFilters = this.filterStateService.getFilters('director_departamental');
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

    this.applyFilter();
    this.loadingChange.emit(true);

    this.subscriptions.add(
      this.filterForm.valueChanges.subscribe((val) => {
        this.filterStateService.setFilters('director_departamental', val);
      })
    );

    this.subscriptions.add(
      this.filterForm
        .get('cod_resp')
        ?.valueChanges.subscribe(() => this.applyFilter())
    );
    this.subscriptions.add(
      this.filterForm
        .get('anio')
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
      cod_resp: '0',
      anio: new Date().getFullYear(),
    }, { emitEvent: false });
    this.searchTermControl.setValue('', { emitEvent: false });

    this.filterStateService.clearFilters('director_departamental');
    this.applyFilter();
  }

  private applyFilter(): void {
    if (this.filterForm.valid) {
      this.isLoading = true;
      this.loadingChange.emit(true);

      const codResp = this.selectResponsableForm.value;
      const departDirect = this.auxiliarySrv.getUserInfo().departamento;
      this.solicitudesSrv
        .getFilteredSolicitudes(
          departDirect,
          codResp,
          this.selectAnioForm.value.toString()
        )
        .subscribe({
          next: (response) => {
            this.rawSolicitudes = response.datos || [];
            this.filterAndEmit();
          },
          error: () => {
            this.alertsService.showAlert(
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

  // Método que obtiene la lista completa de responsables
  private getResponsables(): void {
    this.solicitudesSrv.getResponsables().subscribe(
      (response) => {
        // Asigna la lista completa de responsables
        this.usersResponsables = response.datos.usuarios; 
        // Obtiene el departamento del usuario actual
        const departDirector = this.auxiliarySrv.getUserInfo().departamento;
        // Filtra la lista por el departamento y asigna a otra variable
        this.usersResponsablesFilter = this.filtrarResponPorDepart(
          departDirector,
          this.usersResponsables
        );
      },
      () => {
        this.usersResponsables = [];
        this.usersResponsablesFilter = [];
      }
    );
  }

  get selectResponsableForm(): FormControl {
    return this.filterForm.get('cod_resp') as FormControl;
  }

  get selectAnioForm(): FormControl {
    return this.filterForm.get('anio') as FormControl;
  }

  // Método que filtra la lista de responsables por el departamento recibido
  private filtrarResponPorDepart(
    departamento: string,
    responsables: any[]
  ): any[] {
    return responsables.filter(
      (responsable) => responsable.departamento === departamento
    );
  }

  private initAniosDisponibles(): void {
    const currentYear = new Date().getFullYear();
    this.aniosDisponibles = [];
    for (let y = currentYear + 1; y >= 2018; y--) {
      this.aniosDisponibles.push(y);
    }
  }
}
