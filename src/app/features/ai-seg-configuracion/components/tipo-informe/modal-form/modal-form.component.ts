import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { TipoInformeWrite } from '@features/ai-seg-configuracion/models/Tipo-Informe';
import { ModalTipoInformeService } from '@features/ai-seg-configuracion/services/tipo-informe/modal-tipo-informe.service';
import { TipoInformeService } from '@features/ai-seg-configuracion/services/tipo-informe/tipo-informe.service';

@Component({
  selector: 'app-modal-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-form.component.html',
  styleUrl: './modal-form.component.css',
})
export class ModalFormComponent {

  @Input() reloadTable!: () => void;
  protected modalFormSrv: ModalTipoInformeService = inject(ModalTipoInformeService);
  protected readonly tipoInformeSrv: TipoInformeService = inject(TipoInformeService);
  protected readonly alertsService = inject(AlertsStateService);
  protected isLoadingSubmint = false;
  protected formTipoInforme!: FormGroup;
  protected data!: TipoInformeWrite;
  protected isEditMode = false;
  protected formSubmitted = false;
  
  ngOnInit(): void {
    this.initForm();
  }

  constructor() {
    effect(() => {
      const modalData = this.modalFormSrv.modalData();
      const operationType = this.modalFormSrv.getOperationType();

      if (modalData) {
        this.isEditMode = operationType === 'edit';
        this.data = modalData;
        this.initForm(); // Reinitialize the form with the new data
      }
    });
  }

  protected toSend() {
    this.formSubmitted = true;
    if (this.formTipoInforme.invalid) {
      this.markFormGroupTouched(this.formTipoInforme);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }
    const codigo = this.formTipoInforme.get('ainti_codigo')?.value;
    codigo ? this.editTipoInforme() : this.registerTipoInforme();
  }

  private editTipoInforme(): void {
    this.isLoadingSubmint = true;
    const recomendacionData: TipoInformeWrite = {
      ainti_codigo: this.formTipoInforme.get('ainti_codigo')?.value,
      ainti_descripcion: this.formTipoInforme.get('ainti_descripcion')?.value,
    };

    this.tipoInformeSrv.editTipoInforme(recomendacionData).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.isLoadingSubmint = false;
        this.modalFormSrv.closeModal();
        this.resetForm();
        this.reloadTable();
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
        this.isLoadingSubmint = false;
      },
    });
  }

  private registerTipoInforme(): void {
    this.isLoadingSubmint = true;
    const recomendacionData: TipoInformeWrite = {
      ainti_codigo: this.formTipoInforme.get('ainti_codigo')?.value,
      ainti_descripcion: this.formTipoInforme.get('ainti_descripcion')?.value,
    };

    this.tipoInformeSrv.registerTipoInforme(recomendacionData).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.isLoadingSubmint = false;
        this.modalFormSrv.closeModal();
        this.resetForm();
        this.reloadTable();
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
        this.isLoadingSubmint = false;
      },
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
  private initForm() {
    this.formTipoInforme = new FormGroup({
      ainti_codigo: new FormControl(this.data?.ainti_codigo || null),
      ainti_descripcion: new FormControl(this.data?.ainti_descripcion || '', [
        Validators.required,
      ]),
    });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formTipoInforme.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  protected closeModal() {
    this.modalFormSrv.closeModal();
    this.resetForm();
    this.isEditMode = false;
    this.formSubmitted = false;
  }

  public resetForm(): void {
    this.formTipoInforme.reset({
      ainti_codigo: null,
      ainti_descripcion: '',
    });
    this.formSubmitted = false;
  }
}
