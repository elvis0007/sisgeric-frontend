import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  Hallazgo,
  HallazgoEscritura,
} from '@features/ai-seguim-auditor-operativo/models/hallazgo';
import { HallazgosService } from '@features/ai-seguim-auditor-operativo/services/hallazgos/hallazgos.service';
import { ModalFormService } from '@features/ai-seguim-auditor-operativo/services/hallazgos/modal-form.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-modal-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-form.component.html',
  styleUrl: './modal-form.component.css',
})
export class ModalFormComponent implements OnInit {
  @Input() reloadTable!: () => void;
  private readonly alertsService = inject(AlertsStateService);
  protected modalFormSrv: ModalFormService = inject(ModalFormService);
  private readonly hallasgoSrv: HallazgosService = inject(HallazgosService);
  private readonly auxiliarSrv = inject(AuxiliaryService);

  protected isLoadingSubmint = false;
  protected formHallazgo!: FormGroup;
  protected data!: Hallazgo;
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

    if (this.formHallazgo.invalid) {
      this.markFormGroupTouched(this.formHallazgo);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }

    const codigo = this.formHallazgo.get('areha_codigo')?.value;
    codigo ? this.editHallazgo() : this.createHallazgo();
  }

  private createHallazgo(): void {
    if (this.formHallazgo.invalid) return;

    this.isLoadingSubmint = true;
    const hallazgoData: HallazgoEscritura = {
      areha_codigo: this.formHallazgo.get('areha_codigo')?.value,
      ainin_codigo: this.formHallazgo.get('ainin_codigo')?.value,
      areha_titulo: this.formHallazgo.get('areha_titulo')?.value,
    };

    console.log(hallazgoData);

    this.hallasgoSrv.createHallazgo(hallazgoData).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.isLoadingSubmint = false;
        this.modalFormSrv.closeModal();
        this.resetForm();
        this.reloadTable();
      },
      error: (err) => {
        this.isLoadingSubmint = false;
        this.alertsService.showAlert(err.message, 'error');
      },
    });
  }

  private editHallazgo(): void {
    this.isLoadingSubmint = true;
    const hallazgoData: HallazgoEscritura = {
      areha_codigo: this.formHallazgo.get('areha_codigo')?.value,
      areha_titulo: this.formHallazgo.get('areha_titulo')?.value,
      // ainin_codigo: this.formHallazgo.get('ainin_codigo')?.value,
    };

    this.hallasgoSrv.editHallazgo(hallazgoData).subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
        this.isLoadingSubmint = false;
        this.closeModal();
        this.reloadTable();
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
        this.isLoadingSubmint = false;
      },
    });
  }

  private initForm() {
    const idInf = this.auxiliarSrv.getUrlParameter('id_inf');
    this.formHallazgo = new FormGroup({
      areha_codigo: new FormControl(this.data?.areha_codigo || null),
      ainin_codigo: new FormControl(idInf ? +idInf : null),
      areha_titulo: new FormControl(this.data?.areha_titulo || '', [
        Validators.required
      ])
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
    const field = this.formHallazgo.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  public resetForm(): void {
    const idInf = this.auxiliarSrv.getUrlParameter('id_inf');
    this.formHallazgo.reset({
      areha_codigo: null,
      ainin_codigo: idInf ? +idInf : null,
      areha_titulo: '',
    });

    this.formSubmitted = false;
  }

  protected closeModal() {
    this.modalFormSrv.closeModal();
    this.resetForm();
    this.isEditMode = false;
    this.formSubmitted = false;
  }
}
