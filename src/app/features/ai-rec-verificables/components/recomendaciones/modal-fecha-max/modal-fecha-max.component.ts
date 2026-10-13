import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import {
  DetalleRecomendacion,
  Recomendacion,
  RecomendacionFechaWrite,
} from '@features/ai-rec-verificables/models/Recomendacion';
import { ModalFormFechaMaxService } from '@features/ai-rec-verificables/services/recomendaciones/modal-form-fecha-max.service';
import { RecomendacionesVerificablesService } from '@features/ai-rec-verificables/services/recomendaciones/recomendaciones-verificables.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';

@Component({
  selector: 'app-modal-fecha-max',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AbsPipe],
  templateUrl: './modal-fecha-max.component.html',
  styleUrl: './modal-fecha-max.component.css',
})
export class ModalFechaMaxComponent {
  @Input() reloadTable!: () => void;
  private readonly alertsService = inject(AlertsStateService);

  protected modalFormSrv: ModalFormFechaMaxService = inject(
    ModalFormFechaMaxService
  );
  private readonly recomendacionSrv: RecomendacionesVerificablesService =
    inject(RecomendacionesVerificablesService);

  protected formVerificable!: FormGroup;
  protected data: any;
  protected isEditMode = false;
  protected formSubmitted = false;
  protected detalleRecomendacion: DetalleRecomendacion | null = null;
  protected isLoadingSubmint = false;
  protected isLoading = false;
  protected fechaMaximaActual: string = '';

  ngOnInit(): void {
    this.initForm();
  }

  constructor() {
    effect(() => {
      const modalData = this.modalFormSrv.modalData();
      const operationType = this.modalFormSrv.getOperationType();
      
      if (modalData) {
        if (modalData.detalleRecomendacion) {
          this.detalleRecomendacion = modalData.detalleRecomendacion;
        }
        const codRec = modalData.arere_codigo || modalData.detalleRecomendacion?.recomendaciones?.arere_codigo;
        if (codRec) {
          this.getDetalleRecomendacion(codRec);
        }
        this.isEditMode = operationType === 'edit';
        this.data = modalData;
        const initialDate = (modalData as any)?.aredr_fecha_maxima
          || (modalData as any)?.arere_fecha_maxima 
          || '';
        this.fechaMaximaActual = this.formatDateForInput(initialDate);
        this.initForm(); // Reinitialize the form with the new data
      }
    });
  }

  getEstadoPlazo(): string {
    const plazo = this.detalleRecomendacion?.recomendaciones?.plazo ?? 0;
    return plazo < 0 ? 'días vencidos' : 'días vigentes';
  }

  protected isEstadoCumplida(): boolean {
    return this.detalleRecomendacion?.recomendaciones?.estado_seguimiento?.arees_codigo === 2;
  }

  protected getMinDate(): string {
    return this.fechaMaximaActual || '';
  }

  protected getFechaActualFormateada(): string {
    if (!this.fechaMaximaActual) return '';
    const parts = this.fechaMaximaActual.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return this.fechaMaximaActual;
  }

  protected isFechaMenorOActual(): boolean {
    const nuevaFecha = this.formVerificable.get('arere_fecha_maxima')?.value;
    if (!nuevaFecha || !this.fechaMaximaActual) return false;
    return nuevaFecha < this.fechaMaximaActual;
  }

  protected toSend() {
    this.formSubmitted = true;

    if (this.formVerificable.invalid) {
      this.markFormGroupTouched(this.formVerificable);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }

    if (this.isFechaMenorOActual()) {
      this.alertsService.showAlert(
        `La fecha no puede ser anterior a la fecha máxima actual (${this.getFechaActualFormateada()}). Debe ser posterior.`,
        'error'
      );
      return;
    }

    const codigo = this.formVerificable.get('arere_codigo')?.value;
    codigo ? this.editFechaMax() : '';
  }

  private editFechaMax(): void {
    this.isLoadingSubmint = true;
    const recomendacionData: RecomendacionFechaWrite = {
      arere_codigo: this.formVerificable.get('arere_codigo')?.value,
      arere_fecha_maxima: this.formVerificable.get('arere_fecha_maxima')?.value,
      aredr_codigo: (this.data as any)?.aredr_codigo || this.detalleRecomendacion?.aredr_codigo,
      arers_codigo: (this.data as any)?.arers_codigo,
    };

    this.recomendacionSrv
      .updateFechaMaxRec(recomendacionData.arere_codigo, recomendacionData)
      .subscribe({
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

  private initForm() {
    const rawDate = this.data?.arere_fecha_maxima || '';
    this.formVerificable = new FormGroup({
      arere_codigo: new FormControl(this.data?.arere_codigo || null),
      arere_fecha_maxima: new FormControl(this.formatDateForInput(rawDate)),
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
    const field = this.formVerificable.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  public resetForm(): void {
    this.formVerificable.reset({
      arere_codigo: null,
      arere_fecha_maxima: '',
    });

    this.formSubmitted = false;
    this.fechaMaximaActual = '';
  }

  protected closeModal(event: MouseEvent): void {
    event.preventDefault();
    this.modalFormSrv.closeModal();
    this.resetForm();
    this.isEditMode = false;
    this.formSubmitted = false;
  }

  private getDetalleRecomendacion(arere_codigo: any) {    
    if (!arere_codigo) return;
    this.isLoading = true;
    this.recomendacionSrv.getDetalleRecomendacion(arere_codigo).subscribe({
      next: (response) => {
        if (response?.datos) {
          this.detalleRecomendacion = response.datos;
        }
        const currentFecha = (this.data as any)?.aredr_fecha_maxima
          || (this.data as any)?.arere_fecha_maxima 
          || this.detalleRecomendacion?.recomendaciones?.arere_fecha_maxima;
        if (currentFecha) {
          const formattedDate = this.formatDateForInput(currentFecha);
          this.fechaMaximaActual = formattedDate;
          this.formVerificable?.patchValue({ arere_fecha_maxima: formattedDate });
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      },
    });
  }

  protected formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const clean = dateStr.split(' ')[0].split('T')[0].trim();
      if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length === 3) {
          // DD/MM/YYYY -> YYYY-MM-DD
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return clean;
    } catch (e) {
      return dateStr;
    }
  }
}
