import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { OrganismoControlWrite } from '@features/ai-seg-configuracion/models/Organismo-Control';
import { ModalService } from '@features/ai-seg-configuracion/services/organismo-control/modal.service';
import { OrganismoControlService } from '@features/ai-seg-configuracion/services/organismo-control/organismo-control.service';
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
  protected modalFormSrv: ModalService = inject(ModalService);
  protected readonly orgControlSrv: OrganismoControlService = inject(
    OrganismoControlService
  );
  protected readonly alertsService = inject(AlertsStateService);
  protected isLoadingSubmint = false;
  protected formOrganismo!: FormGroup;
  protected data!: OrganismoControlWrite;
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
    if (this.formOrganismo.invalid) {
      this.markFormGroupTouched(this.formOrganismo);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }
    const codigo = this.formOrganismo.get('ainoc_codigo')?.value;
    codigo ? this.editOrgControl() : this.registerOrgControl();
  }

  private editOrgControl(): void {
    this.isLoadingSubmint = true;
    const recomendacionData: OrganismoControlWrite = {
      ainoc_codigo: this.formOrganismo.get('ainoc_codigo')?.value,
      ainoc_descripcion: this.formOrganismo.get('ainoc_descripcion')?.value,
    };

    this.orgControlSrv.editOrganismo(recomendacionData).subscribe({
      next: () => {
        this.alertsService.showAlert(
          'Ente de Control actualizado correctamente',
          'success'
        );
        this.isLoadingSubmint = false;
        this.modalFormSrv.closeModal();
        this.resetForm();
        this.reloadTable();
      },
      error: () => {
        this.alertsService.showAlert(
          'Error al actualizar Ente de Control',
          'error'
        );
        this.isLoadingSubmint = false;
      },
    });
  }

  private registerOrgControl(): void {
    this.isLoadingSubmint = true;
    const orgControlData: OrganismoControlWrite = {
      ainoc_codigo: this.formOrganismo.get('ainoc_codigo')?.value,
      ainoc_descripcion: this.formOrganismo.get('ainoc_descripcion')?.value,
    };

    this.orgControlSrv.registerOrganismo(orgControlData).subscribe({
      next: () => {
        this.alertsService.showAlert(
          'Ente de control registrado correctamente',
          'success'
        );
        this.isLoadingSubmint = false;
        this.modalFormSrv.closeModal();
        this.resetForm();
        this.reloadTable();
      },
      error: () => {
        this.alertsService.showAlert(
          'Error al actualizar Ente de Control',
          'error'
        );
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
    this.formOrganismo = new FormGroup({
      ainoc_codigo: new FormControl(this.data?.ainoc_codigo || null),
      ainoc_descripcion: new FormControl(this.data?.ainoc_descripcion || '', [
        Validators.required,
      ]),
    });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formOrganismo.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  protected closeModal() {
    this.modalFormSrv.closeModal();
    this.resetForm();
    this.isEditMode = false;
    this.formSubmitted = false;
  }

  public resetForm(): void {
    this.formOrganismo.reset({
      ainoc_codigo: null,
      ainoc_descripcion: '',
    });
    this.formSubmitted = false;
  }
}
