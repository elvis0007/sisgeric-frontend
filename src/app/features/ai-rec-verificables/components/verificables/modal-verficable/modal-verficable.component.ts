import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { DetalleRecomendacion } from '@features/ai-rec-verificables/models/Recomendacion';
import { Responsable } from '@features/ai-rec-verificables/models/Responsable';
import { Verificable } from '@features/ai-rec-verificables/models/Verificable';
import { RecomendacionesVerificablesService } from '@features/ai-rec-verificables/services/recomendaciones/recomendaciones-verificables.service';
import { ModalFormVerificableService } from '@features/ai-rec-verificables/services/verificables/modal-form-verificable.service';
import { VerificablesService } from '@features/ai-rec-verificables/services/verificables/verificables.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { FileUtils } from '@shared/utils/file-utils';
import { EstadoVerService } from '@features/ai-seg-configuracion/services/estado_ver/estado-ver.service';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-modal-verficable',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AbsPipe],
  templateUrl: './modal-verficable.component.html',
  styleUrl: './modal-verficable.component.css',
})
export class ModalVerficableComponent implements OnDestroy {
  @Input() reloadTable!: () => void;
  protected readonly auxiliarSrv = inject(AuxiliaryService);
  protected readonly verificableSrv: VerificablesService =
    inject(VerificablesService);
  protected readonly recomendacionVerSrv: RecomendacionesVerificablesService =
    inject(RecomendacionesVerificablesService);
  protected readonly modalFormSrv: ModalFormVerificableService = inject(
    ModalFormVerificableService
  );
  protected readonly estadoSegSrv: EstadoVerService = inject(EstadoVerService);
  private readonly fileUtils: FileUtils = inject(FileUtils);
  private readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];

  protected formVerificable!: FormGroup;
  protected isEditMode = false;
  protected isAdicionalMode = false;
  protected isLoadingTitle = true;
  protected data!: Verificable;
  protected fileName!: String;
  protected archivoAdjunto: any = null;
  protected estadoSeguimientos: any = [];
  protected detalleRecomendacion: DetalleRecomendacion | null = null;
  protected isLoading = false;
  protected isLoadingSubmint = false;
  protected responsables: Responsable[] = [];
  private estadoOriginal: any = null;

  ngOnInit(): void {
    const codRecom = this.auxiliarSrv.getUrlParameter('id_det_rec').toString();
    this.loadResponsables(codRecom);
    this.getDetalleRecomendacion(codRecom);
    this.loadEstadoSegumientos();
    this.initForm();
  }

  constructor() {
    effect(() => {
      const modalData = this.modalFormSrv.modalData();
      const operationType = this.modalFormSrv.getOperationType();
      this.isAdicionalMode = operationType === 'adicional';
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
        if (this.isEditMode) {
          this.isLoading = true; // Activamos loading antes de cargar datos
          this.getVerificable(modalData.areve_codigo);
          this.estadoOriginal = modalData?.estado_seguimiento?.areev_codigo ?? null;
        } else {
          this.initForm();
        }
      } else {
        this.isEditMode = false;
        this.data = null as any;
        this.initForm();
      }
    });
  }

  private loadResponsables(arere_codigo: string) {
    this.verificableSrv.getResposablesForFilter(arere_codigo).subscribe({
      next: (response) => {
        this.responsables = response.datos.filter(
          (responsable: Responsable) => responsable.arers_estado === '1'
        ); 
      },
    });
  }

  private loadEstadoSegumientos() {
    this.estadoSegSrv.getEstadoSeguimiento().subscribe({
      next: (response) => (this.estadoSeguimientos = response.datos),
      error: (err) => console.error('Error loading estado segumientos:', err),
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  protected toSend() {
    // En modo edición, si no hay nuevo archivo seleccionado pero hay archivo existente,
    // no validar el campo areve_adjunto como requerido
    if (this.isEditMode && (!this.archivoAdjunto || (Array.isArray(this.archivoAdjunto) && this.archivoAdjunto.length === 0)) && this.formVerificable.get('nombreArchivo')?.value) {
      // Temporalmente remover la validación required del campo areve_adjunto
      this.formVerificable.get('areve_adjunto')?.clearValidators();
      this.formVerificable.get('areve_adjunto')?.updateValueAndValidity();
    }

    if (this.formVerificable.invalid) {
      this.markFormGroupTouched(this.formVerificable);
      this.alertsService.showAlert(
        'Por favor complete todos los campos requeridos',
        'error'
      );
      return;
    }

    const codigo = this.formVerificable.get('areve_codigo')?.value;
    if (codigo) {
      const actionId = this.modalConfirmationService.show({
        title: 'Advertencia',
        message: '¿Está seguro de que desea cambiar esta información?',
        confirmText: 'CONFIRMAR',
        cancelText: 'CANCELAR',
        confirmButtonType: 'primary',
        cancelButtonType: 'error',
      });

      const sub = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
        this.editVerificable();
      });
      this.subscriptions.push(sub);
      return;
    } else {
      this.createVerificable();
    }
  }

  protected get selectedResponsable(): Responsable | undefined {
    const codPer = this.formVerificable?.get('arers_codigo_per')?.value;
    if (!codPer || codPer === '' || codPer === '0') return undefined;
    return this.responsables.find((r) => r.arers_codigo_per === codPer);
  }

  protected get currentPlazo(): number {
    if (this.selectedResponsable && this.selectedResponsable.plazo !== undefined && this.selectedResponsable.plazo !== null) {
      return this.selectedResponsable.plazo;
    }
    return this.detalleRecomendacion?.recomendaciones?.plazo ?? 0;
  }

  protected get currentFechaMaxima(): string {
    if (this.selectedResponsable && this.selectedResponsable.aredr_fecha_maxima) {
      return this.selectedResponsable.aredr_fecha_maxima;
    }
    return this.detalleRecomendacion?.recomendaciones?.arere_fecha_maxima ?? '';
  }

  protected get isResponsableCumplido(): boolean {
    if (!this.selectedResponsable) return false;
    return this.selectedResponsable.estado_plazo === 'CUMPLIDO' ||
      (this.selectedResponsable.areev_descripcion != null &&
        (this.selectedResponsable.areev_descripcion.toUpperCase().includes('JUSTIFICA')));
  }

  protected get badgeClass(): string {
    if (this.isResponsableCumplido) {
      return 'badge-info text-white';
    }
    return this.currentPlazo < 0 ? 'badge-error text-white' : 'badge-success text-white';
  }

  protected getEstadoPlazo(): string {
    if (this.isResponsableCumplido) {
      return 'Cumplido';
    }
    const plazo = this.currentPlazo;
    return plazo < 0 ? 'días vencidos' : 'días vigentes';
  }

  protected loadFile() {
    if (this.formVerificable.get('areve_adjunto')?.value) {
      const urlFile = this.formVerificable.get('urlArchivo')?.value;
      this.fileName = urlFile.split('/').pop();
    }
  }

  private createVerificable(): void {
    this.isLoadingSubmint = true;
    const formDataInforme = this.buildFormData();

    // Si buildFormData devuelve null, significa que hubo un error de validación
    if (!formDataInforme) return;

    this.verificableSrv.saveVerificable(formDataInforme).subscribe({
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

  private editVerificable(): void {
    this.isLoadingSubmint = true;
    const formDataInforme = this.buildFormData();

    // Si buildFormData devuelve null, significa que hubo un error de validación
    if (!formDataInforme) return;
    this.verificableSrv
      .editVerificable(
        this.formVerificable.get('areve_codigo')?.value,
        formDataInforme
      )
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

  // Función para validar archivo
  private validateFile(file: File): boolean {
    // Validar tipo de archivo
    // Tipos MIME permitidos para Word, Excel y PDF
    const allowedTypes = [
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/pdf', // .pdf
    ];

    // Validar tipo de archivo
    if (!allowedTypes.includes(file.type)) {
      this.alertsService.showAlert(
        'Solo se permiten archivos de tipo Word, Excel o PDF.',
        'error'
      );
      return false;
    }

    return true;
  }

  private buildFormData(): FormData | null {
    const formData = new FormData();
    const idDetRec: number = this.auxiliarSrv.getUrlParameter('id_det_rec');

    // Validar si hay archivo adjunto en modo creación
    if (!this.isEditMode && (!this.archivoAdjunto || !(this.archivoAdjunto instanceof File))) {
      this.alertsService.showAlert(
        'Debe adjuntar un archivo verificable',
        'error'
      );
      return null;
    }

    formData.append('arere_codigo', idDetRec.toString());

    // Agregar todos los campos del formulario excepto los relacionados con archivos
    Object.keys(this.formVerificable.controls).forEach((key) => {
      if (key !== 'areve_adjunto' && key !== 'urlArchivo' && key !== 'areve_archivo' && key !== 'nombreArchivo') {
        const value = this.formVerificable.get(key)?.value;
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      }
    });

    // Manejar el archivo adjunto
    if (this.archivoAdjunto instanceof File && this.archivoAdjunto.size > 0) {
      // Si hay un nuevo archivo seleccionado
      if (!this.validateFile(this.archivoAdjunto)) {
        return null;
      }
      formData.append('areve_adjunto', this.archivoAdjunto);
    }
    // En modo edición, si no hay nuevo archivo, no agregamos nada al FormData
    // El backend mantendrá el archivo existente automáticamente

    if (this.isAdicionalMode) {
      formData.append('areev_codigo', '4');
      if (!formData.has('areve_motivo_estado') || !formData.get('areve_motivo_estado')) {
        formData.append('areve_motivo_estado', 'Adicional');
      }
    } else if (!this.isEditMode) {
      formData.set('areev_codigo', '5');
    }

    return formData;
  }

  protected closeModal(event: MouseEvent): void {
    event.preventDefault();
    // Obtenemos la referencia al input file y lo limpiamos
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    this.resetForm();
    this.modalFormSrv.closeModal();
    this.isEditMode = false;
    this.isAdicionalMode = false;
    this.isLoadingTitle = false;
    this.isLoading = false;
    // Reiniciamos el estado del archivo
    this.archivoAdjunto = null;
    this.fileName = '';
  }

  public resetForm(): void {
    this.isLoadingSubmint = false;
    this.estadoOriginal = null;
    // Reset del formulario con valores iniciales
    this.formVerificable.reset({
      areve_codigo: null,
      areve_descripcion: '',
      areve_archivo: '',
      urlArchivo: '',
      nombreArchivo: '',
      arers_codigo_per: '',
      areve_adjunto: ''
    });

    // Limpiamos específicamente los errores de los campos de archivo
    this.formVerificable.get('areve_adjunto')?.setErrors(null);
    this.formVerificable.get('nombreArchivo')?.setErrors(null);

    // Reiniciamos el estado del archivo
    this.archivoAdjunto = null;
    this.fileName = '';
    
    // Limpiamos el input file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    this.isLoadingTitle = false;

    // Aseguramos que los campos no estén marcados como tocados
    this.formVerificable.get('areve_adjunto')?.markAsUntouched();
    this.formVerificable.get('nombreArchivo')?.markAsUntouched();
    
    // Aseguramos que no queden residuos del archivo anterior
    this.formVerificable.patchValue({
      areve_adjunto: null,
      nombreArchivo: '',
      urlArchivo: '',
      areve_archivo: ''
    });
  }

  protected captureFile(event: Event): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    
    // Limpiamos el estado anterior del archivo
    this.formVerificable.patchValue({
      areve_adjunto: null,
      nombreArchivo: ''
    });
    this.archivoAdjunto = null;
    this.fileName = '';

    if (file) {
      this.archivoAdjunto = file;
      this.formVerificable.patchValue({
        areve_adjunto: file.name,
        nombreArchivo: file.name,
      });
      this.fileName = file.name;
      
      // Limpiamos los errores si hay un archivo válido
      this.formVerificable.get('areve_adjunto')?.setErrors(null);
      this.formVerificable.get('nombreArchivo')?.setErrors(null);
    } else {
      // Si no hay archivo seleccionado, marcamos el campo como inválido
      this.formVerificable.get('areve_adjunto')?.setErrors({ required: true });
      this.formVerificable.get('nombreArchivo')?.setErrors({ required: true });
    }
  }

  protected cleanInputFile(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    
    // Limpiamos los valores del formulario
    this.formVerificable.patchValue({ 
      areve_adjunto: null,
      nombreArchivo: ''
    }); 

    // Reiniciamos el estado del archivo
    this.archivoAdjunto = null;
    input.value = '';
    this.fileName = '';
    
    // Marcamos los campos como inválidos al limpiar
    this.formVerificable.get('areve_adjunto')?.setErrors({ required: true });
    this.formVerificable.get('nombreArchivo')?.setErrors({ required: true });
    this.formVerificable.get('areve_adjunto')?.markAsTouched();
    this.formVerificable.get('nombreArchivo')?.markAsTouched();
  }

  protected openFile(event: MouseEvent): void {
    event.preventDefault();
    if (this.archivoAdjunto.name != null) {
      window.open(URL.createObjectURL(this.archivoAdjunto), '_blank');
    } else if (this.formVerificable.get('areve_archivo')?.value != null) {
      const blob = new Uint8Array(
        atob(this.formVerificable.get('areve_archivo')?.value)
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

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formVerificable.get(fieldName);
    return !!(field?.invalid && (field.dirty || field.touched));
  }

  protected getErrorMessage(fieldName: string): string {
    const control = this.formVerificable.get(fieldName);
    if (control?.hasError('required')) {
      if (fieldName === 'nombreArchivo' || fieldName === 'areve_adjunto') {
        return 'El archivo verificable es requerido';
      }
      return 'Este campo es requerido';
    }
    return '';
  }

  protected markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      control.markAsDirty();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private initForm() {
    this.estadoOriginal = this.data?.estado_seguimiento?.areev_codigo ?? this.estadoOriginal;
    this.formVerificable = new FormGroup({
      areve_codigo: new FormControl(this.data?.areve_codigo || null),
      areve_descripcion: new FormControl(this.data?.areve_descripcion || '', [Validators.required]),
      arers_codigo_per: new FormControl(
        this.data?.responsable?.arers_codigo_per || (this.data as any)?.arers_codigo_per || '',
        [Validators.required]
      ),
      urlArchivo: new FormControl(this.data?.areve_adjunto || ''),
      areve_archivo: new FormControl(this.data?.areve_archivo || ''),
      nombreArchivo: new FormControl(
        this.fileUtils.getFileName(this.data?.areve_adjunto) || '',
        this.isEditMode ? [] : [Validators.required]
      ),
      areve_adjunto: new FormControl('',
        this.isEditMode ? [] : [Validators.required]
      )
    });

    // En modo edición, si hay un archivo existente, establecer el fileName
    if (this.isEditMode && this.data?.areve_adjunto) {
      this.fileName = this.fileUtils.getFileName(this.data.areve_adjunto);
      // También asegurar que nombreArchivo tenga el valor correcto
      this.formVerificable.patchValue({
        nombreArchivo: this.fileName
      });
    }
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

  private getVerificable(areve_codigo: number) {
    this.verificableSrv.getVerificable(areve_codigo).subscribe({
      next: (response: any) => {
        if (response && response.codigo === 1) {
          this.data = response.datos;
          this.estadoOriginal = response.datos?.estado_seguimiento?.areev_codigo ?? this.estadoOriginal;
          this.initForm();
          if (this.data?.advertencia) {
            this.alertsService.showAlert(this.data.advertencia, 'warning');
          }
        } else {
          this.alertsService.showAlert(
            response?.mensaje || 'Ocurrió un error al consultar la información. Consulte con el administrador del sistema.',
            'error'
          );
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error(error);
        let mensaje = 'Ocurrió un error inesperado. Consulte con el administrador del sistema.';

        if (error?.status === 0) {
          mensaje = 'Sin conexión con el servidor backend. Verifique su conexión de red.';
        } else if (error?.error?.mensaje) {
          mensaje = error.error.mensaje;
        } else if (typeof error === 'string') {
          mensaje = error;
        } else if (error?.message) {
          mensaje = error.message;
        }

        this.alertsService.showAlert(mensaje, 'error');
        this.isLoading = false;
      },
    });
  }
}

