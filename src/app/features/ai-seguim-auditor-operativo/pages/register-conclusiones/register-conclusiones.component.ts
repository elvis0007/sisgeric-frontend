import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalAddResponsablesComponent } from '@features/ai-seguim-auditor-operativo/components/conclusiones/modal-add-responsables/modal-add-responsables.component';
import {
  ConclusionEscritura,
  Recomendacion,
  Responsable,
} from '@features/ai-seguim-auditor-operativo/models/conclusion';
import {
  ResponsableInfo,
  RoleResponsable,
} from '@features/ai-seguim-auditor-operativo/models/responsable';
import { ConclusionesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/conclusiones.service';
import { ModalAddResponsablesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/modal-add-responsables.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Router } from '@angular/router';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { Subscription, forkJoin, map } from 'rxjs';
import { RoleUserService } from '@features/ai-seg-role-user/services/role-user.service';

@Component({
  selector: 'app-register-conclusiones',
  standalone: true,
  imports: [
    CommonModule,
    ModalAddResponsablesComponent,
    FormsModule
  ],
  templateUrl: './register-conclusiones.component.html',
  styleUrl: './register-conclusiones.component.css',
})
export class RegisterConclusionesComponent implements OnInit, OnDestroy {
  @ViewChild('targetElement') targetElement!: ElementRef;

  protected modalAddResponsSrv: ModalAddResponsablesService = inject(
    ModalAddResponsablesService
  );
  protected readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];

  private conclusionSrv: ConclusionesService = inject(ConclusionesService);
  private auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly router = inject(Router);
  private roleUserSrv: RoleUserService = inject(RoleUserService);

  protected currentStep = 1; // Indica el paso actual
  protected isLoading = false; // Estado de carga para responsables
  protected isLoadingTitles = false;
  protected isSubmitting = false; // Estado de envío para evitar doble confirmación/notificación

  protected numHallazgo: string = '';
  protected numInforme: string = '';
  protected userRolResponsable: RoleResponsable[] = [];
  protected responsablesInfo: ResponsableInfo[] = [];
  protected responsablesFilter: ResponsableInfo[] = [];
  protected selectedResponsables: ResponsableInfo[] = [];

  protected conclusion!: ConclusionEscritura;
  protected recomendaciones: Recomendacion[] = [];

  protected conclusionText: string = ''; // Vinculado al campo de texto
  protected recommendationText: string = ''; // Vinculado al campo de recomendación
  protected recommendationDate: string = ''; // Vinculado al campo de fecha máxima
  protected numRecomendacion: number = 1;
  protected defaultDate: string = ''; // Fecha predeterminada
  protected showError: boolean = false; // Controla el mensaje de error
  protected showRecommendationError: boolean = false; // Controla el mensaje de error para recomendación
  protected showNumRecError: boolean = false;
  protected showRiskError = false;
  private readonly evidenciasPorRecomendacion = new Map<Recomendacion, { texto: string }[]>();

  protected evidencias(recom: Recomendacion): { texto: string }[] {
    let lista = this.evidenciasPorRecomendacion.get(recom);
    if (!lista) {
      lista = [{ texto: recom.arere_evidencia_requerida || '' }];
      this.evidenciasPorRecomendacion.set(recom, lista);
    }
    return lista;
  }

  protected agregarEvidencia(recom: Recomendacion): void {
    this.evidencias(recom).push({ texto: '' });
  }

  protected quitarEvidencia(recom: Recomendacion, index: number): void {
    const lista = this.evidencias(recom);
    if (lista.length > 1) lista.splice(index, 1);
    this.actualizarEvidencias(recom);
  }

  protected actualizarEvidencias(recom: Recomendacion): void {
    recom.arere_evidencia_requerida = this.evidencias(recom)
      .filter(item => item.texto.trim())
      .map((item, index) => `${index + 1}. ${item.texto.trim()}`)
      .join('\n');
  }

  protected evidenciasInvalidas(recom: Recomendacion): boolean {
    return this.evidencias(recom).some(item => !item.texto.trim() || item.texto.trim().length > 500) ||
      (recom.arere_evidencia_requerida?.length || 0) > 2000;
  }


  protected ordenTrabajo: string = '';
  protected informeTitle: string = '';
  protected informeFechaAprob!: Date;
  protected fechaInicioControlISOString: string = ''; // Almacenará la fecha en formato ISO string
  protected hallazgoTitle: string = '';

  protected indexRecRemove!: number;
  private confirmAction!: () => void;

  ngOnInit(): void {
    this.numHallazgo = this.auxiliarSrv.getUrlParameter('id_hal').toString();
    this.numInforme = this.auxiliarSrv.getUrlParameter('id_inf').toString();
    this.loadTitles();
    this.loadMaxNumRecomendacion();
  }

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadTitles(): void {
    const id_hall = this.numHallazgo;
    this.isLoadingTitles = true;
    this.conclusionSrv.getTitlesInformeHallazgo(id_hall).subscribe({
      next: (response) => {
        this.ordenTrabajo = response.datos.ainin_orden_trabajo;
        this.informeTitle = response.datos.ainin_titulo;

        // Convertir la fecha a objeto Date local sin desfase de zona horaria
        if (response.datos.areha_fecha_inicio_control) {
          const rawDate = response.datos.areha_fecha_inicio_control;
          if (typeof rawDate === 'string') {
            const cleanDateStr = rawDate.split(' ')[0].split('T')[0];
            const [anio, mes, dia] = cleanDateStr.split('-').map(Number);
            this.informeFechaAprob = new Date(anio, mes - 1, dia);
            this.fechaInicioControlISOString = cleanDateStr;
          } else {
            this.informeFechaAprob = new Date(rawDate);
            const anio = this.informeFechaAprob.getFullYear();
            const mes = String(this.informeFechaAprob.getMonth() + 1).padStart(2, '0');
            const dia = String(this.informeFechaAprob.getDate()).padStart(2, '0');
            this.fechaInicioControlISOString = `${anio}-${mes}-${dia}`;
          }
        }

        this.hallazgoTitle = response.datos.areha_descripcion;
        this.isLoadingTitles = false;
        this.setDefaultDate();
      },
      error: (error) => {
        console.error('Error al obtener títulos:', error);
        this.isLoadingTitles = false;
      },
    });
  }

  protected onResponsablesSelected(responsables: ResponsableInfo[]) {
    // Agregue nuevas responsables mientras mantiene las seleccionadas previamente
    const newResponsables = responsables.filter(
      (r) =>
        !this.selectedResponsables.some(
          (selected) => selected.CODIGO === r.CODIGO
        )
    );

    this.selectedResponsables = [
      ...this.selectedResponsables,
      ...newResponsables,
    ];
  }

  protected openModalAddResponsable() {
    this.responsablesFilter = this.selectedResponsables.map((responsable) => ({
      ...responsable,
      isAssigned: true, // marca ya asiganado
      selected: true, // Preselecciona responsable asigando
    }));

    this.isLoading = true;

    this.conclusionSrv.getPersonalInfo().subscribe({
      next: (response) => {
        this.responsablesInfo = response.DATA;

        this.responsablesFilter = this.responsablesInfo.map((responsable) => ({
          ...responsable,
          isAssigned: this.selectedResponsables.some(
            (selected) => selected.CODIGO === responsable.CODIGO
          ),
          selected: this.selectedResponsables.some(
            (selected) => selected.CODIGO === responsable.CODIGO
          ),
        }));

        if (this.responsablesFilter.length > 0) {
          this.modalAddResponsSrv.openModal(null, 'assing');
        } else {
          this.alertsService.showAlert(
            'No se encontraron responsables para mostrar',
            'warning'
          );
        }
      },
      error: (error) => {
        console.error('Error al obtener información del personal:', error);
        this.alertsService.showAlert(
          'Error al cargar datos para los responsables',
          'error'
        );
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  // Método para eliminar un responsable
  protected removeResponsable(responsable: ResponsableInfo) {
    this.selectedResponsables = this.selectedResponsables.filter(
      (r) => r.CODIGO !== responsable.CODIGO
    );
  }

  protected openModalForCreation() {
    // Verificar que exista fecha de aprobación
    if (!this.informeFechaAprob) {
      this.alertsService.showAlert(
        'Se requiere fecha de aprobación del informe para crear recomendaciones.',
        'error'
      );
      return;
    }

    this.confirmAction = this.createRecommendation.bind(this); // Asigna la acción
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: '¿Estás seguro de que desea crear la recomendación?',
      confirmText: 'CREAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'primary',
      cancelButtonType: 'error'
    });

    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      if (this.confirmAction) {
        this.confirmAction();
      }
    });

    this.subscriptions.push(subscription);
  }

  protected openModalForDeletion(index: number) {
    this.confirmAction = () => this.removeRecommendation(index); // Asigna la acción específica
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: '¿Estás seguro de que deseas eliminar la recomendación?',
      confirmText: 'ELIMINAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'secondary',
      cancelButtonType: 'error'
    });

    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      if (this.confirmAction) {
        this.confirmAction();
      }
    });

    this.subscriptions.push(subscription);
  }

  protected openModalForDeletionResp(responsable: ResponsableInfo) {
    this.confirmAction = () => this.removeResponsable(responsable); // Asigna la acción específica
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: '¿Estás seguro de que deseas eliminar el responsable?',
      confirmText: 'ELIMINAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'secondary',
      cancelButtonType: 'error'
    });

    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      if (this.confirmAction) {
        this.confirmAction();
      }
    });

    this.subscriptions.push(subscription);
  }

  private createRecommendation(): void {
    // Validar que haya responsables seleccionados
    if (this.selectedResponsables.length === 0) {
      this.alertsService.showAlert(
        'Debe seleccionar al menos un responsable.',
        'error'
      );
      return;
    }

    this.showRecommendationError = !this.recommendationText.trim();
    this.showNumRecError =
      this.numRecomendacion <= 0 ||
      this.numRecomendacion.toString().trim() === '';

    if (this.showRecommendationError || this.showNumRecError) {
      this.alertsService.showAlert('Campo recomendación requerido.', 'error');
      return;
    }

    // Crear la recomendación en el formato del modelo Recomendacion
    const nuevaRecomendacion: Recomendacion = {
      arere_num_rec: this.numRecomendacion,
      arere_descripcion: this.recommendationText,
      arere_fecha_maxima: this.recommendationDate,
      arere_fecha_inicio_control: this.fechaInicioControlISOString,
      responsables: this.selectedResponsables.map((responsable) => ({
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
      })),
    };

    // Agregar la recomendación a la lista de recomendaciones
    this.recomendaciones.push(nuevaRecomendacion);

    // Reinicia los campos después de crear la recomendación
    this.recommendationText = '';
    this.recommendationDate = this.defaultDate; // Vuelve a la fecha predeterminada
    this.selectedResponsables = []; // Limpiar responsables seleccionados
    this.numRecomendacion += 1;
    this.alertsService.showAlert('Recomendación creada con éxito', 'success');
    this.scrollToElement();
  }

  protected removeRecommendation(index: number): void {
    // Eliminar la recomendación del arreglo por su índice
    this.evidenciasPorRecomendacion.delete(this.recomendaciones[index]);
    this.recomendaciones.splice(index, 1);
    this.alertsService.showAlert(
      'Recomendación eliminada con éxito',
      'success'
    );
  }

  private scrollToElement(): void {
    this.targetElement.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  private setDefaultDate(): void {
    if (!this.informeFechaAprob) {
      console.warn('La fecha de aprobación del informe no está disponible.');
      this.recommendationDate = '';
      this.defaultDate = '';
      return;
    }

    try {
      const fechaAprob = new Date(this.informeFechaAprob); // Convierte el string en Date
      if (isNaN(fechaAprob.getTime())) {
        console.error('Error: La fecha de aprobación no es válida.');
        return;
      }

      // Suma 1 mes (30 días)
      fechaAprob.setDate(fechaAprob.getDate() + 30);

      const anio = fechaAprob.getFullYear();
      const mes = String(fechaAprob.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaAprob.getDate()).padStart(2, '0');
      const formattedDate = `${anio}-${mes}-${dia}`;

      this.recommendationDate = formattedDate; // Guarda la fecha calculada
      this.defaultDate = formattedDate;
    } catch (error) {
      console.error('Error al procesar la fecha de aprobación:', error);
      this.recommendationDate = '';
      this.defaultDate = '';
    }
  }

  private loadMaxNumRecomendacion(): void {
    const id = this.numInforme;
    this.conclusionSrv.getMaxNumRecomendacion(id).subscribe({
      next: (response) => {
        this.numRecomendacion = Number(response.datos) + 1;
      },
      error: (error) => {
        console.error('Error al obtener el número máximo:', error);
      },
    });
  }

  protected onDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.recommendationDate = target.value;
  }

  // Evetos Input para la escucha del tipado en el taxtarea
  protected onConclusionInput(): void {
    if (this.conclusionText.trim()) {
      this.showError = false; // Oculta el mensaje de error cuando hay texto
    }
  }

  protected onRecomendacionInput(): void {
    if (this.recommendationText.trim()) {
      this.showRecommendationError = false;
    }
  }

  protected onNumRecomendacionInput(): void {
    if (this.numRecomendacion.toString().trim()) {
      this.showNumRecError = false;
    }
  }

  protected nextStep(): void {
    if (this.currentStep === 1) {
      if (!this.conclusionText.trim()) {
        this.showError = true;
        this.alertsService.showAlert('Campo conclusión requerido.', 'error');
        return;
      } else {
        this.showError = false;
      }
      this.currentStep++;
    } else if (this.currentStep === 2) {
      // Validar que la lista de recomendaciones no esté vacía
      if (this.recomendaciones.length === 0) {
        this.alertsService.showAlert(
          'Debe crear al menos una recomendación.',
          'error'
        );
        return;
      }
      this.currentStep++;
    } else if (this.currentStep === 3) {
      this.recomendaciones.forEach(recom => this.actualizarEvidencias(recom));
      this.showRiskError = this.recomendaciones.some((recom) =>
        !recom.arere_riesgo_verificado || this.evidenciasInvalidas(recom)
      );
      if (this.showRiskError) {
        this.alertsService.showAlert('Seleccione el riesgo e ingrese la evidencia requerida de cada recomendación.', 'error');
        return;
      }
      this.currentStep++;
    } else if (this.currentStep === 4) {
      if (this.isSubmitting) {
        return;
      }
      this.confirmConclusion();
    }
  }

  private confirmConclusion(): void {
    if (this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;

    // Asegurarse de que tenemos una versión string de la fecha
    if (!this.fechaInicioControlISOString && this.informeFechaAprob) {
      try {
        const anio = this.informeFechaAprob.getFullYear();
        const mes = String(this.informeFechaAprob.getMonth() + 1).padStart(2, '0');
        const dia = String(this.informeFechaAprob.getDate()).padStart(2, '0');
        this.fechaInicioControlISOString = `${anio}-${mes}-${dia}`;
      } catch (error) {
        console.error('Error al convertir fecha en confirmConclusion:', error);
        this.fechaInicioControlISOString = '';
      }
    }

    // Verificar y asignar roles antes de enviar la conclusión
    this.verifyAndAssignRolesBeforeSending();
  }

  private verifyAndAssignRolesBeforeSending(): void {
    // Recopilar todos los responsables de todas las recomendaciones
    const allResponsables: Responsable[] = [];
    this.recomendaciones.forEach(recom => {
      recom.responsables.forEach(resp => {
        // Inicializar hasRol como false si no existe
        if (resp.hasRol === undefined) {
          resp.hasRol = false;
        }
        allResponsables.push(resp);
      });
    });

    if (allResponsables.length === 0) {
      this.proceedWithConclusion();
      return;
    }

    // Crear observables para verificar roles
    const roleVerifications = allResponsables.map(responsable =>
      this.roleUserSrv.verifyRoleUser(responsable.arers_usuario_per, responsable.arers_num_rol).pipe(
        map((response) => ({
          responsable: responsable,
          hasRol: !!response.datos
        }))
      )
    );

    forkJoin(roleVerifications).subscribe({
      next: (verificationResults) => {
        // Actualizar el estado hasRol para cada responsable
        verificationResults.forEach(result => {
          result.responsable.hasRol = result.hasRol;
        });

        // Filtrar solo los que NO tienen rol
        const responsablesWithoutRole = allResponsables.filter(r => !r.hasRol);

        if (responsablesWithoutRole.length === 0) {
          // Si todos tienen rol, proceder con el envío
          this.proceedWithConclusion();
          return;
        }

        // Asignar roles a los que no tienen
        this.assignRolesToResponsables(responsablesWithoutRole);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.alertsService.showAlert('Error al verificar roles de usuarios', 'error');
      }
    });
  }

  private assignRolesToResponsables(responsablesWithoutRole: Responsable[]): void {
    let completedRequests = 0;
    let hasErrors = false;

    responsablesWithoutRole.forEach(responsable => {
      this.roleUserSrv.assignRoleUser(4, responsable.arers_codigo_per, responsable.arers_usuario_per, responsable.arers_correo).subscribe({
        next: (response) => {
          completedRequests++;
          responsable.hasRol = true; // Marcar como que ya tiene rol

          if (completedRequests === responsablesWithoutRole.length) {
            if (!hasErrors) {
              // Proceder con el envío de la conclusión
              this.proceedWithConclusion();
            }
          }
        },
        error: (error) => {
          completedRequests++;
          hasErrors = true;

          if (completedRequests === responsablesWithoutRole.length) {
            this.alertsService.showAlert('Error al asignar algunos roles. Se procederá con el registro.', 'warning');
            // Proceder con el envío aunque haya errores en asignación de roles
            this.proceedWithConclusion();
          }
        }
      });
    });
  }

  private proceedWithConclusion(): void {
    // Prepare the conclusion object according to the interface
    const conclusionEscritura: ConclusionEscritura = {
      areco_conclusion: this.conclusionText,
      areha_codigo: parseInt(this.numHallazgo),
      recomendaciones: this.recomendaciones.map((recom) => ({
        arere_descripcion: recom.arere_descripcion,
        arere_num_rec: recom.arere_num_rec,
        arere_fecha_maxima: recom.arere_fecha_maxima,
        arere_fecha_inicio_control: this.fechaInicioControlISOString,
        arere_riesgo_verificado: recom.arere_riesgo_verificado,
        arere_evidencia_requerida: recom.arere_evidencia_requerida?.trim(),
        responsables: recom.responsables.map((resp) => ({
          arers_codigo_per: resp.arers_codigo_per,
          arers_nombre: resp.arers_nombre,
          arers_apellido: resp.arers_apellido,
          arers_correo: resp.arers_correo,
          arers_seccion: resp.arers_seccion,
          arers_cargo: resp.arers_cargo,
          arers_departamento: resp.arers_departamento,
          arers_departamento_abrev: resp.arers_departamento_abrev,
          arers_num_rol: resp.arers_num_rol,
          arers_usuario_per: resp.arers_usuario_per,
        })),
      })),
    };

    this.sendConclusion(conclusionEscritura);
  }

  // Método para consumir el servicio y enviar el JSON a la API
  private sendConclusion(conclusionEscritura: ConclusionEscritura): void {
    this.conclusionSrv.createConclusión(conclusionEscritura).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.alertsService.showAlert(
          'Recomendaciones registradas exitosamente',
          'success'
        );
        this.resetFormSteps();
        this.exit();
      },
      error: (error) => {
        this.isSubmitting = false;
        const errorMsg = error?.message || 'Error al registrar las recomendaciones';
        this.alertsService.showAlert(
          errorMsg,
          'error'
        );
      },
    });
  }

  private resetFormSteps(): void {
    this.isSubmitting = false;
    this.currentStep = 1;
    this.conclusionText = '';
    this.showRiskError = false;
    this.recomendaciones = [];
    this.selectedResponsables = [];
    this.recommendationText = '';
    this.recommendationDate = this.defaultDate;
  }

  // Retrocede al paso anterior
  protected previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // Cancela el proceso y cierra el modal
  protected exit(): void {
    this.currentStep = 1; // Reinicia al primer paso
    this.redireccionPagina();
  }

  protected closeModalAddResponsable() {
    this.modalAddResponsSrv.closeModal();
  }

  protected redireccionPagina(): void {
    const idHall: number = this.auxiliarSrv.getUrlParameter('id_inf');
    const idCon: number = this.auxiliarSrv.getUrlParameter('id_hal');

    // Navega primero a una ruta vacía antes de regresar
    this.router.navigateByUrl('/').then(() => {
      this.router
        .navigate([
          'inicio/auditor-operativo/hallazgos',
          btoa(idHall.toString()),
          'conclusiones',
          btoa(idCon.toString()),
        ])
        .catch((error) => {
          console.error('Error en navegación', error);
        });
    });
  }
}
