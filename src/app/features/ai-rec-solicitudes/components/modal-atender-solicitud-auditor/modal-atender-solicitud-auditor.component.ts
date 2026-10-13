import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { User } from '@core/auth/models/authentication';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import {
  AprobarSolicitudWrite,
  EstadoAprobacionAuditor,
  OpcionEstadoAuditor,
} from '@features/ai-rec-solicitudes/models/solicitud';
import { ModalAtenderAuditorService } from '@features/ai-rec-solicitudes/services/modal-atender.service';
import { SolicitudesAuditorService } from '@features/ai-rec-solicitudes/services/solicitudes.service';
import { DetalleRecomendacion } from '@features/ai-rec-verificables/models/Recomendacion';
import { RecomendacionesVerificablesService } from '@features/ai-rec-verificables/services/recomendaciones/recomendaciones-verificables.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-modal-atender-solicitud-auditor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AbsPipe],
  templateUrl: './modal-atender-solicitud-auditor.component.html',
  styleUrl: './modal-atender-solicitud-auditor.component.css',
})
export class ModalAtenderSolicitudAuditorComponent implements OnDestroy {
  @Input() reloadTable!: () => void;
  protected readonly auxiliarSrv = inject(AuxiliaryService);

  protected readonly recomendacionVerSrv: RecomendacionesVerificablesService =
    inject(RecomendacionesVerificablesService);
  protected readonly modalFormSrv: ModalAtenderAuditorService =
    inject(ModalAtenderAuditorService);
  protected readonly solicitudSrv: SolicitudesAuditorService =
    inject(SolicitudesAuditorService);
  private readonly alertStateService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];
  protected formSolicitud!: FormGroup;
  protected isEditMode = false;
  protected formSubmitted = false;
  protected fileName!: String;
  protected archivoAdjunto: any = [];
  protected user: User | null = null;
  protected detalleRecomendacion: DetalleRecomendacion | null = null;
  protected activeSection: string = 'solicitud'; // Por defecto, el informe está abierto
  protected modalData: any = null;
  protected isLoading = false;
  protected isLoadingSubmint = false;
  protected data!: any;

  protected estados_aprobacion: OpcionEstadoAuditor[] = [
    { codigo: EstadoAprobacionAuditor.APROBADO, nombre: 'Aprobado' },
    
    { codigo: EstadoAprobacionAuditor.NO_APROBADO, nombre: 'No Aprobado' },
  ];

  ngOnInit(): void {
    this.user = this.auxiliarSrv.getUserInfo();
    this.initForm();
  }

  constructor() {
    effect(() => {
      this.modalData = this.modalFormSrv.modalData();
      this.initForm();
      if (this.modalData && this.modalData.recomendacion) {
        this.getDetalleRecomendacion(this.modalData.recomendacion.arere_codigo);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  protected toSend() {
    this.formSubmitted = true;

    if (this.formSolicitud.invalid) {
      this.markFormGroupTouched(this.formSolicitud);
      this.alertStateService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }
    const codigo = this.formSolicitud.get('areso_codigo')?.value;
    if (!codigo) return;

    const estadoAprob = String(this.formSolicitud.get('areso_estado_aprob')?.value);
    const esAprobado = estadoAprob === String(EstadoAprobacionAuditor.APROBADO) || estadoAprob === '3';

    const titulo = esAprobado ? 'Confirmar Aprobación' : 'Confirmar Rechazo';
    const mensaje = esAprobado
      ? '¿Está seguro de que desea aprobar esta solicitud?'
      : '¿Está seguro de que desea no aprobar esta solicitud?';

    const actionId = this.modalConfirmationService.show({
      title: titulo,
      message: mensaje,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'primary',
      cancelButtonType: 'error'
    });

    const sub = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.aprobarSolicitud();
    });
    this.subscriptions.push(sub);
  }

  protected getEstadoPlazo(): string {
    const plazo = this.detalleRecomendacion?.recomendaciones?.plazo ?? 0;
    return plazo < 0 ? 'días vencidos' : 'días vigentes';
  }

  protected loadFile() {
    if (this.formSolicitud.get('areso_adjunto')?.value) {
      const urlFile = this.formSolicitud.get('urlArchivo')?.value;
      this.fileName = urlFile.split('/').pop();
    }
  }


  private aprobarSolicitud() {
    this.isLoadingSubmint = true;
    this.formSubmitted = true;
    const solicitudWrite: AprobarSolicitudWrite = {
      aseru_codigo_per: this.user?.codigo_per || '',
      areso_estado_aprob: this.formSolicitud.get('areso_estado_aprob')?.value,
    };
    // Si buildFormData devuelve null, significa que hubo un error de validación
    this.solicitudSrv
      .aprobarSolicitud(
        solicitudWrite,
        this.formSolicitud.get('areso_codigo')?.value
      )
      .subscribe({
        next: () => {
          this.notificarCambioFecha(this.modalData.recomendacion.arere_codigo);
          this.isLoadingSubmint = false;
          this.formSubmitted = false;
          this.modalFormSrv.closeModal();
          this.resetForm();
          this.reloadTable();
        },
        error: (error) => {
          this.alertStateService.showAlert(error, 'error');
          this.formSubmitted = false;
          this.isLoadingSubmint = false;
        },
      });
  }
  
  private notificarCambioFecha(codRec: number): void {
    this.solicitudSrv.notificarCambioFecha(codRec).subscribe({
      next: () => {
        this.handleSuccess();
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  private handleSuccess(): void {
    const mensaje = 'Solicitud aprobada y notificación de cambio de fecha enviada correctamente';
    this.alertStateService.showAlert(mensaje, 'success');
  }

  private handleError(err: any): void {
    const mensajeError = err.message || 'Error al procesar la operación';
    this.alertStateService.showAlert(mensajeError, 'error');
  }

  protected closeModal(event: MouseEvent): void {
    event.preventDefault();
    this.resetForm();
    this.modalFormSrv.closeModal();
    this.isEditMode = false;
    this.formSubmitted = false;
    this.isLoading = false;
  }

  public resetForm(): void {
    // Reset del formulario con valores iniciales
    this.formSolicitud.reset({
      areso_codigo: null,
      areso_descripcion: '',
      areso_adjunto: '',
      areso_archivo: '',
      urlArchivo: '',
      nombreArchivo: '',
    });

    // Reset del estado de validación
    this.formSubmitted = false;
  }

  protected captureFile(event: Event): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    if (file) {
      this.archivoAdjunto = file;
      this.formSolicitud.patchValue({
        areso_adjunto: file.name,
        nombreArchivo: file.name,
      });
      this.fileName = file.name;
    }
  }

  protected cleanInputFile(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    this.formSolicitud.patchValue({ areso_adjunto: null }); // Limpia el archivo en el formulario
    this.archivoAdjunto = null; // Limpia el archivo adjunto
    input.value = ''; // Limpia el input file
    this.fileName = ''; // Limpia el nombre del archivo
  }

  protected openFile(event: MouseEvent): void {
    event.preventDefault();
    if (this.archivoAdjunto.name != null) {
      window.open(URL.createObjectURL(this.archivoAdjunto), '_blank');
    } else if (this.formSolicitud.get('areve_archivo')?.value != null) {
      const blob = new Uint8Array(
        atob(this.formSolicitud.get('areve_archivo')?.value)
          .split('')
          .map((char) => char.charCodeAt(0))
      );
      const file = new Blob([blob], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      // Abre el PDF en una nueva pestaña
      window.open(fileURL, '_blank');
      // Libera el objeto URL después de abrirlo
      URL.revokeObjectURL(fileURL);
    }
  }

  protected formatFileName(nombre: String): String {
    const longitudMaxima = 20;

    if (nombre.length > longitudMaxima) {
      const inicio = nombre.slice(0, 11); // Primeros 5 caracteres
      const fin = nombre.slice(-14); // Últimos 5 caracteres
      return `${inicio}...${fin}`;
    }

    return nombre; // Si es más corto, devuelve el nombre completo
  }

  protected getCurrentDate(): void {
    const today = new Date().toISOString().split('T')[0];
    this.formSolicitud.get('ainin_fechaEmision')?.setValue(today);
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formSolicitud.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  private initForm() {
    this.formSolicitud = new FormGroup({
      areso_codigo: new FormControl(this.modalData?.areso_codigo || null),
      areso_estado_aprob: new FormControl(
        this.modalData?.asero_estado_aprob || null
      ),
      // areso_adjunto: '',
    });
  }

  private getDetalleRecomendacion(arere_codigo: any) {
    this.recomendacionVerSrv.getDetalleRecomendacion(arere_codigo).subscribe({
      next: (response) => {
        this.detalleRecomendacion = response.datos;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarSrv.hasRole(roleIds);
  }

  protected toggleSection(section: string) {
    this.activeSection = this.activeSection === section ? '' : section;
  }
}
