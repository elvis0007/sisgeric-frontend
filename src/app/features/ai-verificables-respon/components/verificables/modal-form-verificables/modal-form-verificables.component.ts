import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '@core/auth/models/authentication';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalFormVerificablesService } from '@features/ai-verificables-respon/services/verificables/modal-form-verificables.service';
import { ModalVerificablesService } from '@features/ai-verificables-respon/services/verificables/modal-verificables.service';
import { DetalleRecomendacion } from '@features/ai-rec-verificables/models/Recomendacion';
import { Verificable } from '@features/ai-rec-verificables/models/Verificable';
import { RecomendacionesVerificablesService } from '@features/ai-rec-verificables/services/recomendaciones/recomendaciones-verificables.service';
import { VerificablesService } from '@features/ai-rec-verificables/services/verificables/verificables.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { FileUtils } from '@shared/utils/file-utils';
import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-modal-form-verificables',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AbsPipe],
  templateUrl: './modal-form-verificables.component.html',
  styleUrl: './modal-form-verificables.component.css',
})
export class ModalFormVerificablesComponent {
  protected readonly auxiliarSrv = inject(AuxiliaryService);
  protected readonly verificableSrv: VerificablesService =
    inject(VerificablesService);
  protected readonly recomendacionVerSrv: RecomendacionesVerificablesService =
    inject(RecomendacionesVerificablesService);
  protected readonly modalFormSrv: ModalFormVerificablesService = inject(
    ModalFormVerificablesService
  );
  protected readonly modalVerificablesSrv: ModalVerificablesService = inject(
    ModalVerificablesService
  );
  protected readonly alertStateService = inject(AlertsStateService);
  private readonly fileUtils: FileUtils = inject(FileUtils);
  private readonly verificablesRespSrv: VerificablesResponsablesService = inject(VerificablesResponsablesService);

  protected formVerificable!: FormGroup;
  protected isEditMode = false;
  protected formSubmitted = false;
  protected data!: Verificable;
  protected fileName!: String;
  protected archivoAdjunto: any = null; // Para modo edición
  protected archivosAdjuntos: File[] = []; // Para modo creación múltiple
  protected isDragging = false;
  protected uploadProgressText = '';
  protected uploadProgressPercent = 0;
  protected showConfirmModal = false;

  protected estadoSeguimientos: any = [];
  protected user: User | null = null;
  protected detalleRecomendacion: DetalleRecomendacion | null = null;
  protected modalData: any = null;
  protected isLoading = false;
  protected isLoadingSubmint = false;

  ngOnInit(): void {
    this.user = this.auxiliarSrv.getUserInfo();
    this.initForm();
  }

  constructor() {
    effect(() => {
      this.modalData = this.modalFormSrv.modalData();
      const operationType = this.modalFormSrv.getOperationType();

      if (this.modalData) {
        this.isEditMode = operationType === 'edit';
        this.isLoading = true;
        if (this.isEditMode) {
          this.getVerificable(this.modalData.areve_codigo);
        } else {
          this.isLoading = false;
          this.resetForm();
        }
        this.getDetalleRecomendacion(this.modalData.arere_codigo);
      }
    });
  }

  protected toSend() {
    this.formSubmitted = true;

    if (!this.isEditMode) {
      const plazo = this.modalData?.plazo ?? this.detalleRecomendacion?.recomendaciones?.plazo;
      const status = this.modalData?.status;
      if (status === 3 || (plazo !== undefined && plazo !== null && plazo < 0)) {
        this.alertStateService.showAlert(
          'No se pueden ingresar nuevos verificables porque el plazo de la recomendación se encuentra vencido. Por favor, solicite una ampliación de plazo.',
          'error'
        );
        return;
      }
    }

    if (this.formVerificable.get('areve_descripcion')?.invalid) {
      this.formVerificable.get('areve_descripcion')?.markAsTouched();
      this.alertStateService.showAlert(
        'Por favor ingrese la descripción requerida',
        'error'
      );
      return;
    }

    if (this.isEditMode) {
      this.editVerificable();
    } else {
      if (this.archivosAdjuntos.length === 0) {
        this.alertStateService.showAlert(
          'Debe adjuntar al menos un archivo verificable',
          'error'
        );
        return;
      }
      this.showConfirmModal = true;
    }
  }

  protected proceedSend(): void {
    this.showConfirmModal = false;
    this.createVerificables();
  }

  protected cancelConfirmSend(): void {
    this.showConfirmModal = false;
  }

  protected getEstadoPlazo(): string {
    const plazo = this.modalData?.plazo ?? this.detalleRecomendacion?.recomendaciones?.plazo ?? 0;
    return plazo < 0 ? 'días vencidos' : 'días vigentes';
  }

  protected getFechaMaxima(): string {
    return this.modalData?.fechaMax
      || this.modalData?.arere_fecha_maxima
      || (this.detalleRecomendacion as any)?.aredr_fecha_maxima
      || (this.detalleRecomendacion?.recomendaciones as any)?.aredr_fecha_maxima
      || this.detalleRecomendacion?.recomendaciones?.arere_fecha_maxima
      || '-';
  }

  protected loadFile() {
    if (this.formVerificable.get('areve_adjunto')?.value) {
      const urlFile = this.formVerificable.get('urlArchivo')?.value;
      this.fileName = urlFile.split('/').pop();
    }
  }

  private async createVerificables(): Promise<void> {
    if (this.archivosAdjuntos.length === 0) {
      this.alertStateService.showAlert(
        'Debe adjuntar al menos un archivo verificable',
        'error'
      );
      return;
    }

    const userInfo = this.auxiliarSrv.getUserInfo();
    if (!userInfo?.codigo_per) {
      this.alertStateService.showAlert(
        'No se pudo obtener la información del usuario responsable',
        'error'
      );
      return;
    }

    const idDetRec = this.modalData.arere_codigo;
    const descripcionGeneral = this.formVerificable.get('areve_descripcion')?.value?.trim();

    this.isLoadingSubmint = true;
    const total = this.archivosAdjuntos.length;
    let successCount = 0;
    const errors: string[] = [];
    const successfulFiles: string[] = [];

    for (let i = 0; i < total; i++) {
      const file = this.archivosAdjuntos[i];
      this.uploadProgressPercent = Math.round((i / total) * 100);
      this.uploadProgressText = `Subiendo archivo ${i + 1} de ${total}: ${file.name}...`;

      const formData = new FormData();
      formData.append('arere_codigo', idDetRec.toString());
      formData.append('arers_codigo_per', userInfo.codigo_per);
      formData.append('areve_descripcion', descripcionGeneral);
      formData.append('areve_adjunto', file);
      formData.append('areev_codigo', '5');
      formData.append('omitirCorreo', 'true');

      try {
        await firstValueFrom(this.verificableSrv.saveVerificable(formData));
        successCount++;
        successfulFiles.push(file.name);
      } catch (err: any) {
        console.error(`Error al subir ${file.name}:`, err);
        errors.push(`${file.name}: ${typeof err === 'string' ? err : err?.message || 'Error al subir archivo'}`);
      }
    }

    this.uploadProgressPercent = 100;
    this.uploadProgressText = '';

    if (successCount > 0) {
      // Enviar correo y notificación consolidada a la auditora con el detalle y número de verificables
      try {
        await firstValueFrom(
          this.verificableSrv.notificarEnvioBatch({
            arere_codigo: idDetRec,
            arers_codigo_per: userInfo.codigo_per,
            cantidadVerificables: successCount,
            nombresArchivos: successfulFiles,
            descripcion: descripcionGeneral,
          })
        );
      } catch (notifErr) {
        console.warn('Advertencia al enviar notificación por correo al auditor:', notifErr);
      }

      // Notificar que se actualizaron los verificables en el estado de la vista
      this.verificablesRespSrv.notifyVerificableUpdated(idDetRec, userInfo.codigo_per);

      this.isLoadingSubmint = false;

      if (errors.length === 0) {
        const msg = successCount === 1
          ? 'Verificable registrado y enviado a auditoría exitosamente'
          : `Se registraron y remitieron los ${successCount} verificables a auditoría exitosamente`;
        const parentData = this.modalData?.parentData;
        this.alertStateService.showAlert(msg, 'success');
        this.modalFormSrv.closeModal();
        this.resetForm();
        if (parentData) {
          this.modalVerificablesSrv.openModal(parentData);
        }
      } else {
        this.alertStateService.showAlert(
          `Se enviaron ${successCount} archivo(s), pero fallaron ${errors.length}: ${errors.join(', ')}`,
          'warning'
        );
        // Filtrar y dejar solo los archivos que fallaron para facilitar el reintento
        this.archivosAdjuntos = this.archivosAdjuntos.filter((f) =>
          errors.some((e) => e.startsWith(f.name))
        );
      }
    } else {
      this.isLoadingSubmint = false;
      this.alertStateService.showAlert(
        `Error al registrar los verificables: ${errors.join('; ')}`,
        'error'
      );
    }
  }

  private validateFile(file: File): boolean {
    // Validar tipo de archivo
    const allowedTypes = [
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/pdf', // .pdf
    ];

    // Validar extensiones además de MIME types por consistencia en navegadores
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['doc', 'docx', 'xls', 'xlsx', 'pdf'];

    if (!allowedTypes.includes(file.type) && (!extension || !allowedExtensions.includes(extension))) {
      this.alertStateService.showAlert(
        `El archivo "${file.name}" no es válido. Solo se permiten archivos Word (.doc, .docx), Excel (.xls, .xlsx) o PDF (.pdf).`,
        'error'
      );
      return false;
    }

    // Validar tamaño máximo (50 MB)
    const maxSizeBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const tamanoMB = (file.size / (1024 * 1024)).toFixed(2);
      this.alertStateService.showAlert(
        `El archivo "${file.name}" excede el tamaño máximo permitido (50 MB). Pesa ${tamanoMB} MB.`,
        'error'
      );
      return false;
    }

    return true;
  }

  private editVerificable() {
    this.isLoadingSubmint = true;
    this.formSubmitted = true;
    const formDataInforme = this.buildFormData();
    if (!formDataInforme) {
      this.isLoadingSubmint = false;
      return;
    }
    this.verificableSrv
      .editVerificable(
        this.formVerificable.get('areve_codigo')?.value,
        formDataInforme
      )
      .subscribe({
        next: (response) => {
          this.alertStateService.showAlert(response.mensaje, 'success');
          this.isLoadingSubmint = false;
          this.formSubmitted = false;
          this.modalFormSrv.closeModal();
          this.resetForm();
          const userInfo = this.auxiliarSrv.getUserInfo();
          if (userInfo?.codigo_per) {
            this.verificablesRespSrv.notifyVerificableUpdated(this.modalData.arere_codigo, userInfo.codigo_per);
          }
        },
        error: (response: any) => {
          this.alertStateService.showAlert(`${response}`, 'error');
          this.formSubmitted = false;
          this.isLoadingSubmint = false;
        },
      });
  }

  private buildFormData(): FormData | null {
    const formData = new FormData();
    const idDetRec = this.modalData.arere_codigo;
    
    // Validar si hay archivo adjunto en modo creación o edición
    if (!this.isEditMode && (!this.archivoAdjunto || !(this.archivoAdjunto instanceof File))) {
      this.alertStateService.showAlert(
        'Debe adjuntar un archivo verificable',
        'error'
      );
      return null;
    }
  
    formData.append('arere_codigo', idDetRec.toString());
    
    // Código personal del responsable
    const userInfo = this.auxiliarSrv.getUserInfo();
    if (userInfo?.codigo_per) {
      formData.append('arers_codigo_per', userInfo.codigo_per);
    } else {
      this.alertStateService.showAlert(
        'No se pudo obtener la información del usuario responsable',
        'error'
      );
      return null;
    }
  
    Object.keys(this.formVerificable.controls).forEach((key) => {
      const value = this.formVerificable.get(key)?.value;
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });
  
    if (this.archivoAdjunto instanceof File && this.archivoAdjunto.size > 0) {
      if (!this.validateFile(this.archivoAdjunto)) {
        return null;
      }
      formData.append('areve_adjunto', this.archivoAdjunto);
    } else if (this.formVerificable.get('areve_adjunto')?.value) {
      formData.append(
        'areve_adjunto',
        this.formVerificable.get('areve_adjunto')?.value
      );
    }
  
    return formData;
  }

  protected closeModal(event: MouseEvent): void {
    event.preventDefault();
    const parentData = this.modalData?.parentData;
    const fileInputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
    fileInputs.forEach(input => input.value = '');
    this.showConfirmModal = false;
    this.resetForm();
    this.modalFormSrv.closeModal();
    this.isEditMode = false;
    this.isLoading = false;
    this.archivoAdjunto = null;
    this.archivosAdjuntos = [];
    this.fileName = '';
    if (parentData) {
      this.modalVerificablesSrv.openModal(parentData);
    }
  }

  public resetForm(): void {
    this.isLoadingSubmint = false;
    this.uploadProgressText = '';
    this.uploadProgressPercent = 0;
    this.formSubmitted = false;
    this.isDragging = false;
    this.showConfirmModal = false;
    this.archivosAdjuntos = [];
    this.archivoAdjunto = null;
    this.fileName = '';

    if (this.formVerificable) {
      this.formVerificable.reset({
        areve_codigo: null,
        areve_descripcion: '',
        areve_archivo: '',
        urlArchivo: '',
        nombreArchivo: '',
        areve_adjunto: ''
      });

      this.formVerificable.get('areve_adjunto')?.setErrors(null);
      this.formVerificable.get('nombreArchivo')?.setErrors(null);
      this.formVerificable.get('areve_adjunto')?.markAsUntouched();
      this.formVerificable.get('nombreArchivo')?.markAsUntouched();
    }

    const fileInputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
    fileInputs.forEach(input => input.value = '');
  }

  // Captura para múltiples archivos (Modo creación)
  protected captureFiles(event: Event): void {
    const element = event.target as HTMLInputElement;
    const files = element.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    for (const file of filesArray) {
      if (!this.validateFile(file)) {
        continue;
      }
      const exists = this.archivosAdjuntos.some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (!exists) {
        this.archivosAdjuntos.push(file);
      }
    }
    element.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  protected onFileDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    for (const file of filesArray) {
      if (!this.validateFile(file)) {
        continue;
      }
      const exists = this.archivosAdjuntos.some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (!exists) {
        this.archivosAdjuntos.push(file);
      }
    }
  }

  protected removeFile(event: Event, index: number): void {
    event.stopPropagation();
    this.archivosAdjuntos.splice(index, 1);
  }

  protected clearAllFiles(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.archivosAdjuntos = [];
  }

  protected openSelectedFile(event: Event, file: File): void {
    event.stopPropagation();
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
  }

  protected formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  protected getTotalFilesSize(): string {
    const totalBytes = this.archivosAdjuntos.reduce((acc, f) => acc + f.size, 0);
    return this.formatFileSize(totalBytes);
  }

  protected getFileIconType(fileName: string): 'pdf' | 'excel' | 'word' | 'other' {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'xls' || ext === 'xlsx') return 'excel';
    if (ext === 'doc' || ext === 'docx') return 'word';
    return 'other';
  }

  // Captura para un solo archivo (Modo edición)
  protected captureFile(event: Event): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    
    this.formVerificable.patchValue({
      areve_adjunto: null,
      nombreArchivo: ''
    });
    this.archivoAdjunto = null;
    this.fileName = '';

    if (file) {
      if (!this.validateFile(file)) {
        element.value = '';
        this.formVerificable.get('areve_adjunto')?.setErrors({ required: true });
        this.formVerificable.get('nombreArchivo')?.setErrors({ required: true });
        return;
      }
      this.archivoAdjunto = file;
      this.formVerificable.patchValue({
        areve_adjunto: file.name,
        nombreArchivo: file.name,
      });
      this.fileName = file.name;
      
      this.formVerificable.get('areve_adjunto')?.setErrors(null);
      this.formVerificable.get('nombreArchivo')?.setErrors(null);
    } else {
      this.formVerificable.get('areve_adjunto')?.setErrors({ required: true });
      this.formVerificable.get('nombreArchivo')?.setErrors({ required: true });
    }
  }

  protected cleanInputFile(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    
    this.formVerificable.patchValue({ 
      areve_adjunto: null,
      nombreArchivo: ''
    }); 

    this.archivoAdjunto = null;
    input.value = '';
    this.fileName = '';
    
    this.formVerificable.get('areve_adjunto')?.setErrors({ required: true });
    this.formVerificable.get('nombreArchivo')?.setErrors({ required: true });
    this.formVerificable.get('areve_adjunto')?.markAsTouched();
    this.formVerificable.get('nombreArchivo')?.markAsTouched();
  }

  protected openFile(event: MouseEvent): void {
    event.preventDefault();
    if (this.archivoAdjunto?.name != null) {
      window.open(URL.createObjectURL(this.archivoAdjunto), '_blank');
    } else if (this.formVerificable.get('areve_archivo')?.value != null) {
      const blob = new Uint8Array(
        atob(this.formVerificable.get('areve_archivo')?.value)
          .split('')
          .map((char) => char.charCodeAt(0))
      );
      const file = new Blob([blob], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
      URL.revokeObjectURL(fileURL);
    }
  }

  protected formatFileName(nombre: String): String {
    if (!nombre) return '';
    const longitudMaxima = 25;

    if (nombre.length > longitudMaxima) {
      const inicio = nombre.slice(0, 14);
      const fin = nombre.slice(-8);
      return `${inicio}...${fin}`;
    }

    return nombre;
  }

  protected getCurrentDate(): void {
    const today = new Date().toISOString().split('T')[0];
    this.formVerificable.get('ainin_fechaEmision')?.setValue(today);
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
    const field = this.formVerificable?.get(fieldName);
    return !!(field?.invalid && (field.dirty || field.touched || this.formSubmitted));
  }

  protected getErrorMessage(fieldName: string): string {
    const control = this.formVerificable?.get(fieldName);
    if (control?.hasError('required')) {
      if (fieldName === 'nombreArchivo' || fieldName === 'areve_adjunto') {
        return 'El archivo verificable es requerido';
      }
      return 'Este campo es requerido';
    }
    return '';
  }

  private getVerificable(areve_codigo: any) {
    this.verificableSrv.getVerificable(areve_codigo).subscribe({
      next: (response: any) => {
        if (response && response.codigo === 1) {
          this.data = response.datos;
          this.initForm();
          if (this.data?.advertencia) {
            this.alertStateService.showAlert(this.data.advertencia, 'warning');
          }
        } else {
          this.alertStateService.showAlert(
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

        this.alertStateService.showAlert(mensaje, 'error');
        this.isLoading = false;
      },
    });
  }

  private initForm() {
    this.formVerificable = new FormGroup({
      areve_codigo: new FormControl(this.data?.areve_codigo || null),
      areve_descripcion: new FormControl(this.data?.areve_descripcion || '', [Validators.required]),
      urlArchivo: new FormControl(this.data?.areve_adjunto || ''),
      areve_archivo: new FormControl(this.data?.areve_archivo || ''),
      nombreArchivo: new FormControl(
        this.fileUtils.getFileName(this.data?.areve_adjunto) || ''
      ),
      areve_adjunto: new FormControl('')
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
}
