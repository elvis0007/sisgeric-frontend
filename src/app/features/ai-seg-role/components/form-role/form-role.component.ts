import { Component, inject, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RoleService } from '@features/ai-seg-role/services/role.service';
import { ResponseWrite } from '@shared/models/response-write';
import { ModalService } from '@features/ai-seg-role/services/modal.service';
import { CommonModule } from '@angular/common';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-form-role',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './form-role.component.html',
  styleUrl: './form-role.component.css',
})
export class FormRoleComponent {
  @Input() formRole!: FormGroup;
  private readonly roleSrv = inject(RoleService);
  private readonly modalService: ModalService = inject(ModalService);
  private readonly alertsService = inject(AlertsStateService);
  protected isLoading: boolean = false;

  toSend() {
    if (this.formRole.valid) {
      this.isLoading = true;
      this.editRole();
    } else {
      // forzar que se marquen todos los controles como "tocados" para mostrar los errores
      this.formRole.markAllAsTouched();
    }
  }

  private editRole(): void {
    this.roleSrv
      .editRole({
        asero_codigo: this.formRole.get('asero_codigo')?.value,
        asero_descripcion: this.formRole.get('asero_descripcion')?.value,
      })
      .subscribe({
        next: (data: ResponseWrite) => {
          this.alertsService.showAlert(data.mensaje, 'success');
          this.modalService.closeModal();
          this.isLoading = false;
        },
        error: () => {
          this.alertsService.showAlert(
            'Se produjo un error al editar rol',
            'error'
          );
          this.isLoading = false;
        },
      });
  }

  protected closeModal(event: MouseEvent): void {
    event.stopPropagation(); // Esto evitará que el evento se propague
    this.modalService.closeModal();
  }
}
