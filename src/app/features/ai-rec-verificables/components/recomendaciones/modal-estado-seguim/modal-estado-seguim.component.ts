import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import {
  DetalleRecomendacion,
  Recomendacion, 
  RecomendacionEstadoSeguimWrite
} from '@features/ai-rec-verificables/models/Recomendacion';

import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';
import { ModalEstadoSeguimService } from '@features/ai-rec-verificables/services/recomendaciones/modal-estado-seguim.service';
import { RecomendacionesVerificablesService } from '@features/ai-rec-verificables/services/recomendaciones/recomendaciones-verificables.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';

@Component({
  selector: 'app-modal-estado-seguim',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AbsPipe],
  templateUrl: './modal-estado-seguim.component.html',
  styleUrl: './modal-estado-seguim.component.css',
})
export class ModalEstadoSeguimComponent {
  @Input() reloadTable!: () => void;
  private readonly alertsService = inject(AlertsStateService);

  protected readonly modalEstadoSeguimSrv: ModalEstadoSeguimService = inject(
    ModalEstadoSeguimService
  );
  private readonly recomendacionSrv: RecomendacionesVerificablesService =
    inject(RecomendacionesVerificablesService);

  protected formEstadoSeguim!: FormGroup;
  protected formSubmitted = false;
  protected data!: Recomendacion;
  protected estadosSeguim: EstadoSeg[] = [];
  protected estadoSeguimientos: any = [];
  protected detalleRecomendacion: DetalleRecomendacion | null = null;
  protected isLoadingSubmint = false;
  protected isLoading = false;

  ngOnInit(): void {
    this.initForm();
  }

  constructor() {
    effect(() => {
      const modalData = this.modalEstadoSeguimSrv.modalData();
      this.getEstadosSeguim();
      if (modalData) {
        this.getDetalleRecomendacion(modalData.arere_codigo);
        this.data = modalData;
        this.initForm(); // Reinitialize the form with the new data
      }
    });
  }

  private getDetalleRecomendacion(arere_codigo: any) {
    this.isLoading = true;
    this.recomendacionSrv.getDetalleRecomendacion(arere_codigo).subscribe({
      next: (response) => {
        this.detalleRecomendacion = response.datos;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      },
    });
  }

  protected getEstadoPlazo(): string {
    const plazo = this.detalleRecomendacion?.recomendaciones?.plazo ?? 0;
    return plazo < 0 ? 'días vencidos' : 'días vigentes';
  }

  protected isEstadoCumplida(): boolean {
    return this.detalleRecomendacion?.recomendaciones?.estado_seguimiento?.arees_codigo === 2;
  }

  protected getEstadosSeguim() {
    this.recomendacionSrv.getEstadosSeguim().subscribe({
      next: (response) => {
        this.estadosSeguim = response.datos;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  protected toSend() {
    this.formSubmitted = true;

    if (this.formEstadoSeguim.invalid) {
      this.markFormGroupTouched(this.formEstadoSeguim);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }

    const codigo = this.formEstadoSeguim.get('arere_codigo')?.value;
    codigo ? this.editEstadoSeguim() : '';
  }

  private editEstadoSeguim(): void {
    this.isLoadingSubmint = true;
    const estadoSeguimData: RecomendacionEstadoSeguimWrite = {
      arere_codigo: this.formEstadoSeguim.get('arere_codigo')?.value,
      arees_codigo: this.formEstadoSeguim.get('arees_codigo')?.value,
      motivo_estado: this.formEstadoSeguim.get('motivo_estado')?.value
    }

    this.recomendacionSrv.updateEstadoSeguim(estadoSeguimData.arere_codigo, estadoSeguimData.arees_codigo, estadoSeguimData.motivo_estado)
    .subscribe({
      next: (response) => {
        this.alertsService.showAlert(response.mensaje, 'success');
          this.isLoadingSubmint = false;
          this.modalEstadoSeguimSrv.closeModal();
          this.resetForm();
          this.reloadTable();
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
        this.isLoadingSubmint = false;
      },
    })
  }

  private initForm() {

    this.formEstadoSeguim = new FormGroup({
      arere_codigo: new FormControl(this.data?.arere_codigo || null),
      motivo_estado: new FormControl(
        this.data?.motivo_estado || ''
      ),
      arees_codigo: new FormControl(
        this.data?.estado_seguimiento.arees_codigo || ''
      ),
    });
  }

  protected closeModal(event: MouseEvent): void {
    event.preventDefault();
    this.modalEstadoSeguimSrv.closeModal();
    this.resetForm();
    this.formSubmitted = false;
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formEstadoSeguim.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  public resetForm(): void {
    this.formEstadoSeguim.reset({
      arere_codigo: null,
      motivo_estado: '',
    });

    this.formSubmitted = false;
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
}
