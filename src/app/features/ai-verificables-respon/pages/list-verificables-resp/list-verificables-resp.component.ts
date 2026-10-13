import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { User } from '@core/auth/models/authentication';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { ModalFormFechaMaxComponent } from '@features/ai-verificables-respon/components/solicitud/modal-form-fecha-max/modal-form-fecha-max.component';
import { CardRecomendacionComponent } from '@features/ai-verificables-respon/components/verificables/card-recomendacion/card-recomendacion.component';
import { ModalFormVerificablesComponent } from '@features/ai-verificables-respon/components/verificables/modal-form-verificables/modal-form-verificables.component';
import { ModalVerificablesComponent } from '@features/ai-verificables-respon/components/verificables/modal-verificables/modal-verificables.component';
import { RecomendacionVerificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ModalSolicitudesComponent } from '@features/ai-verificables-respon/components/solicitud/modal-solicitudes/modal-solicitudes.component';
import { ModalSolicitudesService } from '@features/ai-verificables-respon/services/solicitud/modal-solicitudes.service';
import { ModalVerificablesService } from '@features/ai-verificables-respon/services/verificables/modal-verificables.service';
import { SearchFilterResponComponent } from '@features/ai-verificables-respon/components/verificables/search-filter-respon/search-filter-respon.component';
import { NavegacionStateService } from '@features/ai-verificables-respon/services/navegacion-state.service';
import { ActivatedRoute } from '@angular/router';
import { ModalMatrizPlanAccionComponent } from '@features/ai-plan-accion-respon/components/modal-matriz-plan-accion/modal-matriz-plan-accion.component';

@Component({
  selector: 'app-list-verificables-resp',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbsComponent,
    CardRecomendacionComponent,
    ModalVerificablesComponent,
    ModalFormVerificablesComponent,
    ModalFormFechaMaxComponent,
    ModalSolicitudesComponent,
    ModalMatrizPlanAccionComponent,
    SearchFilterResponComponent,
  ],
  templateUrl: './list-verificables-resp.component.html',
  styleUrl: './list-verificables-resp.component.css',
})
export class ListVerificablesRespComponent implements OnInit, OnDestroy {
  private queryParamsSubscription!: Subscription;
  private readonly verificablesRespSrv: VerificablesResponsablesService =
    inject(VerificablesResponsablesService);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly navegacionStateSrv = inject(NavegacionStateService);
  private readonly modalSolicitudSrv = inject(ModalSolicitudesService);
  private readonly modalVerifSrv = inject(ModalVerificablesService);
  protected user: User | null = null;
  protected selectedState: number = 1; // 'PENDIENTES' activado por defecto
  protected selectedYear: number | null = null; // Todos los años por defecto o null para todos
  protected ocultarJustificadas: boolean = false;
  protected soloJustificadas: boolean = false;
  protected soloSolicitudesPendientes: boolean = false;
  protected allRecomendaciones: RecomendacionVerificable[] = [];
  protected recomendaciones: RecomendacionVerificable[] = [];
  protected isEmpty = false;
  protected isLoading = false;
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);

  @ViewChild(CardRecomendacionComponent) cardComponent!: CardRecomendacionComponent;
  @ViewChild(SearchFilterResponComponent) searchFilterResponComponent!: SearchFilterResponComponent;

  ngOnInit(): void {
    this.user = this.auxiliarySrv.getUserInfo();

    // Suscribirse de manera reactiva a los cambios en los query parameters
    this.queryParamsSubscription = this.ruta.queryParams.subscribe(params => {
      const searchParam = params['search'];
      const openSolicitudesId = params['openSolicitudes'];
      const openVerificablesId = params['openVerificables'];

      const arereId = openSolicitudesId ? +openSolicitudesId : (openVerificablesId ? +openVerificablesId : null);

      const processParams = () => {
        if (searchParam) {
          this.selectedYear = null; // Buscar en todos los años al venir de un acceso directo de notificación
        }

        const stateFromNavigation = this.navegacionStateSrv.getSelectedState();
        if (stateFromNavigation !== null) {
          this.selectedState = stateFromNavigation;
          this.selectedYear = null; // Cargar todos los años al venir desde un acceso directo
        }

        this.ocultarJustificadas = this.navegacionStateSrv.getOnlyPendingJustify();
        this.soloJustificadas = this.navegacionStateSrv.getOnlyShowJustified();
        this.soloSolicitudesPendientes = this.navegacionStateSrv.getOnlyPendingRequests();
        this.navegacionStateSrv.clearState();

        this.fetchRecomendaciones();
      };

      if (arereId) {
        this.isLoading = true;
        this.verificablesRespSrv.getRecomendacionDetalle(arereId).subscribe({
          next: (res) => {
            if (res && res.datos && res.datos.recomendaciones && res.datos.recomendaciones.estado_seguimiento) {
              const stateId = res.datos.recomendaciones.estado_seguimiento.arees_codigo;
              if (stateId) {
                this.selectedState = stateId;
              }
            }
            this.isLoading = false;
            processParams();
          },
          error: (err) => {
            console.error('Error fetching recommendation state detail:', err);
            this.isLoading = false;
            processParams();
          }
        });
      } else {
        processParams();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }

  protected fetchRecomendaciones(): void {
    if (!this.user) {
      return;
    }
    this.isLoading = true;
    this.isEmpty = false;
    const cod_per = this.user?.codigo_per || ''; // Obtener el código de usuario
    const anioStr = this.selectedYear ? this.selectedYear.toString() : '0';

    if (this.soloSolicitudesPendientes) {
      // Para mostrar todas las solicitudes pendientes, consultamos tanto el estado 1 (PENDIENTES) como el 3 (NO CUMPLIDAS)
      import('rxjs').then(({ forkJoin }) => {
        forkJoin({
          pendientes: this.verificablesRespSrv.getRecResponsables(1, cod_per, anioStr),
          vencidas: this.verificablesRespSrv.getRecResponsables(3, cod_per, anioStr)
        }).subscribe({
          next: (res) => {
            const listPendientes = res.pendientes.datos || [];
            const listVencidas = res.vencidas.datos || [];
            this.allRecomendaciones = [...listPendientes, ...listVencidas];
            this.aplicarFiltroOcultarJustificadas();
            this.isLoading = false;
          },
          error: (err) => {
            this.isLoading = false;
            console.error(err);
          }
        });
      });
    } else {
      this.verificablesRespSrv
        .getRecResponsables(
          this.selectedState,
          cod_per,
          anioStr
        )
        .subscribe({
          next: (response) => {
            this.allRecomendaciones = response.datos || [];
            this.aplicarFiltroOcultarJustificadas();
            this.isLoading = false;
          },
          error: (err) => {
            this.isLoading = false;
            console.error(err);
          },
        });
    }
  }

  protected quitarFiltroSolicitudes(): void {
    this.soloSolicitudesPendientes = false;
    this.fetchRecomendaciones();
  }

  protected aplicarFiltroOcultarJustificadas(): void {
    let filtradas = [...this.allRecomendaciones];

    // Filtrar para mostrar solo recomendaciones con solicitudes de prórroga pendientes
    if (this.soloSolicitudesPendientes) {
      filtradas = filtradas.filter(
        (rec) => rec.recomendaciones.estado_solicitud === 'PENDIENTE' || rec.recomendaciones.estado_solicitud === 'APROBADO_PARCIAL'
      );
    }

    if ((this.selectedState === 1 || this.selectedState === 3) && this.ocultarJustificadas) {
      filtradas = filtradas.filter(
        (rec) => rec.recomendaciones.estado_verificable !== 'JUSTIFICA'
      );
    } else if ((this.selectedState === 1 || this.selectedState === 3) && this.soloJustificadas) {
      filtradas = filtradas.filter(
        (rec) => rec.recomendaciones.estado_verificable === 'JUSTIFICA'
      );
    }
    this.recomendaciones = filtradas;
    this.isEmpty = this.recomendaciones.length === 0;
    console.log("isEmpty: " + this.isEmpty);

    if (this.searchFilterResponComponent) {
      this.searchFilterResponComponent.updateOriginalData(filtradas);
    }

    const openSolicitudesId = this.ruta.snapshot.queryParams['openSolicitudes'];
    const openVerificablesId = this.ruta.snapshot.queryParams['openVerificables'];

    if (this.user) {
      if (openSolicitudesId) {
        if (!this.modalSolicitudSrv.isModalOpen()) {
          this.modalSolicitudSrv.openModal({
            arere_codigo: +openSolicitudesId,
            codigo_per: this.user.codigo_per
          });
        }
      } else if (openVerificablesId) {
        if (!this.modalVerifSrv.isModalOpen()) {
          this.modalVerifSrv.openModal({
            codRec: +openVerificablesId,
            codPer: this.user.codigo_per,
            status: this.selectedState
          });
        }
      }
    }
  }

  protected setFilter(state: number): void {
    this.selectedState = state;
    this.soloSolicitudesPendientes = false;
    this.fetchRecomendaciones();
  }

  protected onFilterChange(filteredData: RecomendacionVerificable[]): void {
    this.recomendaciones = filteredData;
    this.isEmpty = filteredData.length === 0;
  }

  protected onLoadingChange(isLoading: boolean): void {
    this.isLoading = isLoading;
  }

  reloadCards(): void {
    this.allRecomendaciones = [];
    this.recomendaciones = [];
    setTimeout(() => {
      this.fetchRecomendaciones();
    });
  }
}
