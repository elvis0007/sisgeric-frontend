import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PeriodoEvaluacionService } from '../../services/periodo-evaluacion.service';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion.model';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { ModalCrearPeriodoComponent } from '../../components/modal-crear-periodo/modal-crear-periodo.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';

@Component({
  selector: 'app-view-periodos-evaluacion',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    BreadcrumbsComponent,
    ModalCrearPeriodoComponent,
  ],
  templateUrl: './view-periodos-evaluacion.component.html',
  styleUrls: ['./view-periodos-evaluacion.component.css'],
})
export class ViewPeriodosEvaluacionComponent implements OnInit {
  private readonly periodoSrv = inject(PeriodoEvaluacionService);
  private readonly router = inject(Router);
  private readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmSrv = inject(ModalConfirmationService);

  periodos: PeriodoEvaluacion[] = [];
  filteredPeriodos: PeriodoEvaluacion[] = [];
  isLoading = false;
  selectedAnio: number = new Date().getFullYear();
  searchTerm: string = '';
  isModalOpen = false;
  rutaHijaActiva = false;

  aniosDisponibles: number[] = [];

  ngOnInit(): void {
    this.generarAniosDisponibles();
    this.cargarPeriodos();
  }

  generarAniosDisponibles(): void {
    const anioActual = new Date().getFullYear();
    const anios: number[] = [];
    for (let y = anioActual + 1; y >= 2020; y--) {
      anios.push(y);
    }
    this.aniosDisponibles = anios;
  }

  cargarPeriodos(): void {
    this.isLoading = true;
    this.periodoSrv.getPeriodos(this.selectedAnio).subscribe({
      next: (res) => {
        this.periodos = res.datos || [];
        this.filtrarPeriodos();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar periodos:', err);
        this.periodos = [];
        this.filtrarPeriodos();
        this.isLoading = false;
      },
    });
  }

  filtrarPeriodos(): void {
    if (!this.searchTerm.trim()) {
      this.filteredPeriodos = [...this.periodos];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredPeriodos = this.periodos.filter(
      (p) =>
        p.arcev_nombre.toLowerCase().includes(term) ||
        p.arcev_tipo.toLowerCase().includes(term)
    );
  }

  onAnioChange(anio: number): void {
    this.selectedAnio = anio;
    this.cargarPeriodos();
  }

  openModalCrear(): void {
    this.isModalOpen = true;
  }

  closeModalCrear(): void {
    this.isModalOpen = false;
  }

  onPeriodoCreado(): void {
    this.closeModalCrear();
    this.cargarPeriodos();
  }

  verDetalleInformes(periodo: PeriodoEvaluacion): void {
    this.router.navigate(['/inicio/periodos-evaluacion', periodo.arcev_codigo]);
  }

  getBadgeColor(tipo: string): string {
    return 'badge-primary text-white';
  }

  enActivacionRutaHija(): void {
    this.rutaHijaActiva = true;
  }

  enDesactivacionRutaHija(): void {
    this.rutaHijaActiva = false;
    this.cargarPeriodos();
  }

  getTotalInformesAcumulados(): number {
    return this.filteredPeriodos.reduce((acc, p) => acc + (p.total_informes || 0), 0);
  }

  getTotalRecomendacionesAcumuladas(): number {
    return this.filteredPeriodos.reduce((acc, p) => acc + (p.total_recomendaciones || 0), 0);
  }

  eliminarPeriodo(periodo: PeriodoEvaluacion, event: Event): void {
    event.stopPropagation();
    const actionId = this.modalConfirmSrv.show({
      title: 'Confirmación',
      message: `¿Está seguro de que desea eliminar el periodo "${periodo.arcev_nombre}"? Esta acción borrará todas sus asociaciones.`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'primary',
      cancelButtonType: 'error',
    });

    const sub = this.modalConfirmSrv.onConfirmFor(actionId).subscribe(() => {
      sub.unsubscribe();
      this.alertsService.showAlert('Eliminando periodo de evaluación...', 'info');
      this.periodoSrv.eliminarPeriodo(periodo.arcev_codigo).subscribe({
        next: () => {
          this.alertsService.showAlert('Periodo de evaluación eliminado correctamente.', 'success');
          this.cargarPeriodos();
        },
        error: (err) => {
          console.error('Error al eliminar periodo:', err);
          this.alertsService.showAlert('Error al eliminar el periodo de evaluación.', 'error');
        }
      });
    });
  }
}

