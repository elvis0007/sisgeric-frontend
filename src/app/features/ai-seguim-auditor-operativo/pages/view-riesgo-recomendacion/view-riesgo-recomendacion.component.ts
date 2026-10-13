import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { ConclusionRecomendaciones, Recomendacion } from '../../models/recomendacion';
import { RecomendacionesService } from '../../services/recomendaciones/recomendaciones.service';
import { TableRiesgosComponent } from '../../components/recomendaciones/table-riesgos/table-riesgos.component';
import { ModalFormRiesgosComponent } from '../../components/recomendaciones/modal-form-riesgos/modal-form-riesgos.component';

@Component({
  selector: 'app-view-riesgo-recomendacion',
  standalone: true,
  imports: [CommonModule, TableRiesgosComponent, ModalFormRiesgosComponent],
  templateUrl: './view-riesgo-recomendacion.component.html',
})
export class ViewRiesgoRecomendacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recomendacionesSrv = inject(RecomendacionesService);

  protected datos: ConclusionRecomendaciones | null = null;
  protected recomendacion: Recomendacion | null = null;
  protected fechaAprobacion: Date | null = null;
  protected isLoading = true;
  protected errorMessage = '';

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap((params) => {
        this.isLoading = true;
        this.errorMessage = '';
        this.datos = null;
        this.recomendacion = null;
        try {
          const conclusionId = Number(atob(this.route.parent?.snapshot.paramMap.get('id') || ''));
          const recomendacionId = Number(atob(params.get('idRec') || ''));
          if (!Number.isSafeInteger(conclusionId) || conclusionId <= 0 ||
            !Number.isSafeInteger(recomendacionId) || recomendacionId <= 0) {
            throw new Error('Identificador no valido');
          }

          return this.recomendacionesSrv.getRecomendaciones(conclusionId).pipe(
            tap((response) => {
              this.datos = response.datos;
              this.recomendacion = this.datos.recomendaciones.find(
                (item) => item.arere_codigo === recomendacionId
              ) || null;
              const fecha = this.datos.arere_fecha_inicio_control?.split(/[T ]/)[0];
              this.fechaAprobacion = fecha ? new Date(`${fecha}T00:00:00`) : null;
              if (!this.recomendacion) {
                this.errorMessage = 'La recomendación no está disponible en esta conclusión.';
              }
              this.isLoading = false;
            }),
            catchError(() => {
              this.errorMessage = 'No se pudo cargar el riesgo y la evidencia requerida.';
              this.isLoading = false;
              return EMPTY;
            })
          );
        } catch {
          this.errorMessage = 'La dirección de la recomendación no es válida.';
          this.isLoading = false;
          return EMPTY;
        }
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
}
