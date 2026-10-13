import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardsService } from '@core/services/dashboards.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

export interface MetricasDirector {
  enProceso: number;
  noCumplidas: number;
  cumplidas: number;
  totalRecomendaciones: number;
}

@Component({
  selector: 'app-metricas-director',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metricas-director.component.html',
  styleUrl: './metricas-director.component.css'
})
export class MetricasDirectorComponent implements OnInit {
  protected readonly dashboardsSrv: DashboardsService = inject(DashboardsService);
  protected readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly router = inject(Router);

  protected metricasDirector?: MetricasDirector;
  protected isLoading = false;

  ngOnInit(): void {
    this.getMetricasDirector();
  }

  private getMetricasDirector(): void {
    this.isLoading = true;
    const dptoDirector = this.auxiliarySrv.getUserInfo()?.departamento;
    if (!dptoDirector) {
      this.isLoading = false;
      return;
    }

    this.dashboardsSrv.getChartDonutDirector(dptoDirector).subscribe({
      next: (response) => {
        if (response && response.datos) {
          const datos = response.datos;
          const totales = datos.totalesGlobales || datos.general;
          if (totales) {
            const enProceso = totales.enProceso || 0;
            const noCumplidas = totales.noCumplidas || 0;
            const cumplidas = totales.cumplidas || 0;
            const totalRec = datos.totalesGlobales?.totalRecomendaciones ?? (enProceso + noCumplidas + cumplidas);
            this.metricasDirector = {
              enProceso,
              noCumplidas,
              cumplidas,
              totalRecomendaciones: totalRec
            };
          } else if (datos.departamentos && datos.departamentos.length > 0) {
            let enProceso = 0;
            let noCumplidas = 0;
            let cumplidas = 0;
            let total = 0;
            datos.departamentos.forEach(d => {
              enProceso += d.enProceso || 0;
              noCumplidas += d.noCumplidas || 0;
              cumplidas += d.cumplidas || 0;
              total += d.totalRecomendaciones || 0;
            });
            this.metricasDirector = { enProceso, noCumplidas, cumplidas, totalRecomendaciones: total };
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al obtener las métricas del director departamental', error);
        this.isLoading = false;
      }
    });
  }

  protected navigateToPendientesDepartamento(): void {
    this.router.navigate(['/inicio/report-departamento-fechas-vencidas'], {
      queryParams: { estadoPlazo: 1 }
    });
  }

  protected navigateToVencidasDepartamento(): void {
    this.router.navigate(['/inicio/report-departamento-fechas-vencidas'], {
      queryParams: { estadoPlazo: 2 }
    });
  }
}
