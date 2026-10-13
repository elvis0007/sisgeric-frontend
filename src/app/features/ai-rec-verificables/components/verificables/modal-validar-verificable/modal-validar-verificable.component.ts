import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { DetalleRecomendacion } from '@features/ai-rec-verificables/models/Recomendacion';
import {
  Verificable,
  VerificableEscritura,
} from '@features/ai-rec-verificables/models/Verificable';
import { RecomendacionesVerificablesService } from '@features/ai-rec-verificables/services/recomendaciones/recomendaciones-verificables.service';
import { ModalValidarVerificableService } from '@features/ai-rec-verificables/services/verificables/modal-validar-verificable.service';
import { VerificablesService } from '@features/ai-rec-verificables/services/verificables/verificables.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { EstadoVerService } from '@features/ai-seg-configuracion/services/estado_ver/estado-ver.service';

@Component({
  selector: 'app-modal-validar-verificable',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AbsPipe],
  templateUrl: './modal-validar-verificable.component.html',
  styleUrl: './modal-validar-verificable.component.css',
})
export class ModalValidarVerificableComponent implements OnDestroy {
  @Input() reloadTable!: () => void;
  private readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];

  protected modalFormSrv: ModalValidarVerificableService = inject(
    ModalValidarVerificableService
  );
  private readonly verificableSrv: VerificablesService =
    inject(VerificablesService);
  private readonly auxiliarSrv = inject(AuxiliaryService);
  protected readonly estadoSegSrv: EstadoVerService = inject(EstadoVerService);
  protected readonly recomendacionVerSrv: RecomendacionesVerificablesService =
    inject(RecomendacionesVerificablesService);

  protected isLoadingSubmint = false;
  protected formVerificable!: FormGroup;
  protected data!: Verificable;
  protected isEditMode = false;
  protected formSubmitted = false;
  protected estadoSeguimientos: any = [];
  protected detalleRecomendacion: DetalleRecomendacion | null = null;

  ngOnInit(): void {
    this.loadEstadoSegumientos();
    const codRecom = this.auxiliarSrv.getUrlParameter('id_det_rec').toString();
    this.getDetalleRecomendacion(codRecom);
    this.initForm();
  }

  constructor() {
    effect(() => {
      const modalData = this.modalFormSrv.modalData();
      const operationType = this.modalFormSrv.getOperationType();

      if (modalData) {
        this.isEditMode = operationType === 'edit';
        this.data = modalData;
        const codRec = (modalData as any).arere_codigo 
          || this.auxiliarSrv.getUrlParameter('id_det_rec');
        if (codRec) {
          this.getDetalleRecomendacion(codRec);
        }
        if ((modalData as any).ainin_memorando && (!this.detalleRecomendacion || !this.detalleRecomendacion.ainin_memorando)) {
          this.detalleRecomendacion = {
            ainin_memorando: (modalData as any).ainin_memorando,
            ainin_titulo: (modalData as any).ainin_titulo,
            ainin_memo_aprobacion: '',
            ainoc_descripcion: '',
            ainin_codigo: 0,
            ainin_orden_trabajo: '',
            recomendaciones: {
              aredr_codigo: (modalData as any).aredr_codigo || 0,
              arere_codigo: Number(codRec) || 0,
              arere_descripcion: (modalData as any).arere_descripcion || '',
              arere_num_rec: 0,
              arere_progreso: 0,
              arere_fecha_inicio_control: '',
              arere_fecha_maxima: '',
              arere_num_prorroga: 0,
              plazo: 0,
              estado_seguimiento: null as any,
              motivo_estado: '',
              responsables: 0
            }
          };
        }
        this.initForm(); // Reinitialize the form with the new data
      }
    });
  }

  getEstadoPlazo(): string {
    const plazo = this.detalleRecomendacion?.recomendaciones?.plazo ?? 0;
    return plazo < 0 ? 'días vencidos' : 'días vigentes';
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  protected toSend() {
    this.formSubmitted = true;

    if (this.formVerificable.invalid) {
      this.markFormGroupTouched(this.formVerificable);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }

    const codigo = this.formVerificable.get('areve_codigo')?.value;
    if (!codigo) return;

    const areevCodigo = this.formVerificable.get('areev_codigo')?.value;
    const estadoObj = this.estadoSeguimientos?.find(
      (e: any) => String(e.areev_codigo) === String(areevCodigo)
    );
    const nombreEstado = estadoObj ? estadoObj.areev_descripcion?.trim().toUpperCase() : '';

    let mensaje = '¿Está seguro de que desea cambiar el estado de este verificable?';

    if (nombreEstado === 'NO JUSTIFICA' || String(areevCodigo) === '3') {
      mensaje = '¿Está seguro de que desea cambiar el estado de este verificable a "NO JUSTIFICA"?';
    } else if (nombreEstado === 'JUSTIFICA' || String(areevCodigo) === '2') {
      mensaje = '¿Está seguro de que desea cambiar el estado de este verificable a "JUSTIFICA"?';
    } else if (nombreEstado === 'PENDIENTE' || String(areevCodigo) === '1') {
      mensaje = '¿Está seguro de que desea cambiar el estado de este verificable a "PENDIENTE"?';
    } else if (nombreEstado) {
      mensaje = `¿Está seguro de que desea cambiar el estado de este verificable a "${nombreEstado}"?`;
    }

    const estadoActual = this.data?.estado_seguimiento?.areev_descripcion?.toUpperCase()?.trim();
    if (estadoActual === 'JUSTIFICA') {
      mensaje += ' Atención: Este verificable actualmente figura como JUSTIFICA; al rectificar su estado se recalculará automáticamente el avance de la recomendación.';
    }

    const actionId = this.modalConfirmationService.show({
      title: 'Confirmar cambio de estado',
      message: mensaje,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'primary',
      cancelButtonType: 'error',
    });

    const sub = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.editVerificable();
    });
    this.subscriptions.push(sub);
  }

  private loadEstadoSegumientos() {
    this.estadoSegSrv.getEstadoSeguimiento().subscribe({
      next: (response) => {
        const allowedOrder = ['PENDIENTE', 'JUSTIFICA', 'NO JUSTIFICA'];
        this.estadoSeguimientos = (response.datos || [])
          .filter((item: any) => {
            const desc = item.areev_descripcion ? item.areev_descripcion.trim().toUpperCase() : '';
            return allowedOrder.includes(desc);
          })
          .sort((a: any, b: any) => {
            const descA = a.areev_descripcion ? a.areev_descripcion.trim().toUpperCase() : '';
            const descB = b.areev_descripcion ? b.areev_descripcion.trim().toUpperCase() : '';
            return allowedOrder.indexOf(descA) - allowedOrder.indexOf(descB);
          });

        if (this.formVerificable) {
          const currentVal = this.formVerificable.get('areev_codigo')?.value;
          if (currentVal) {
            const match = this.estadoSeguimientos.some(
              (e: any) => String(e.areev_codigo) === String(currentVal)
            );
            if (!match) {
              this.formVerificable.get('areev_codigo')?.setValue('');
            }
          }
        }
      },
      error: (err) => console.error('Error loading estado segumientos:', err),
    });
  }

  private editVerificable(): void {
    this.isLoadingSubmint = true;
    const verificableData: VerificableEscritura = {
      areve_codigo: this.formVerificable.get('areve_codigo')?.value,
      areve_motivo_estado: this.formVerificable.get('areve_motivo_estado')
        ?.value,
      areev_codigo: this.formVerificable.get('areev_codigo')?.value,
    };

    this.verificableSrv
      .validarVerificable(verificableData, verificableData.areve_codigo)
      .subscribe({
        next: (response) => {
          this.alertsService.showAlert(response.mensaje, 'success');
          this.isLoadingSubmint = false;
          this.modalFormSrv.closeModal();
          this.resetForm();
          this.reloadTable();
        },
        error: (response: any) => {
          this.alertsService.showAlert(`${response}`, 'error');
          this.isLoadingSubmint = false;
        },
      });
  }

  private initForm() {
    const idRec = this.auxiliarSrv.getUrlParameter('id_det_rec');

    let areevCodigoInicial: any = this.data?.estado_seguimiento?.areev_codigo || '';
    const descActual = this.data?.estado_seguimiento?.areev_descripcion
      ? this.data.estado_seguimiento.areev_descripcion.trim().toUpperCase()
      : '';
    const allowed = ['PENDIENTE', 'JUSTIFICA', 'NO JUSTIFICA'];

    // Si el estado actual es PENDIENTE REVISIÓN, ADICIONAL u otro fuera de los permitidos para validación,
    // se deja en blanco para obligar al auditor a seleccionar uno de los estados permitidos.
    if (descActual && !allowed.includes(descActual)) {
      areevCodigoInicial = '';
    } else if (this.estadoSeguimientos && this.estadoSeguimientos.length > 0 && areevCodigoInicial) {
      const match = this.estadoSeguimientos.some(
        (e: any) => String(e.areev_codigo) === String(areevCodigoInicial)
      );
      if (!match) {
        areevCodigoInicial = '';
      }
    }

    this.formVerificable = new FormGroup({
      areve_codigo: new FormControl(this.data?.areve_codigo || null),
      areve_motivo_estado: new FormControl(
        this.data?.areve_motivo_estado || '',
        [Validators.required]
      ),
      areev_codigo: new FormControl(
        areevCodigoInicial,
        [Validators.required]
      ),
    });
  }

  // Método para marcar todos los controles como tocados
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formVerificable.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  public resetForm(): void {
    this.formVerificable.reset({
      areve_codigo: null,
      areve_motivo_estado: '',
    });

    this.formSubmitted = false;
  }

  protected closeModal(event: MouseEvent): void {
    event.preventDefault();
    this.modalFormSrv.closeModal();
    this.resetForm();
    this.isEditMode = false;
    this.formSubmitted = false;
  }

  private getDetalleRecomendacion(arere_codigo: any) {
    if (!arere_codigo) return;
    this.recomendacionVerSrv.getDetalleRecomendacion(arere_codigo).subscribe({
      next: (response) => {
        if (response?.datos) {
          this.detalleRecomendacion = response.datos;
        }
      },
      error: (err) => {
        console.error(err);
      },
    });
  }
}
