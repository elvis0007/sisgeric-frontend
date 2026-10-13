import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MetricasResponsable } from '@core/main-page/models/dashboards';
import { DashboardsService } from '@core/services/dashboards.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { NavegacionStateService } from '@features/ai-verificables-respon/services/navegacion-state.service';

@Component({
  selector: 'app-metricas-responsable',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metricas-responsable.component.html',
  styleUrl: './metricas-responsable.component.css'
})
export class MetricasResponsableComponent implements OnInit {
  protected readonly dashboardsSrv: DashboardsService = inject(DashboardsService);
  protected readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly router = inject(Router);
  private readonly navegacionStateSrv = inject(NavegacionStateService);
  protected metricasResponsable?: MetricasResponsable;
  protected isLoading = false;

  ngOnInit(): void {
    this.getMetricasResponsable();
  } 

  private getMetricasResponsable(): void {
    this.isLoading = true;
    this.dashboardsSrv.getMetricasResponsable(this.auxiliarySrv.getUserCuenta()).subscribe({
      next: (response) => {
        if (response && response.datos) {
          this.metricasResponsable = response.datos;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al obtener las métricas del responsable', error);
        this.isLoading = false;
      }
    });
  }

  protected navigateToRecomendaciones(): void {
    // Establecer el estado antes de navegar (Recomendaciones Pendientes)
    this.navegacionStateSrv.setOnlyPendingJustify(true);
    this.navegacionStateSrv.setOnlyShowJustified(false);
    this.navegacionStateSrv.setSelectedState(1);
    this.router.navigate(['/inicio/evidencias-responsables']);
  }

  protected navigateToRecomendacionesTodas(): void {
    // Establecer el estado antes de navegar (Recomendaciones pendientes de cumplimiento otros)
    this.navegacionStateSrv.setOnlyPendingJustify(false);
    this.navegacionStateSrv.setOnlyShowJustified(false);
    this.navegacionStateSrv.setSelectedState(1);
    this.router.navigate(['/inicio/evidencias-responsables']);
  }

  protected navigateToRecomendacionesVencidasSinJustificar(): void {
    // Establecer el estado antes de navegar (Recomendaciones vencidas sin justificar)
    this.navegacionStateSrv.setOnlyPendingJustify(true);
    this.navegacionStateSrv.setOnlyShowJustified(false);
    this.navegacionStateSrv.setSelectedState(3);
    this.router.navigate(['/inicio/evidencias-responsables']);
  }

  protected navigateToRecomendacionesVencidasJustificadas(): void {
    // Establecer el estado antes de navegar (Recomendaciones vencidas justificadas)
    this.navegacionStateSrv.setOnlyPendingJustify(false);
    this.navegacionStateSrv.setOnlyShowJustified(true);
    this.navegacionStateSrv.setSelectedState(3);
    this.router.navigate(['/inicio/evidencias-responsables']);
  }

  protected navigateToSolicitudesEnEspera(): void {
    // Establecer el estado antes de navegar (Solicitudes en espera de aprobación)
    this.navegacionStateSrv.setOnlyPendingRequests(true);
    this.navegacionStateSrv.setOnlyPendingJustify(false);
    this.navegacionStateSrv.setOnlyShowJustified(false);
    this.navegacionStateSrv.setSelectedState(1); // Mapeado a las pendientes activas
    this.router.navigate(['/inicio/evidencias-responsables']);
  }
}
