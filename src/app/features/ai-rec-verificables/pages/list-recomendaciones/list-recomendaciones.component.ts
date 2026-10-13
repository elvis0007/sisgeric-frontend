import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { TableRecomendacionesComponent } from '@features/ai-rec-verificables/components/recomendaciones/table-recomendaciones/table-recomendaciones.component';
import { RecomendacionesVerificablesService } from '@features/ai-rec-verificables/services/recomendaciones/recomendaciones-verificables.service';
import {
  ResponseReadSimple,
} from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import {
  InformeRecomendacion,
  Recomendacion,
} from '@features/ai-rec-verificables/models/Recomendacion';
import { InformesVerificablesService } from '@features/ai-rec-verificables/services/informes/informes-verificables.service';
import { Informe } from '@features/ai-rec-verificables/models/Informe';
import { ModalFechaMaxComponent } from '@features/ai-rec-verificables/components/recomendaciones/modal-fecha-max/modal-fecha-max.component';
import {
  ResponsableInfo,
  RoleResponsable,
} from '@features/ai-seguim-auditor-operativo/models/responsable';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';
import { User } from '@core/auth/models/authentication';
import { ModalEstadoSeguimComponent } from '@features/ai-rec-verificables/components/recomendaciones/modal-estado-seguim/modal-estado-seguim.component';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-list-recomendaciones',
  standalone: true,
  imports: [
    CommonModule,
    TableRecomendacionesComponent,
    RouterOutlet,
    ModalFechaMaxComponent,
    ModalResponsablesComponent,
    ModalEstadoSeguimComponent,
    ReactiveFormsModule
  ],
  templateUrl: './list-recomendaciones.component.html',
  styleUrl: './list-recomendaciones.component.css',
})
export class ListRecomendacionesComponent implements OnInit, OnDestroy {
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly recomendacionSrv: RecomendacionesVerificablesService =
    inject(RecomendacionesVerificablesService);
  private readonly informesSrv: InformesVerificablesService = inject(InformesVerificablesService);
  private readonly ngZone = inject(NgZone);
  private popStateListener: any;
  protected recomendaciones: Recomendacion[] = [];
  protected userRolResponsable: RoleResponsable[] = [];
  protected responsablesInfo: ResponsableInfo[] = [];
  protected responsablesFilter: ResponsableInfo[] = [];
  protected selectedResponsables: ResponsableInfo[] = [];
  protected rutaHijaActiva: boolean = false;
  protected idInf: number = 0;
  protected isLoading = false;
  protected informeTitulo: string = '';
  protected ordenTrabajo: string = '';
  protected memorando: string = '';
  protected isLoadingRespon = false;
  protected user: User | null = null;
  protected searchTermControl = new FormControl('');
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.auxiliarSrv.saveUrlParameter(
      this.ruta.snapshot.paramMap.get('id')!,
      'id_inf_ver'
    );
    this.user = this.auxiliarSrv.getUserInfo();
    this.idInf = +atob(this.ruta.snapshot.paramMap.get('id')!);
    this.getDataRecomendaciones();

    // Configurar el debounce para la búsqueda
    const subscription = this.searchTermControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        // No necesitamos hacer nada aquí, el valor se pasará automáticamente al componente hijo
      });

    this.subscriptions.push(subscription);

    // Agregar listener para el evento popstate (cuando el usuario usa los botones de navegación del navegador)
    this.popStateListener = () => {
      if (!this.rutaHijaActiva) {
        this.reloadTable();
      }
    };
    window.addEventListener('popstate', this.popStateListener);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Eliminar el listener del evento popstate
    if (this.popStateListener) {
      window.removeEventListener('popstate', this.popStateListener);
    }
  }

  private getDataRecomendaciones(): void {
    this.isLoading = true;
    this.recomendacionSrv
      .getRecomendaciones(this.idInf)
      .subscribe({
        next: (response: ResponseReadSimple<InformeRecomendacion>) => {
          // Extrae directamente los datos
          this.ordenTrabajo = response.datos.ainin_orden_trabajo;
          this.informeTitulo = response.datos.ainin_titulo;
          this.recomendaciones = response.datos.recomendaciones;
          // Intentar obtener el memorando desde el recurso de informes (si está disponible)
          try {
            const informeReq: Informe = { ainin_codigo: this.idInf, ainin_titulo: '', progreso: 0, ainin_ordenTrabajo: '', ainin_infAdjunto: '', urlArchivo: '', ainin_fechaEmision: '', ainin_fechaAprobacion: '', ainin_memoAprobacion: '', ainin_memorando: '', ainin_fechaMemo: '', tipoInf: { ainti_codigo: 0, ainti_descripcion: '' }, organismoControl: { ainoc_codigo: 0, ainoc_descripcion: '' }, totalRecomendaciones: 0, ainin_usuario: '' };
            this.informesSrv.getInformeByCod(informeReq).subscribe({
              next: (infResp: ResponseReadSimple<Informe>) => {
                this.memorando = infResp.datos.ainin_memorando || '';
              },
              error: () => {
                // Silenciar error, mantener fallback
              },
            });
          } catch (e) {
            // Ignorar si el servicio no está disponible
          }
          this.isLoading = false;
        },
        error: () => {
          this.alertsService.showAlert('Error al obtener recomendaciones.', 'error');
          this.isLoading = false;
        },
      });
  }

  reloadTable(): void {
    this.getDataRecomendaciones();
  }

  protected enActivacionRutaHija(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.rutaHijaActiva = true;
      });
    });
  }

  protected enDesactivacionRutaHija(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.rutaHijaActiva = false;
        // Recargar datos cuando se regresa a esta página
        this.reloadTable();
      });
    });
  }
}
