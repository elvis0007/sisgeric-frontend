import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { User } from '@core/auth/models/authentication';
import {
  ResponseReadSimple,
} from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { TableRecomendacionesComponent } from '@features/ai-director-informes/components/recomendaciones/table-recomendaciones/table-recomendaciones.component';
import { RecomendacionesVerificablesService } from '@features/ai-director-informes/services/recomendaciones/recomendaciones-verificables.service';
import {
  InformeRecomendacion,
  Recomendacion,
} from '@features/ai-director-informes/models/Recomendacion';
import {
  ResponsableInfo,
  RoleResponsable,
} from '@features/ai-seguim-auditor-operativo/models/responsable';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';

@Component({
  selector: 'app-list-recomendaciones',
  standalone: true,
  imports: [
    CommonModule,
    TableRecomendacionesComponent,
    ModalResponsablesComponent,
  ],
  templateUrl: './list-recomendaciones.component.html',
  styleUrl: './list-recomendaciones.component.css',
})
export class ListRecomendacionesComponent implements OnInit {
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly recomendacionSrv: RecomendacionesVerificablesService =
    inject(RecomendacionesVerificablesService);

  protected recomendaciones: Recomendacion[] = [];
  protected userRolResponsable: RoleResponsable[] = [];
  protected responsablesInfo: ResponsableInfo[] = [];
  protected responsablesFilter: ResponsableInfo[] = [];

  protected rutaHijaActiva: boolean = false;
  protected idInf: number = 0;
  protected isLoading = false;
  protected informeTitulo: string = '';
  protected ordenTrabajo: string = '';
  protected isLoadingRespon = false;
  protected user: User | null = null;

  ngOnInit(): void {
    this.auxiliarSrv.saveUrlParameter(
      this.ruta.snapshot.paramMap.get('id')!,
      'id_inf_ver'
    );
    this.user = this.auxiliarSrv.getUserInfo();
    this.idInf = +atob(this.ruta.snapshot.paramMap.get('id')!);
    this.getDataRecomendaciones();
  }

  private getDataRecomendaciones(): void {
    this.isLoading = true;
    this.recomendacionSrv
      .getRecomendaciones(this.idInf, this.user?.departamento || '')
      .subscribe({
        next: (response: ResponseReadSimple<InformeRecomendacion>) => {
          // Extrae directamente los datos
          this.ordenTrabajo = response.datos.ainin_orden_trabajo;
          this.informeTitulo = response.datos.ainin_titulo;
          this.recomendaciones = response.datos.recomendaciones;
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
}
