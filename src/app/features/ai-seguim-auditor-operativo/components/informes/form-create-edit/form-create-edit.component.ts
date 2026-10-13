import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OrganismoControl } from '@features/ai-seguim-auditor-operativo/models/informe';
import { TipoInforme } from '@features/ai-seguim-auditor-operativo/models/informe';
import { InformesService } from '@features/ai-seguim-auditor-operativo/services/informes/informes.service';
import { ModalService } from '@features/ai-seguim-auditor-operativo/services/informes/modal.service';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-form-create-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './form-create-edit.component.html',
  styleUrl: './form-create-edit.component.css',
})
export class FormCreateEditComponent implements OnInit, OnDestroy, OnChanges {
  @Input() formInforme!: FormGroup;
  @Input() isEditMode!: boolean;
  @Input() reloadTable!: () => void;

  private readonly modalService: ModalService = inject(ModalService);
  private readonly informesSrv: InformesService = inject(InformesService);
  private readonly alertsService: AlertsStateService = inject(AlertsStateService);
  private readonly modalConfirmationService: ModalConfirmationService = inject(ModalConfirmationService);
  private subscriptionsConf: Subscription[] = [];
  private upperCaseSubscriptions: Subscription[] = [];

  private readonly upperCaseFields = [
    'ainin_titulo',
    'ainin_memoAprobacion',
    'ainin_memorando',
    'ainin_otnum',
  ];

  protected archivoAdjunto: any = [];
  protected organismoControl: OrganismoControl[] = [];
  protected tipoInforme: TipoInforme[] = [];
  protected fileName!: String;
  protected isLoadingSubmint = false;

  // Variable para controlar si el formulario ha sido enviado
  protected formSubmitted = false;

  ngOnDestroy(): void {
    this.subscriptionsConf.forEach((sub) => sub.unsubscribe());
    this.upperCaseSubscriptions.forEach((sub) => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['formInforme'] && this.formInforme) {
      this.setupUpperCaseControls();
      this.setFechaAprobacionState();
    }
  }

  ngOnInit(): void {
    this.loadOrganismoControl();
    this.loadTipoInforme();
    this.loadFile();
    this.getCurrentDate();
    this.setFechaAprobacionState();
    this.setupUpperCaseControls();
  }

  private setupUpperCaseControls(): void {
    this.upperCaseSubscriptions.forEach((sub) => sub.unsubscribe());
    this.upperCaseSubscriptions = [];

    if (!this.formInforme) return;

    this.upperCaseFields.forEach((fieldName) => {
      const control = this.formInforme.get(fieldName);
      if (control) {
        if (control.value && typeof control.value === 'string') {
          const upper = control.value.toUpperCase();
          if (control.value !== upper) {
            control.setValue(upper, { emitEvent: false });
          }
        }
        const sub = control.valueChanges.subscribe((val: any) => {
          if (val && typeof val === 'string') {
            const upper = val.toUpperCase();
            if (val !== upper) {
              control.setValue(upper, { emitEvent: false });
            }
          }
        });
        this.upperCaseSubscriptions.push(sub);
      }
    });
  }

  protected onTextInput(event: Event, fieldName: string): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (target && target.value !== undefined) {
      const upper = target.value.toUpperCase();
      if (target.value !== upper) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        target.value = upper;
        this.formInforme.get(fieldName)?.setValue(upper, { emitEvent: false });
        if (start !== null && end !== null) {
          target.setSelectionRange(start, end);
        }
      }
    }
  }

  protected onTituloInput(event: Event): void {
    this.onTextInput(event, 'ainin_titulo');
  }

  protected toSend() {
    this.formSubmitted = true;
    
    // En modo edición, si no hay nuevo archivo seleccionado pero hay archivo existente,
    // no validar el campo ainin_infAdjunto como requerido
    if (this.isEditMode && !this.archivoAdjunto && this.formInforme.get('nombreArchivo')?.value) {
      // Temporalmente remover la validación required del campo ainin_infAdjunto
      this.formInforme.get('ainin_infAdjunto')?.clearValidators();
      this.formInforme.get('ainin_infAdjunto')?.updateValueAndValidity();
    }
    
    if (this.formInforme.invalid) {
      // Marcar todos los campos como touched para el estilo visual
      Object.keys(this.formInforme.controls).forEach((key) => {
        const control = this.formInforme.get(key);
        control?.markAsTouched();
      });

      this.alertsService.showAlert(
        'Por favor complete todos los campos requeridos',
        'error'
      );
      return;
    }
    const codigo = this.formInforme.get('ainin_codigo')?.value;
    if (codigo) {
      this.editInforme();
    } else {
      const actionId = this.modalConfirmationService.show({
        title: 'Advertencia',
        message: 'Recuerde que al ingresar las recomendaciones correspondientes a este informe debe notificar, desde el botón de campanita.',
        confirmText: 'CONFIRMAR',
        cancelText: 'CANCELAR',
        confirmButtonType: 'primary',
        cancelButtonType: 'error',
        titleClass: 'text-amber-500 font-bold'
      });

      const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
        this.createInforme();
      });
      this.subscriptionsConf.push(subscription);
    }
  }

  // Función para verificar si un campo es inválido
  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formInforme.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  protected isFieldOTInvalid(fieldName: string): boolean {
    const field = this.formInforme.get(fieldName);
    // El campo será inválido si el formulario fue enviado y el campo es inválido
    // Se ha eliminado la validación field?.value <= 0 para permitir el valor cero
    return !!(this.formSubmitted && field?.invalid);
  }

  private setFechaAprobacionState(): void {
    // Deshabilitar el campo si estamos en modo edición y ya tiene un valor
    if (this.isEditMode && this.formInforme) {
      const fechaAprobacion = this.formInforme.get('ainin_fechaAprobacion')?.value;
      const shouldDisable = !!(fechaAprobacion && typeof fechaAprobacion === 'string' && fechaAprobacion.trim() !== '');
      
      if (shouldDisable) {
        this.formInforme.get('ainin_fechaAprobacion')?.disable();
      } else {
        this.formInforme.get('ainin_fechaAprobacion')?.enable();
      }
    }
  }

  private loadTipoInforme() {
    this.informesSrv.getTipoInforme().subscribe({
      next: (response) => (this.tipoInforme = response.datos),
      error: (err) => console.error('Error loading tipo informe:', err),
    });
  }

  private loadOrganismoControl() {
    this.informesSrv.getOrganismoControl().subscribe({
      next: (response) => (this.organismoControl = response.datos),
      error: (err) => console.error('Error loading organismo control:', err),
    });
  }

  protected loadFile() {
    if (this.isEditMode && this.formInforme.get('urlArchivo')?.value) {
      const urlFile = this.formInforme.get('urlArchivo')?.value;
      this.fileName = urlFile.split('/').pop() || '';
      // También asegurar que nombreArchivo tenga el valor correcto
      this.formInforme.patchValue({
        nombreArchivo: this.fileName
      });
    }
  }

  private createInforme(): void {
    this.isLoadingSubmint = true;
    const formDataInforme = this.buildFormData();

    // Si buildFormData devuelve null, significa que hubo un error de validación
    if (!formDataInforme) return;

    this.informesSrv.saveInforme(formDataInforme).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.isLoadingSubmint = false;
        this.modalService.closeModal();
        this.resetForm();
        this.reloadTable();
      },
      error: (response: any) => {
        this.alertsService.showAlert(`${response}`, 'error');
        this.isLoadingSubmint = false;
      },
    });
  }

  private editInforme(): void {
    this.isLoadingSubmint = true;
    const formDataInforme = this.buildFormData();
    // Si buildFormData devuelve null, significa que hubo un error de validación
    if (!formDataInforme) return;

    this.informesSrv
      .editInformes(
        formDataInforme,
        this.formInforme.get('ainin_codigo')?.value
      )
      .subscribe({
        next: (response) => {
          this.alertsService.showAlert(response.mensaje, 'success');
          this.isLoadingSubmint = false;
          this.modalService.closeModal();
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
    if (file.type !== 'application/pdf') {
      this.alertsService.showAlert('Solo se permiten archivos PDF.', 'error');
      return false;
    }

    // Validar tamaño máximo del archivo (50 MB)
    const maxSizeBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const tamanoMB = (file.size / (1024 * 1024)).toFixed(2);
      this.alertsService.showAlert(
        `El archivo excede el tamaño máximo permitido (50 MB). El archivo seleccionado pesa ${tamanoMB} MB.`,
        'error'
      );
      return false;
    }

    return true;
  }

  private buildFormData(): FormData | null {
    const formData = new FormData();

    // Validar si hay archivo adjunto en modo creación
    if (!this.isEditMode && (!this.archivoAdjunto || !(this.archivoAdjunto instanceof File))) {
      this.alertsService.showAlert(
        'Debe adjuntar un archivo PDF',
        'error'
      );
      return null;
    }

    // Agregar todos los campos del formulario excepto los relacionados con archivos
    Object.keys(this.formInforme.controls).forEach((key) => {
      if (key !== 'ainin_infAdjunto' && key !== 'urlArchivo' && key !== 'ainin_archivo' && key !== 'nombreArchivo') {
        let value = this.formInforme.get(key)?.value;
        if (
          (key === 'ainin_titulo' ||
            key === 'ainin_memoAprobacion' ||
            key === 'ainin_memorando' ||
            key === 'ainin_otnum') &&
          typeof value === 'string'
        ) {
          value = value.toUpperCase().trim();
        }
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
      formData.append('ainin_infAdjunto', this.archivoAdjunto);
    }
    // En modo edición, si no hay nuevo archivo, no agregamos nada al FormData
    // El backend mantendrá el archivo existente automáticamente

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
    this.modalService.closeModal();
    this.isEditMode = false;
    this.formSubmitted = false;
    // Reiniciamos el estado del archivo
    this.archivoAdjunto = null;
    this.fileName = '';
  }

  public resetForm(): void {
    // Reset del formulario con valores iniciales
    this.formInforme.reset({
      ainin_codigo: null,
      ainin_titulo: '',
      ainin_otnum: '',
      ainin_otanio: new Date().getFullYear(),
      ainin_infAdjunto: '',
      ainin_fechaEmision: new Date().toISOString().split('T')[0],
      ainin_fechaAprobacion: '',
      ainin_memoAprobacion: '',
      ainin_fechaMemo: '',
      ainin_memorando: '',
      ainti_tipoInf: '',
      ainoc_organismoControl: '',
      urlArchivo: '',
      nombreArchivo: '',
      ainin_archivo: '',
    });

    // Limpiamos específicamente los errores de los campos de archivo
    this.formInforme.get('ainin_infAdjunto')?.setErrors(null);
    this.formInforme.get('nombreArchivo')?.setErrors(null);

    // Reiniciamos el estado del archivo
    this.archivoAdjunto = null;
    this.fileName = '';
    
    // Limpiamos el input file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    // Aseguramos que los campos no estén marcados como tocados
    this.formInforme.get('ainin_infAdjunto')?.markAsUntouched();
    this.formInforme.get('nombreArchivo')?.markAsUntouched();
    
    // Aseguramos que no queden residuos del archivo anterior
    this.formInforme.patchValue({
      ainin_infAdjunto: null,
      nombreArchivo: '',
      urlArchivo: '',
      ainin_archivo: ''
    });

    // Reset del estado de validación
    this.formSubmitted = false;
  }

  protected captureFile(event: Event): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    
    // Limpiamos el estado anterior del archivo
    this.formInforme.patchValue({
      ainin_infAdjunto: null,
      nombreArchivo: ''
    });
    this.archivoAdjunto = null;
    this.fileName = '';

    if (file) {
      if (!this.validateFile(file)) {
        element.value = ''; // Limpiar el input si la validación falla
        return;
      }
      this.archivoAdjunto = file;
      this.formInforme.patchValue({
        ainin_infAdjunto: file.name,
        nombreArchivo: file.name,
      });
      this.fileName = file.name;
    } else {
      // Si no hay archivo seleccionado, establecer el valor como vacío
      this.formInforme.patchValue({
        ainin_infAdjunto: '',
        nombreArchivo: '',
      });
      this.fileName = '';
    }
  }

  protected cleanInputFile(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    
    // Limpiamos los valores del formulario
    this.formInforme.patchValue({ 
      ainin_infAdjunto: null,
      nombreArchivo: ''
    }); 

    // Reiniciamos el estado del archivo
    this.archivoAdjunto = null;
    input.value = '';
    this.fileName = '';
  }

  protected openFile(event: MouseEvent): void {
    event.preventDefault();
    if (this.archivoAdjunto.name != null) {
      window.open(URL.createObjectURL(this.archivoAdjunto), '_blank');
    } else if (this.formInforme.get('ainin_archivo')?.value != null) {
      const blob = new Uint8Array(
        atob(this.formInforme.get('ainin_archivo')?.value)
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

  private getCurrentDate(): void {
    const today = new Date().toISOString().split('T')[0];
    this.formInforme.get('ainin_fechaEmision')?.setValue(today);
  }
}
