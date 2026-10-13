import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Conclusion } from '@features/ai-seguim-auditor-operativo/models/conclusion';
import { ConclusionesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/conclusiones.service';
import { ModalFormService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/modal-form.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
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
  protected modalFormSrv: ModalFormService = inject(ModalFormService);
  protected readonly auxiliarSrv = inject(AuxiliaryService);
  protected readonly conclusionSrv: ConclusionesService = inject(ConclusionesService);
  protected readonly alertsService = inject(AlertsStateService);

  protected isLoadingSubmint = false;
  protected formConclusion!: FormGroup;
  protected data!: Conclusion;
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

    if (this.formConclusion.invalid) {
      this.markFormGroupTouched(this.formConclusion);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }
    const codigo = this.formConclusion.get('areco_codigo')?.value;
    codigo ? this.editConclusion() : '';
  }

  private editConclusion(): void {
    this.isLoadingSubmint = true;
    const conclusionData: Conclusion = {
      areco_codigo: this.formConclusion.get('areco_codigo')?.value,
      areco_conclusion: this.formConclusion.get('areco_conclusion')?.value,
    };

    this.conclusionSrv.editConclusion(conclusionData).subscribe({
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

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formConclusion.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  private initForm() {
    const ainCodeFromUrl = this.auxiliarSrv.getUrlParameter('id_con');
    this.formConclusion = new FormGroup({
      areco_codigo: new FormControl(this.data?.areco_codigo || null),
      areco_conclusion: new FormControl(this.data?.areco_conclusion || '', [
        Validators.required,
      ]),
    });
  }

  protected closeModal() {
    this.modalFormSrv.closeModal();
    this.resetForm();
    this.isEditMode = false;
    this.formSubmitted = false;
  }

  public resetForm(): void {
    this.formConclusion.reset({
      areco_codigo: null,
      areco_conclusion: '',
    });

    this.formSubmitted = false;
  }
}
