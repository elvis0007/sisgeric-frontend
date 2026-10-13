import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ModalAddResponsablesComponent } from '@features/ai-seguim-auditor-operativo/components/conclusiones/modal-add-responsables/modal-add-responsables.component';
import { ModalFormRecomendacionesComponent } from '@features/ai-seguim-auditor-operativo/components/recomendaciones/modal-form-recomendaciones/modal-form-recomendaciones.component';
import { ModalResponsablesComponent } from '@features/ai-seguim-auditor-operativo/components/recomendaciones/modal-responsables/modal-responsables.component';
import { TableRecomendacionesComponent } from '@features/ai-seguim-auditor-operativo/components/recomendaciones/table-recomendaciones/table-recomendaciones.component';
import { Responsable } from '@features/ai-seguim-auditor-operativo/models/conclusion';
import {
  ConclusionRecomendaciones,
  Recomendacion,
} from '@features/ai-seguim-auditor-operativo/models/recomendacion';
import {
  ResponsableInfo,
  RoleResponsable,
} from '@features/ai-seguim-auditor-operativo/models/responsable';
import { ConclusionesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/conclusiones.service';
import { ModalAddResponsablesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/modal-add-responsables.service';
import { ModalResponsablesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/modal-responsables.service';
import { ModalFormRecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/modal-form-recomendaciones.service';
import { RecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/recomendaciones.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-list-recomendaciones',
  standalone: true,
  imports: [
    CommonModule,
    TableRecomendacionesComponent,
    ModalResponsablesComponent,
    ModalFormRecomendacionesComponent,
    ModalAddResponsablesComponent,
    ReactiveFormsModule,
    RouterOutlet
  ],
  templateUrl: './list-recomendaciones.component.html',
  styleUrl: './list-recomendaciones.component.css',
})
export class ListRecomendacionesComponent implements OnInit, OnDestroy {
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly recomendacionSrv: RecomendacionesService = inject(
    RecomendacionesService
  );
  private conclusionSrv: ConclusionesService = inject(ConclusionesService);
  protected modalAddResponsSrv: ModalAddResponsablesService = inject(
    ModalAddResponsablesService
  );
  protected readonly modalResponsableSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );

  private readonly modalFormSrv: ModalFormRecomendacionesService = inject(
    ModalFormRecomendacionesService
  );

  protected readonly alertsService = inject(AlertsStateService);
  private subscriptions: Subscription[] = [];
  protected searchTermControl = new FormControl('');
  protected recomendaciones: Recomendacion[] = [];
  protected conclusionRecomendacion!: ConclusionRecomendaciones;

  protected idCon: number = 0;
  protected conclusionTitle: string = '';
  protected userRolResponsable: RoleResponsable[] = [];
  protected responsablesInfo: ResponsableInfo[] = [];
  protected responsablesFilter: ResponsableInfo[] = [];
  protected selectedResponsables: ResponsableInfo[] = [];
  protected ordenTrabajo: string = '';
  protected informeFechaAprob!: Date;
  protected isLoading = false;
  protected isLoadingRespon = false;
  protected isSubmitting = false;
  private readonly modalConfirmationService = inject(ModalConfirmationService);

  protected get rutaHijaActiva(): boolean {
    return !!this.ruta.firstChild;
  }

  ngOnInit(): void {
    this.auxiliarSrv.saveUrlParameter(
      this.ruta.snapshot.paramMap.get('id')!,
      'id_con'
    );
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
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private getDataRecomendaciones(): void {
    this.isLoading = true;
    const id: number = +atob(this.ruta.snapshot.paramMap.get('id')!);
    this.recomendacionSrv.getRecomendaciones(id).subscribe({
      next: (response: ResponseReadSimple<ConclusionRecomendaciones>) => {
        this.idCon = response.datos.areco_codigo;
        this.conclusionTitle = response.datos.areco_conclusion;
        this.ordenTrabajo = response.datos.ainin_orden_trabajo;
        const dateStr = response.datos.arere_fecha_inicio_control;
        if (dateStr) {
          const onlyDateStr = dateStr.split(' ')[0];
          const [anio, mes, dia] = onlyDateStr.split('-').map(Number);
          this.informeFechaAprob = new Date(anio, mes - 1, dia);
        }
        this.conclusionRecomendacion = response.datos;
        this.recomendaciones = this.conclusionRecomendacion.recomendaciones;
        this.isLoading = false;
      },
      error: () => {
        this.alertsService.showAlert(
          'Error al cargar recomendaciones',
          'error'
        );
        this.isLoading = false;
      },
    });
  }

  protected openModal() {
    let fechaInicioStr = '';
    if (this.informeFechaAprob) {
      const anio = this.informeFechaAprob.getFullYear();
      const mes = String(this.informeFechaAprob.getMonth() + 1).padStart(2, '0');
      const dia = String(this.informeFechaAprob.getDate()).padStart(2, '0');
      fechaInicioStr = `${anio}-${mes}-${dia}`;
    }
    const recomendacion: Recomendacion = {
      arere_codigo: 0,
      arere_num_rec: 0,
      arere_descripcion: '',
      arere_fecha_inicio_control: fechaInicioStr,
      arere_fecha_maxima: '',
      plazo: 0,
      estado_seguimiento: { arees_codigo: 0, arees_descripcion: '' },
      motivo_estado: '',
      responsables: 0,
    }
    this.modalFormSrv.openModal(recomendacion, 'create');
  }

  protected reloadTable(): void {
    this.getDataRecomendaciones();
  }

  protected onResponsablesSelected(responsables: ResponsableInfo[]): void {
    // Suponemos que en el servicio se almacena el tipo de operación seleccionado
    const operationType = this.modalAddResponsSrv.getOperationType();
    if (operationType === 'replace') {
      this.replaceResponsable(responsables);
    } else {
      this.assignResponsables(responsables);
    }
  }

  private assignResponsables(responsables: ResponsableInfo[]): void {
    if (this.modalResponsableSrv.isCumplida()) {
      this.alertsService.showAlert('No se pueden asignar responsables a una recomendación cumplida', 'error');
      return;
    }
    if (this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;
    const mappedResponsables: Responsable[] = responsables.map(
      (responsable) => ({
        arers_codigo_per: responsable.CODIGO,
        arers_nombre: responsable.NOMBRES,
        arers_apellido: responsable.APELLIDOS,
        arers_correo: responsable.EMAIL,
        arers_seccion: responsable.SECCION,
        arers_cargo: responsable.CARGO,
        arers_departamento: responsable.DEPARTAMENTO,
        arers_departamento_abrev: responsable.DEPARTAMENTO_ABREV,
        arers_num_rol: responsable.ROL,
        arers_usuario_per: responsable.USUARIO,
      })
    );

    const id_rec = this.modalResponsableSrv.modalData();
    this.recomendacionSrv
      .assignResponsables(mappedResponsables, id_rec)
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.alertsService.showAlert(response.mensaje, 'success');
          this.modalResponsableSrv.closeModal();
          this.reloadTable();
        },
        error: (error) => {
          this.isSubmitting = false;
          const errorMsg = error?.message || 'Error al registrar responsables';
          const lowerMsg = errorMsg.toLowerCase();
          if (
            lowerMsg.includes('rol') ||
            lowerMsg.includes('administracion') ||
            lowerMsg.includes('administrador') ||
            lowerMsg.includes('sistema') ||
            lowerMsg.includes('asignar')
          ) {
            this.modalConfirmationService.show({
              title: 'Error de Validación',
              message: errorMsg,
              confirmText: 'ENTENDIDO',
              cancelText: '',
              confirmButtonType: 'error',
              cancelButtonType: 'error',
              titleClass: 'text-error'
            });
          } else {
            this.alertsService.showAlert(errorMsg, 'error');
          }
        },
      });
  }

  private replaceResponsable(responsable: ResponsableInfo[]): void {
    if (this.modalResponsableSrv.isCumplida()) {
      this.alertsService.showAlert('No se pueden reasignar responsables a una recomendación cumplida', 'error');
      return;
    }
    if (this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;
    const responsableReplace: Responsable = {
      arers_codigo_per: responsable[0].CODIGO,
      arers_nombre: responsable[0].NOMBRES,
      arers_apellido: responsable[0].APELLIDOS,
      arers_correo: responsable[0].EMAIL,
      arers_seccion: responsable[0].SECCION,
      arers_cargo: responsable[0].CARGO,
      arers_departamento: responsable[0].DEPARTAMENTO,
      arers_departamento_abrev: responsable[0].DEPARTAMENTO_ABREV,
      arers_num_rol: responsable[0].ROL,
      arers_usuario_per: responsable[0].USUARIO,
    };

    const id_rec = this.modalResponsableSrv.modalData();
    const oldResponsableCode = this.modalAddResponsSrv.modalData().arers_codigo;

    // Llamada al API para reemplazar (asegúrate de que tu servicio lo soporte)
   this.recomendacionSrv.replaceResponsable(id_rec, oldResponsableCode, responsableReplace).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.alertsService.showAlert(response.mensaje, 'success');
        this.modalResponsableSrv.closeModal();
        this.reloadTable();
      },
      error: (error) => {
        this.isSubmitting = false;
        const errorMsg = error?.message || 'Error al reasignar responsable';
        const lowerMsg = errorMsg.toLowerCase();
        if (
          lowerMsg.includes('rol') ||
          lowerMsg.includes('administracion') ||
          lowerMsg.includes('administrador') ||
          lowerMsg.includes('sistema') ||
          lowerMsg.includes('asignar')
        ) {
          this.modalConfirmationService.show({
            title: 'Error de Validación',
            message: errorMsg,
            confirmText: 'ENTENDIDO',
            cancelText: '',
            confirmButtonType: 'error',
            cancelButtonType: 'error',
            titleClass: 'text-error'
          });
        } else {
          this.alertsService.showAlert(errorMsg, 'error');
        }
      },
    });

  }

  protected openModalAddResponsable(
    responsablesCodigos: string[],
    codes: {},
    type: 'assing' | 'replace',
  ): Promise<void> {
    this.isLoadingRespon = true;

    return new Promise((resolve, reject) => {
      this.conclusionSrv.getPersonalInfo().subscribe({
        next: (response) => {
          this.responsablesFilter = response.DATA.map((r) => {
            //  marcar como seleccionados los que coincidan
            const isAssignedOrSelected =
              this.selectedResponsables.some(
                (selected) => selected.CODIGO === r.CODIGO
              ) ||
              (responsablesCodigos && responsablesCodigos.includes(r.CODIGO));

            return {
              ...r,
              isAssigned: isAssignedOrSelected,
              selected: isAssignedOrSelected,
            };
          });

          if (this.responsablesFilter.length > 0) {
            this.modalAddResponsSrv.openModal(codes, type);
          } else {
            this.alertsService.showAlert(
              'No se encontraron responsables para mostrar',
              'warning'
            );
          }
          resolve();
        },
        error: () => {
          this.alertsService.showAlert(
            'Error al cargar datos para los responsables',
            'error'
          );
          reject();
        },
        complete: () => {
          this.isLoadingRespon = false;
        },
      });
    });
  }
}
