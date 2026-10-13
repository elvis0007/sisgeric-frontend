import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { EstadoSegumientoWrite } from '@features/ai-seg-configuracion/models/Estado-Seg';
import { EstadoSegService } from '@features/ai-seg-configuracion/services/estado-seg/estado-seg.service';
import { ModalEstadoSegService } from '@features/ai-seg-configuracion/services/estado-seg/modal-estado-seg.service';
import { AlertsStateService } from '@core/services/alerts-state.service';
@Component({
  selector: 'app-modal-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-form.component.html',
  styleUrl: './modal-form.component.css',
})
export class ModalFormComponent {

  @Input() reloadTable!: () => void;
  protected modalFormSrv: ModalEstadoSegService = inject(ModalEstadoSegService);
  protected readonly estadoSegSrv: EstadoSegService = inject(EstadoSegService);
  protected readonly alertsService = inject(AlertsStateService);

  protected formEstadoSeg!: FormGroup;
  protected data!: EstadoSegumientoWrite;
  protected isEditMode = false;
  protected formSubmitted = false;
  protected isLoadingSubmint = false;

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
    if (this.formEstadoSeg.invalid) {
      this.markFormGroupTouched(this.formEstadoSeg);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }
    const codigo = this.formEstadoSeg.get('arees_codigo')?.value;
    codigo ? this.editEstadoSeg() : this.registerEstadoSeg();
  }

  private editEstadoSeg(): void {
    this.isLoadingSubmint = true;
    const estadoSegData: EstadoSegumientoWrite = {
      arees_codigo: this.formEstadoSeg.get('arees_codigo')?.value,
      arees_descripcion: this.formEstadoSeg.get('arees_descripcion')?.value,
    };

    this.estadoSegSrv.editEstadoSeguimiento(estadoSegData).subscribe({
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

  private registerEstadoSeg(): void {
    this.isLoadingSubmint = true;
    const estadoSegData: EstadoSegumientoWrite = {
      arees_codigo: this.formEstadoSeg.get('arees_codigo')?.value,
      arees_descripcion: this.formEstadoSeg.get('arees_descripcion')?.value,
    };

    this.estadoSegSrv.registerEstadoSeguimiento(estadoSegData).subscribe({
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
    this.formEstadoSeg = new FormGroup({
      arees_codigo: new FormControl(this.data?.arees_codigo || null),
      arees_descripcion: new FormControl(this.data?.arees_descripcion || '', [
        Validators.required,
      ]),
    });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formEstadoSeg.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  protected closeModal() {
    this.modalFormSrv.closeModal();
    this.resetForm();
    this.isEditMode = false;
    this.formSubmitted = false;
  }

  public resetForm(): void {
    this.formEstadoSeg.reset({
      arees_codigo: null,
      arees_descripcion: '',
    });
    this.formSubmitted = false;
  }
}
