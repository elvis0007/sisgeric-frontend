import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Recomendacion } from '../../../models/recomendacion';

@Component({
  selector: 'app-table-riesgos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-riesgos.component.html',
  styleUrl: './table-riesgos.component.css',
})
export class TableRiesgosComponent {
  @Input({ required: true }) recomendacion!: Recomendacion;
  @Output() editarRiesgo = new EventEmitter<'riesgo' | 'evidencia'>();

  protected get cumplida(): boolean {
    return this.recomendacion.estado_seguimiento?.arees_descripcion === 'CUMPLIDA';
  }

  protected editar(campo: 'riesgo' | 'evidencia'): void {
    if (this.puedeEditar(campo)) this.editarRiesgo.emit(campo);
  }

  protected puedeEditar(campo: 'riesgo' | 'evidencia'): boolean {
    if (campo === 'riesgo') return !this.cumplida;
    return !this.cumplida || !this.recomendacion.arere_evidencia_requerida?.trim();
  }

  protected get riesgoRegistrado(): string | null | undefined {
    return this.cumplida ? 'BAJO' : this.recomendacion.arere_riesgo_verificado;
  }
}
