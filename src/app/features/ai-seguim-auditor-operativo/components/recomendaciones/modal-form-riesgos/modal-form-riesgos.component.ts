import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, EventEmitter, inject, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, map, merge, take } from 'rxjs';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { Recomendacion } from '../../../models/recomendacion';
import { RecomendacionesService } from '../../../services/recomendaciones/recomendaciones.service';

@Component({
  selector: 'app-modal-form-riesgos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-form-riesgos.component.html',
})
export class ModalFormRiesgosComponent implements OnChanges {
  @Input({ required: true }) recomendacion!: Recomendacion;
  @Output() riesgoActualizado = new EventEmitter<Recomendacion>();
  @ViewChild('listaEvidencias') private listaEvidencias?: ElementRef<HTMLOListElement>;
  @ViewChild('modalEdicion') private modalEdicion?: ElementRef<HTMLDialogElement>;

  private readonly recomendacionesSrv = inject(RecomendacionesService);
  private readonly alertsSrv = inject(AlertsStateService);
  private readonly modalConfirmationSrv = inject(ModalConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  protected editando = false;
  protected guardando = false;
  protected campo: 'riesgo' | 'evidencia' | 'ambos' = 'ambos';
  private confirmando = false;
  protected riesgo = '';
  protected evidencias: { texto: string; id?: number | null }[] = [{ texto: '' }];

  protected get evidencia(): string {
    return this.evidencias.filter(item => item.texto.trim())
      .map((item, index) => `${index + 1}. ${item.texto.trim()}`).join('\n');
  }

  private cargarEvidencias(texto: string): void {
    if (this.recomendacion.arere_evidencias_requeridas?.length) {
      this.evidencias = this.recomendacion.arere_evidencias_requeridas.map(e => ({ texto: e.arer_descripcion, id: e.arer_codigo }));
      return;
    }
    const contenido = texto.trim();
    const elementos = /^1[.)]\s+/.test(contenido)
      ? contenido.split(/(?:\r?\n)+(?=\d+[.)]\s+)/).map(item => item.replace(/^\d+[.)]\s+/, ''))
      : [contenido];
    this.evidencias = elementos.map(texto => ({ texto }));
  }

  protected agregarEvidencia(): void {
    if (this.guardando) return;
    this.evidencias.push({ texto: '' });
    setTimeout(() => {
      const lista = this.listaEvidencias?.nativeElement;
      lista?.querySelector<HTMLInputElement>('li:last-child input')?.focus({ preventScroll: true });
      if (lista) lista.scrollTop = lista.scrollHeight;
    });
  }

  protected quitarEvidencia(index: number): void {
    if (!this.guardando && this.evidencias.length > 1) this.evidencias.splice(index, 1);
  }
  protected errorMessage = '';

  ngOnChanges(): void {
    this.modalEdicion?.nativeElement.close();
    this.editando = false;
    this.errorMessage = '';
  }

  protected get cumplida(): boolean {
    return this.recomendacion.estado_seguimiento?.arees_descripcion === 'CUMPLIDA';
  }

  private get puedeEditar(): boolean {
    return !this.cumplida ||
      (this.campo === 'evidencia' && !this.recomendacion.arere_evidencia_requerida?.trim());
  }

  editar(campo: 'riesgo' | 'evidencia' | 'ambos' = 'ambos'): void {
    if (this.guardando || this.confirmando) return;
    this.campo = campo;
    if (!this.puedeEditar) return;
    this.riesgo = this.recomendacion.arere_riesgo_verificado || '';
    this.cargarEvidencias(this.recomendacion.arere_evidencia_requerida || '');
    this.errorMessage = '';
    this.editando = true;
    this.modalEdicion?.nativeElement.showModal();
  }

  protected cancelar(): void {
    if (this.guardando) return;
    this.modalEdicion?.nativeElement.close();
    this.editando = false;
    this.errorMessage = '';
  }

  protected guardar(): void {
    if (this.guardando || this.confirmando || !this.editando || !this.puedeEditar) return;
    const evidencia = this.campo === 'riesgo' ? null : this.evidencia.trim();
    const riesgo = this.campo === 'evidencia' ? null : this.riesgo;
    if (riesgo !== null && !['ALTO', 'MODERADO', 'BAJO'].includes(riesgo)) {
      this.errorMessage = 'Seleccione el nivel de riesgo.';
      return;
    }
    if (evidencia !== null && (!evidencia || this.evidencias.some(item => !item.texto.trim() || item.texto.trim().length > 500) || evidencia.length > 2000)) {
      this.errorMessage = 'Cada evidencia admite hasta 500 caracteres; el total admite 2000. Ingrese la evidencia requerida (máximo 2000 caracteres).';
      return;
    }
    this.errorMessage = '';
    const recomendacion = this.recomendacion;
    this.confirmando = true;
    const actionId = this.modalConfirmationSrv.show({
      title: 'Confirmar cambios',
      message: this.campo === 'riesgo' ? '¿Desea guardar el nuevo nivel de riesgo de esta recomendación?'
        : this.campo === 'evidencia' ? '¿Desea guardar los cambios de la evidencia requerida?'
        : '¿Desea guardar los cambios del riesgo y la evidencia requerida de esta recomendación?',
      confirmText: 'Guardar cambios',
      cancelText: 'Cancelar',
      confirmButtonType: 'primary',
      cancelButtonType: 'error',
    });
    merge(
      this.modalConfirmationSrv.onConfirmFor(actionId).pipe(map(() => true)),
      this.modalConfirmationSrv.onCancelFor(actionId).pipe(map(() => false))
    ).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.confirmando = false)
    ).subscribe((confirmado) => {
      if (confirmado && this.editando && this.recomendacion === recomendacion && this.puedeEditar) {
        this.guardarConfirmado(recomendacion, riesgo, evidencia);
      }
    });
  }

  private guardarConfirmado(recomendacion: Recomendacion, riesgo: string | null, evidencia: string | null): void {
    if (this.guardando) return;
    this.guardando = true;
    this.errorMessage = '';
    this.recomendacionesSrv.actualizarRiesgo(recomendacion.arere_codigo, riesgo, evidencia, evidencia === null ? undefined : this.evidencias.map(e => ({ arer_codigo: e.id, arer_descripcion: e.texto.trim() }))).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.guardando = false)
    ).subscribe({
      next: (response) => {
        this.modalEdicion?.nativeElement.close();
        this.editando = false;
        this.riesgoActualizado.emit({
          ...recomendacion,
          arere_riesgo_verificado: riesgo ?? recomendacion.arere_riesgo_verificado,
          arere_evidencia_requerida: evidencia ?? recomendacion.arere_evidencia_requerida,
          arere_evidencias_requeridas: evidencia === null ? recomendacion.arere_evidencias_requeridas : this.evidencias.map(e => ({ arer_codigo: e.id, arer_descripcion: e.texto.trim() })),
        });
        this.alertsSrv.showAlert(response.mensaje, 'success');
      },
      error: (error) => {
        this.errorMessage = error?.message || 'No se pudo guardar el riesgo y la evidencia requerida.';
      },
    });
  }
}
