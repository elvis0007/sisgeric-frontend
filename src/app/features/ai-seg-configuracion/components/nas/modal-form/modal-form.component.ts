import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Nas } from '@features/ai-seg-configuracion/models/Nas';
import { ModalService } from '@features/ai-seg-configuracion/services/nas/modal.service';
import { NasService } from '@features/ai-seg-configuracion/services/nas/nas.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { ResponseWrite } from '@shared/models/response-write';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-modal-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-form.component.html',
  styleUrl: './modal-form.component.css',
})
export class ModalFormComponent {
  protected modalSrv: ModalService = inject(ModalService);
  protected formConfiguracion!: FormGroup;
  protected config!: Nas;
  protected data!: Nas;
  protected editField: string | null = null;
  protected isLoadingSubmint = false;
  protected readonly configuracionSrv: NasService = inject(NasService);
  protected readonly alertsService = inject(AlertsStateService);

  ngOnInit(): void {
    this.initForm();
  }

  constructor() {
    effect(() => {
      this.config = this.modalSrv.modalData();
      this.editField = (this.config as any)?.editField || null;
      if (this.config && this.config.aseco_codigo) {
        this.getConfiguracion(this.config);
      }
    });
  }

  private getConfiguracion(configuracion: Nas): void {
    this.configuracionSrv.getConfiguracion(configuracion).subscribe({
      next: (response: ResponseReadSimple<Nas>) => {
        this.data = response.datos;
        this.initForm();
      },
      error: (error) => {
        console.error(error);
      },
    });
  }

  private initForm() {
    this.formConfiguracion = new FormGroup({
      aseco_codigo: new FormControl(this.data?.aseco_codigo || ''),
      aseco_host: new FormControl(
        this.data?.aseco_host || '',
        this.editField === 'host' ? Validators.required : []
      ),
      aseco_port: new FormControl(
        this.data?.aseco_port || '',
        this.editField === 'port' ? Validators.required : []
      ),
      aseco_user: new FormControl(
        this.data?.aseco_user || '',
        this.editField === 'user' ? Validators.required : []
      ),
      aseco_nombre_host: new FormControl(
        this.data?.aseco_nombre_host || '',
        this.editField === 'hostname' ? Validators.required : []
      ),
      aseco_directorio: new FormControl(
        this.data?.aseco_directorio || '',
        this.editField === 'directory' ? Validators.required : []
      ),
      aseco_size_file_mb: new FormControl(
        this.data?.aseco_size_file_mb || '',
        this.editField === 'filesize' ? [Validators.required, Validators.min(1), Validators.max(10240)] : []
      ),
      aseco_contrasenia: new FormControl(
        '', 
        this.editField === 'password' ? Validators.required : []
      ),
      aseco_contrasenia2: new FormControl(
        '', 
        this.editField === 'password' ? Validators.required : []
      ),
    });
  }

  protected getModalTitle(): string {
    if (!this.editField) {
      return 'Editar Configuración';
    }
    
    const fieldTitles: { [key: string]: string } = {
      'host': 'Editar Host',
      'port': 'Editar Puerto',
      'user': 'Editar Usuario',
      'password': 'Cambiar Contraseña',
      'hostname': 'Editar Nombre del Host',
      'directory': 'Editar Directorio',
      'filesize': 'Editar Tamaño de Archivo'
    };
    
    return fieldTitles[this.editField] || 'Editar Campo';
  }

  protected getFieldLabel(): string {
    const fieldLabels: { [key: string]: string } = {
      'host': 'Host',
      'port': 'Puerto',
      'user': 'Usuario',
      'password': 'Contraseña',
      'hostname': 'Nombre del Host',
      'directory': 'Directorio',
      'filesize': 'Tamaño de Archivo'
    };
    
    return fieldLabels[this.editField || ''] || 'Campo';
  }

  protected toSend() {
    this.validatePassword();
    if (this.formConfiguracion.valid) {
      this.editConfiguracion();
    }
  }

  private editConfiguracion() {
    this.isLoadingSubmint = true;
    
    // Construir el objeto de datos con todos los campos actuales
    const updateData: Nas = {
      aseco_codigo: this.data.aseco_codigo,
      aseco_host: this.data.aseco_host,
      aseco_port: this.data.aseco_port,
      aseco_user: this.data.aseco_user,
      aseco_nombre_host: this.data.aseco_nombre_host,
      aseco_directorio: this.data.aseco_directorio,
      aseco_size_file_mb: this.data.aseco_size_file_mb
    };

    // Actualizar solo el campo que se está editando
    if (this.editField && this.editField !== 'password') {
      const fieldName = this.getFieldName();
      const newValue = this.formConfiguracion.get(fieldName)?.value;
      
      // Validar que el valor no esté vacío y sea válido
      if (newValue !== null && newValue !== undefined && newValue !== '') {
        // Para campos numéricos, asegurar que sea un número válido
        if (fieldName === 'aseco_size_file_mb' || fieldName === 'aseco_port') {
          const numValue = Number(newValue);
          if (!isNaN(numValue) && numValue > 0) {
            (updateData as any)[fieldName] = numValue;
          }
        } else {
          // Para campos de texto, asegurar que no sea solo espacios
          const stringValue = String(newValue).trim();
          if (stringValue.length > 0) {
            (updateData as any)[fieldName] = stringValue;
          }
        }
      }
    }

    // Manejar la contraseña por separado
    let password = '';
    if (this.editField === 'password') {
      password = this.formConfiguracion.get('aseco_contrasenia')?.value || '';
    }

    

    this.configuracionSrv
      .updateConfiguracion(updateData, password)
      .subscribe({
        next: (response: ResponseWrite) => {
          this.alertsService.showAlert(response.mensaje, 'success');
          this.isLoadingSubmint = false;
          this.modalSrv.notifyConfigurationUpdated();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error al actualizar:', error);
          this.alertsService.showAlert('Error al guardar cambios', 'error');
          this.isLoadingSubmint = false;
        },
      });
  }

  private getFieldName(): string {
    const fieldMapping: { [key: string]: string } = {
      'host': 'aseco_host',
      'port': 'aseco_port',
      'user': 'aseco_user',
      'hostname': 'aseco_nombre_host',
      'directory': 'aseco_directorio',
      'filesize': 'aseco_size_file_mb'
    };
    
    return fieldMapping[this.editField || ''] || '';
  }

  private validatePassword() {
    if (this.editField === 'password') {
      const password = this.formConfiguracion.get('aseco_contrasenia')?.value;
      const password2 = this.formConfiguracion.get('aseco_contrasenia2')?.value;

      if (password !== password2) {
        this.formConfiguracion
          .get('aseco_contrasenia2')
          ?.setErrors({ noMatch: true });
      } else {
        this.formConfiguracion.get('aseco_contrasenia2')?.setErrors(null);
      }
    }
  }

  protected closeModal() {
    this.modalSrv.closeModal();
    this.formConfiguracion.reset();
    this.editField = null;
    this.isLoadingSubmint = false;
  }
}
