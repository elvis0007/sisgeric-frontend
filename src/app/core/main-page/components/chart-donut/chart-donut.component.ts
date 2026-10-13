import { Component, ElementRef, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ChartDonut } from '@core/main-page/models/dashboards';
import { DashboardsService } from '@core/services/dashboards.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Chart, ChartConfiguration, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

Chart.register(ChartDataLabels);
Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

@Component({
  selector: 'app-chart-donut',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chart-donut.component.html',
  styleUrl: './chart-donut.component.css'
})
export class ChartDonutComponent implements OnInit, OnDestroy {
  @ViewChild('donutChart') private chartRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private themeObserver?: MutationObserver;
  private readonly router = inject(Router);
  protected readonly dashboardSrv: DashboardsService = inject(DashboardsService);
  protected readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  protected chartDonut?: ChartDonut;
  protected dptoSeleccionado: string = '';
  protected isLoading: boolean = false;
  protected mostrarPorcentajes: boolean = false;
  protected totalRecomendaciones: number = 0;
  
  // Roles
  protected readonly ROL_AUDITOR_JEFE = 2;
  protected readonly ROL_AUDITOR_OPERATIVO = 3;
  protected readonly ROL_DIRECTOR = 5;

  ngOnInit(): void {
    this.getChartDonut();
    this.setupThemeObserver();
  }

  private setupThemeObserver(): void {
    if (typeof window !== 'undefined') {
      this.themeObserver = new MutationObserver(() => {
        this.inicializarGrafico();
      });
      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
    }
  }

  ngOnDestroy(): void {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }
  
  private getChartDonut(): void {
    this.isLoading = true;
    const userInfo = this.auxiliarySrv.getUserInfo();
    console.log('[DASHBOARD S1] Ruta actual:', this.router.url);
    console.log('[DASHBOARD S1] Usuario actual:', userInfo);
    console.log('[DASHBOARD S1] Roles detectados:', userInfo?.roles);

    const isJefe = this.auxiliarySrv.hasRole([this.ROL_AUDITOR_JEFE]);
    const isOperativo = this.auxiliarySrv.hasRole([this.ROL_AUDITOR_OPERATIVO]);

    if (isJefe && isOperativo) {
      // Caso especial: tiene ambos roles.
      // El gráfico de dona (departamentos) debe ser global (Jefe).
      // Las tarjetas de métricas (pendientes y último mes) deben ser personales (Operativo).
      const aiUser = this.auxiliarySrv.getUserCuenta();
      console.log('[DASHBOARD S1] Rama elegida: AMBOS ROLES -> Global (Dona) + Operativo (Tarjetas)');

      forkJoin({
        jefe: this.dashboardSrv.getChartDonutAiJefe(),
        operativo: this.dashboardSrv.getChartDonutAiOper(aiUser)
      }).subscribe({
        next: (responses) => {
          if (responses.jefe && responses.jefe.datos && responses.jefe.datos.departamentos !== null) {
            this.chartDonut = responses.jefe.datos;
            if (responses.operativo && responses.operativo.datos) {
              this.chartDonut.cantRecIngreUltimoMes = responses.operativo.datos.cantRecIngreUltimoMes;
              this.chartDonut.cantRecPendientesAprobacion = responses.operativo.datos.cantRecPendientesAprobacion;
            }
            this.inicializarGrafico();
          }
          this.isLoading = false;
        },
        error: (err) => {
          console.error('[DASHBOARD S1] Error cargando datos combinados:', err);
          this.isLoading = false;
        }
      });
    } else if (isOperativo) {
      // Usuario es solo Auditor Operativo
      const aiUser = this.auxiliarySrv.getUserCuenta();
      console.log('[DASHBOARD S1] Rama elegida: AI OPERATIVO -> /dashboards/ai-operativo/dashboard-data-s1/', aiUser);
      this.dashboardSrv.getChartDonutAiOper(aiUser).subscribe((response) => {
        console.log('[DASHBOARD S1] Respuesta AI OPERATIVO:', response);
        if (response && response.datos.departamentos !== null) {
          this.chartDonut = response.datos;
          this.inicializarGrafico();
          this.isLoading = false;
        } else {
          this.isLoading = false;
        }
      });
    } else if (isJefe) {
      // Usuario es Auditor Jefe
      console.log('[DASHBOARD S1] Rama elegida: AI JEFE -> /dashboards/ai-jefe/dashboard-data-s1');
      this.dashboardSrv.getChartDonutAiJefe().subscribe((response) => {
        console.log('[DASHBOARD S1] Respuesta AI JEFE:', response);
        if (response && response.datos.departamentos !== null) {
          this.chartDonut = response.datos;
          this.inicializarGrafico();
          this.isLoading = false;
        } else {
          this.isLoading = false;
        }
      });
    } else if (this.auxiliarySrv.hasRole([this.ROL_DIRECTOR])) {
      // Usuario es Director
      const dptoDirector = this.auxiliarySrv.getUserInfo().departamento;
      console.log('[DASHBOARD S1] Rama elegida: DIRECTOR -> /dashboards/d-departamental/dashboard-data-s1/', dptoDirector);
      this.dashboardSrv.getChartDonutDirector(dptoDirector).subscribe((response) => {
        console.log('[DASHBOARD S1] Respuesta DIRECTOR:', response);
        if (response && response.datos.departamentos !== null) {
          this.chartDonut = response.datos;
          this.inicializarGrafico();
          this.isLoading = false;
        } else {
          this.isLoading = false;
        }
      });
    }
  }
  
  private inicializarGrafico(): void {
    if (!this.chartRef || !this.chartDonut) return;
    
    const ctx = this.chartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Si existe un gráfico anterior, lo destruimos
    if (this.chart) {
      this.chart.destroy();
    }
    
    // Datos iniciales (total de todos los departamentos)
    let enProceso = 0;
    let cumplidas = 0;
    let noCumplidas = 0;
    let noAplica = 0;
    let totalRec = 0;
    
    if (this.dptoSeleccionado) {
      // Filtrar por departamento seleccionado
      const deptoSeleccionado = this.chartDonut.departamentos.find(
        d => d.departamento === this.dptoSeleccionado
      );
      
      if (deptoSeleccionado) {
        enProceso = deptoSeleccionado.enProceso;
        cumplidas = deptoSeleccionado.cumplidas;
        noCumplidas = deptoSeleccionado.noCumplidas;
        noAplica = deptoSeleccionado.noAplica;
        totalRec = deptoSeleccionado.totalRecomendaciones;
      }
    } else if (this.chartDonut.totalesGlobales) {
      // Usar los totales generales calculados por la base de datos (evita doble conteo)
      enProceso = this.chartDonut.totalesGlobales.enProceso;
      cumplidas = this.chartDonut.totalesGlobales.cumplidas;
      noCumplidas = this.chartDonut.totalesGlobales.noCumplidas;
      noAplica = this.chartDonut.totalesGlobales.noAplica;
      totalRec = this.chartDonut.totalesGlobales.totalRecomendaciones;
    } else if (this.chartDonut.general) {
      // Usar los totales generales calculados por la base de datos (evita doble conteo)
      enProceso = this.chartDonut.general.enProceso;
      cumplidas = this.chartDonut.general.cumplidas;
      noCumplidas = this.chartDonut.general.noCumplidas;
      noAplica = this.chartDonut.general.noAplica;
      totalRec = enProceso + cumplidas + noCumplidas + noAplica;
    } else {
      // Fallback: Sumar todos los departamentos
      this.chartDonut.departamentos.forEach(depto => {
        enProceso += depto.enProceso;
        cumplidas += depto.cumplidas;
        noCumplidas += depto.noCumplidas;
        noAplica += depto.noAplica;
      });
      totalRec = enProceso + cumplidas + noCumplidas + noAplica;
    }

    this.totalRecomendaciones = totalRec;
    
    // Obtener el tema actual
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Color del texto según el tema
    const textColor = isDarkTheme ? '#ffffff' : '#000000';
    
    // Crear gradientes para los colores del gráfico
    const gradEnProceso = ctx.createLinearGradient(0, 0, 0, 300);
    gradEnProceso.addColorStop(0, 'rgba(96, 165, 250, 0.95)');  // Azul claro
    gradEnProceso.addColorStop(1, 'rgba(37, 99, 235, 0.95)');   // Azul oscuro
 
    const gradCumplidas = ctx.createLinearGradient(0, 0, 0, 300);
    gradCumplidas.addColorStop(0, 'rgba(88, 215, 168, 0.95)');  // Verde claro (#58D7A8)
    gradCumplidas.addColorStop(1, 'rgba(59, 191, 143, 0.95)');   // Verde oscuro
 
    const gradNoCumplidas = ctx.createLinearGradient(0, 0, 0, 300);
    gradNoCumplidas.addColorStop(0, 'rgba(248, 113, 113, 0.95)'); // Rojo claro
    gradNoCumplidas.addColorStop(1, 'rgba(220, 38, 38, 0.95)');   // Rojo oscuro
 
    const gradNoAplica = ctx.createLinearGradient(0, 0, 0, 300);
    gradNoAplica.addColorStop(0, 'rgba(251, 191, 36, 0.95)');   // Ámbar claro
    gradNoAplica.addColorStop(1, 'rgba(217, 119, 6, 0.95)');    // Ámbar oscuro
 
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['En proceso', 'Cumplidas', 'No cumplidas', 'No aplica'],
        datasets: [{
          data: [enProceso, cumplidas, noCumplidas, noAplica],
          backgroundColor: [gradEnProceso, gradCumplidas, gradNoCumplidas, gradNoAplica],
          borderWidth: 0, // Remueve bordes blancos para un diseño más limpio
          borderRadius: 4,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%', // Dona más gruesa para una visualización más clara y llamativa
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: textColor,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: window.innerWidth < 768 ? 8 : 12,
              padding: window.innerWidth < 768 ? 10 : 20,
              font: {
                size: window.innerWidth < 768 ? 10 : 12
              }
            }
          },
          datalabels: {
            display: this.mostrarPorcentajes,
            color: '#ffffff',
            font: {
              weight: 'bold',
              size: window.innerWidth < 768 ? 10 : 12
            },
            formatter: (value, context) => {
              const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
              const pct = total ? ((value as number / total) * 100).toFixed(2) : '0.00';
              return pct === '0.00' ? '' : `${pct}%`;
            },
            textShadowBlur: 2,
            textShadowColor: 'rgba(0, 0, 0, 0.5)'
          },
          tooltip: {
            backgroundColor: isDarkTheme ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            titleColor: isDarkTheme ? '#ffffff' : '#0f172a',
            bodyColor: isDarkTheme ? '#cbd5e1' : '#334155',
            borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 8,
            cornerRadius: 12,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw as number;
                const total = (context.dataset.data as number[]).reduce((acc, val) => acc + (val as number), 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
                return `  ${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    };
    
    this.chart = new Chart(ctx, config);
  }
  
  protected actualizarGrafico(): void {
    this.inicializarGrafico();
  }

  protected togglePorcentajes(): void {
    this.mostrarPorcentajes = !this.mostrarPorcentajes;
    this.inicializarGrafico();
  }

  protected hasRole(roles: number[]): boolean {
    return this.auxiliarySrv.hasRole(roles);
  }

  protected navigateToPendientesAprob(): void {
    if (this.hasRole([this.ROL_DIRECTOR])) {
      this.router.navigate(['/inicio/director-solicitudes'], { queryParams: { anio: 0 } });
    } else {
      this.router.navigate(['/inicio/auditor-solicitudes'], { queryParams: { anio: 0 } });
    }
  }

  protected navigateToUltimoMes(): void {
    if (this.hasRole([this.ROL_DIRECTOR])) {
      this.router.navigate(['/inicio/director-informes']);
    } else {
      this.router.navigate(['/inicio/recomendaciones']);
    }
  }
}
