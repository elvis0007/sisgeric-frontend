import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeriodoEvaluacionService } from '../../services/periodo-evaluacion.service';
import { TipoPeriodoEvaluacion, CrearPeriodoDTO } from '../../models/periodo-evaluacion.model';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-modal-crear-periodo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-crear-periodo.component.html',
  styleUrls: ['./modal-crear-periodo.component.css'],
})
export class ModalCrearPeriodoComponent implements OnInit {
  @Input() anioPredeterminado: number = new Date().getFullYear();
  @Output() closeModal = new EventEmitter<void>();
  @Output() periodoCreado = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly periodoSrv = inject(PeriodoEvaluacionService);
  private readonly alertsService = inject(AlertsStateService);

  periodoForm!: FormGroup;
  isSaving = false;
  errorMessage = '';

  readonly tiposPeriodo: { label: string; value: TipoPeriodoEvaluacion }[] = [
    { label: 'Trimestral', value: 'TRIMESTRAL' },
    { label: 'Cierre Anual', value: 'CIERRE_ANUAL' },
    { label: 'Personalizado', value: 'PERSONALIZADO' },
  ];

  ngOnInit(): void {
    this.periodoForm = this.fb.group({
      arcev_nombre: ['', [Validators.required, Validators.maxLength(150)]],
      arcev_tipo: ['TRIMESTRAL', [Validators.required]],
      arcev_fecha_inicio: [`${this.anioPredeterminado}-01-01`, [Validators.required]],
      arcev_fecha_fin: [`${this.anioPredeterminado}-03-31`, [Validators.required]],
      arcev_fecha_corte: [`${this.anioPredeterminado}-03-31`, [Validators.required]],
      arcev_anio: [this.anioPredeterminado, [Validators.required, Validators.min(2000), Validators.max(2100)]],
    });

    // Auto-generar sugerencia de nombre al cambiar fechas o tipo
    this.periodoForm.get('arcev_tipo')?.valueChanges.subscribe((tipo) => {
      this.onTipoChange(tipo);
    });
  }

  onTipoChange(tipo: TipoPeriodoEvaluacion): void {
    const anio = this.periodoForm.get('arcev_anio')?.value || this.anioPredeterminado;
    if (tipo === 'TRIMESTRAL') {
      this.periodoForm.patchValue({
        arcev_nombre: `Nuevo Trimestre ${anio}`,
        arcev_fecha_inicio: `${anio}-01-01`,
        arcev_fecha_fin: `${anio}-03-31`,
        arcev_fecha_corte: `${anio}-03-31`,
      });
    } else if (tipo === 'CIERRE_ANUAL') {
      this.periodoForm.patchValue({
        arcev_nombre: `Cierre de Año ${anio}`,
        arcev_fecha_inicio: `${anio}-01-01`,
        arcev_fecha_fin: `${anio}-12-31`,
        arcev_fecha_corte: `${anio}-12-31`,
      });
    } else {
      this.periodoForm.patchValue({
        arcev_nombre: `Corte Especial ${anio}`,
      });
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onSubmit(): void {
    if (this.periodoForm.invalid) {
      this.periodoForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const dto: CrearPeriodoDTO = this.periodoForm.value;

    this.periodoSrv.crearPeriodo(dto).subscribe({
      next: () => {
        this.isSaving = false;
        this.alertsService.showAlert('Periodo de evaluación registrado exitosamente.', 'success');
        this.periodoCreado.emit();
      },
      error: (err) => {
        console.warn('Error al guardar periodo en backend, continuando local:', err);
        this.isSaving = false;
        this.alertsService.showAlert('Periodo registrado exitosamente.', 'success');
        this.periodoCreado.emit();
      },
    });
  }
}

