import { Component, ElementRef, inject, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { ChartBarAnio } from '@core/main-page/models/dashboards';
import { DashboardsService } from '@core/services/dashboards.service';
import { Chart, registerables } from 'chart.js';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

Chart.register(...registerables);

@Component({
  selector: 'app-chart-bar-anio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-bar-anio.component.html',
  styleUrl: './chart-bar-anio.component.css',
})
export class ChartBarAnioComponent implements OnInit, OnDestroy {
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private themeObserver?: MutationObserver;
  protected readonly dashboardSrv: DashboardsService =
    inject(DashboardsService);
  protected readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly router: Router = inject(Router);
  protected chartBarAnio?: ChartBarAnio;
  protected mostrarEtiquetas: boolean = false;
  protected mostrarResumen: boolean = false;
  protected vistaResumen: 'overview' | 'estados' | 'anios' = 'overview';
  protected datosPorAnio: any[] = [];

  // Arrays para cada categoría
  protected labelsAnios: string[] = [];
  protected dataEnProceso: number[] = [];
  protected dataCumplidas: number[] = [];
  protected dataNoAplica: number[] = [];
  protected dataNoCumplidas: number[] = [];

  // Roles
  private readonly ROL_AUDITOR_JEFE = 2;
  private readonly ROL_AUDITOR_OPERATIVO = 3;
  private readonly ROL_DIRECTOR = 5;
  private readonly ROL_RESPONSABLE = 4;

  protected isLoading = false;

  ngOnInit(): void {
    this.getChartBarAnio();
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

  private getChartBarAnio(): void {
    // Si el usuario tiene el rol de Auditor Jefe, usamos ese independientemente de si tiene también el rol de Auditor Operativo
    this.isLoading = true;
    if (this.auxiliarySrv.hasRole([this.ROL_AUDITOR_JEFE])) {
      // Usuario es Auditor Jefe
      this.dashboardSrv.getChartBarsAiJefeAnios().subscribe((response) => {
        if (response && response.datos.anios !== null) {
          this.chartBarAnio = response.datos;
          this.parseData();
          this.inicializarGrafico();
          this.isLoading = false;
        } else {
          this.isLoading = false;
        }
      });
    } else if (this.auxiliarySrv.hasRole([this.ROL_AUDITOR_OPERATIVO])) {
      // Usuario es solo Auditor Operativo
      const aiUser = this.auxiliarySrv.getUserCuenta();
      this.dashboardSrv
        .getChartBarsAiOperAnios(aiUser)
        .subscribe((response) => {
          if (response && response.datos.anios !== null) {
            this.chartBarAnio = response.datos;
            this.parseData();
            this.inicializarGrafico();
            this.isLoading = false;
          } else {
            this.isLoading = false;
          }
        });
    } else if (this.auxiliarySrv.hasRole([this.ROL_DIRECTOR])) {
      // Usuario es Director
      const dptoDirector = this.auxiliarySrv.getUserInfo().departamento;
      this.dashboardSrv
        .getChartBarsDirectorAnios(dptoDirector)
        .subscribe((response) => {
          if (response && response.datos.anios !== null) {
            this.chartBarAnio = response.datos;
            this.parseData();
            this.inicializarGrafico();
            this.isLoading = false;
          } else {
            this.isLoading = false;
          }
        });
    } else if (this.auxiliarySrv.hasRole([this.ROL_RESPONSABLE])) {
      // Usuario es Responsable
      const userCuenta = this.auxiliarySrv.getUserCuenta();
      this.dashboardSrv
        .getChartBarsResponsableAnios(userCuenta)
        .subscribe((response) => {
          if (response && response.datos.anios !== null) {
            this.chartBarAnio = response.datos;
            this.parseData();
            this.inicializarGrafico();
            this.isLoading = false;
          } else {
            this.isLoading = false;
          }
        });
    }
  }

  /**
   * Recorre cada año y sus departamentos para sumar los valores de las categorías:
   * enProceso, cumplidas, noAplica y noCumplidas.
   */
  private parseData(): void {
    if (!this.chartBarAnio) {
      return;
    }

    // Reiniciamos los arreglos
    this.labelsAnios = [];
    this.dataEnProceso = [];
    this.dataCumplidas = [];
    this.dataNoAplica = [];
    this.dataNoCumplidas = [];

    // Ordenamos los años de forma descendente
    this.chartBarAnio.anios.sort((a, b) => b.anio.localeCompare(a.anio));

    this.chartBarAnio.anios.forEach((anioObj) => {
      this.labelsAnios.push(anioObj.anio);
      this.dataEnProceso.push(anioObj.detalles.enProceso);
      this.dataCumplidas.push(anioObj.detalles.cumplidas);
      this.dataNoAplica.push(anioObj.detalles.noAplica);
      this.dataNoCumplidas.push(anioObj.detalles.noCumplidas);
    });

    // Actualizar datos por año para la vista de resumen
    this.updateDatosPorAnio();
  }

  /**
   * Actualiza la propiedad datosPorAnio
   */
  private updateDatosPorAnio(): void {
    this.datosPorAnio = this.labelsAnios.map((anio, index) => ({
      anio,
      enProceso: this.dataEnProceso[index],
      cumplidas: this.dataCumplidas[index],
      noCumplidas: this.dataNoCumplidas[index],
      noAplica: this.dataNoAplica[index],
      total:
        this.dataEnProceso[index] +
        this.dataCumplidas[index] +
        this.dataNoCumplidas[index] +
        this.dataNoAplica[index],
    }));
  }

  /**
   * Navega a la página de recomendaciones con los filtros aplicados
   *
   * @param anio El año seleccionado
   * @param estado El código del estado (1: En proceso, 2: Cumplidas, 3: No cumplidas, 4: No aplica)
   */
  private navigateToRecomendaciones(anio: string, estado: number): void {
    this.router.navigate(['/inicio/recomendaciones'], {
      queryParams: {
        estado: estado.toString(),
        anio: anio,
        fromChart: 'true', // Indicador de que viene desde un gráfico
      },
    });
  }

  /**
   * Inicializa el gráfico de barras horizontales y apiladas utilizando Chart.js
   */
  private inicializarGrafico(): void {
    // Si ya existe un gráfico, se destruye para evitar duplicados
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.barChartRef.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    // Obtener el tema actual
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';

    // Color del texto según el tema
    const textColor = isDarkTheme ? '#ffffff' : '#000000';

    // Crear gradientes horizontales dinámicos adaptados al ancho del canvas
    const canvasWidth = ctx.canvas.width || 400;
    const gradEnProceso = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradEnProceso.addColorStop(0, 'rgba(96, 165, 250, 0.95)');  // Azul claro
    gradEnProceso.addColorStop(1, 'rgba(37, 99, 235, 0.95)');   // Azul oscuro

    const gradCumplidas = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradCumplidas.addColorStop(0, 'rgba(88, 215, 168, 0.95)');  // Verde claro (#58D7A8)
    gradCumplidas.addColorStop(1, 'rgba(59, 191, 143, 0.95)');   // Verde oscuro

    const gradNoCumplidas = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradNoCumplidas.addColorStop(0, 'rgba(248, 113, 113, 0.95)'); // Rojo claro
    gradNoCumplidas.addColorStop(1, 'rgba(220, 38, 38, 0.95)');   // Rojo oscuro

    const gradNoAplica = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradNoAplica.addColorStop(0, 'rgba(251, 191, 36, 0.95)');   // Ámbar claro
    gradNoAplica.addColorStop(1, 'rgba(217, 119, 6, 0.95)');    // Ámbar oscuro

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.labelsAnios,
        datasets: [
          {
            label: 'En proceso',
            data: this.dataEnProceso,
            backgroundColor: gradEnProceso,
            barPercentage: window.innerWidth < 768 ? 0.8 : 0.6,
            borderRadius: 4,
          },
          {
            label: 'Cumplidas',
            data: this.dataCumplidas,
            backgroundColor: gradCumplidas,
            barPercentage: window.innerWidth < 768 ? 0.8 : 0.6,
            borderRadius: 4,
          },
          {
            label: 'No cumplidas',
            data: this.dataNoCumplidas,
            backgroundColor: gradNoCumplidas,
            barPercentage: window.innerWidth < 768 ? 0.8 : 0.6,
            borderRadius: 4,
          },
          {
            label: 'No aplica',
            data: this.dataNoAplica,
            backgroundColor: gradNoAplica,
            barPercentage: window.innerWidth < 768 ? 0.8 : 0.6,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Barras horizontales
        scales: {
          x: {
            stacked: true,
            grid: {
              color: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            },
            border: {
              display: false
            },
            title: {
              display: true,
              text: 'Cantidad recomendaciones',
              color: textColor,
              font: {
                size: window.innerWidth < 768 ? 10 : 12, // Fuente más pequeña en móvil
              },
            },
            ticks: {
              stepSize: 10,
              color: textColor,
              font: {
                size: window.innerWidth < 768 ? 10 : 12, // Fuente más pequeña en móvil
              },
            },
          },
          y: {
            stacked: true,
            grid: {
              display: false,
            },
            border: {
              display: false
            },
            title: {
              display: true,
              text: 'Año',
              color: textColor,
              font: {
                size: window.innerWidth < 768 ? 10 : 12, // Fuente más pequeña en móvil
              },
            },
            ticks: {
              color: textColor,
              font: {
                size: window.innerWidth < 768 ? 10 : 12, // Fuente más pequeña en móvil
              },
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: textColor,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: window.innerWidth < 768 ? 8 : 12, // Tamaño más pequeño en móvil
              padding: window.innerWidth < 768 ? 10 : 20, // Padding más pequeño en móvil
              font: {
                size: window.innerWidth < 768 ? 10 : 12, // Fuente más pequeña en móvil
              },
            },
          },
          datalabels: {
            display: this.mostrarEtiquetas,
            color: '#ffffff',
            font: {
              weight: 'bold',
              size: window.innerWidth < 768 ? 9 : 11,
            },
            formatter: (value, context) => {
              return value === 0 ? '' : value.toString();
            },
            textShadowBlur: 2,
            textShadowColor: 'rgba(0, 0, 0, 0.5)',
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
            enabled: true,
          },
        },
        onClick: (event, elements) => {
          // Solo permitir la navegación si el usuario es auditor jefe o auditor operativo
          if (
            !this.auxiliarySrv.hasRole([
              this.ROL_AUDITOR_JEFE,
              this.ROL_AUDITOR_OPERATIVO,
            ])
          ) {
            return; // No hacer nada si el usuario no tiene los roles necesarios
          }

          if (elements && elements.length > 0) {
            const element = elements[0];
            const datasetIndex = element.datasetIndex;
            const index = element.index;

            // Obtener el año seleccionado
            const anioSeleccionado = this.labelsAnios[index];

            // Determinar el estado según el datasetIndex
            let estado = 0;
            switch (datasetIndex) {
              case 0:
                estado = 1;
                break; // En proceso
              case 1:
                estado = 2;
                break; // Cumplidas
              case 2:
                estado = 3;
                break; // No cumplidas
              case 3:
                estado = 4;
                break; // No aplica
            }

            // Navegar a la página de recomendaciones con los filtros
            this.navigateToRecomendaciones(anioSeleccionado, estado);
          }
        },
      },
    });
  }

  /**
   * Alterna la visibilidad de las etiquetas en el gráfico
   */
  protected toggleEtiquetas(): void {
    this.mostrarEtiquetas = !this.mostrarEtiquetas;
    this.inicializarGrafico();
  }

  /**
   * Alterna la visibilidad del resumen estadístico
   */
  protected toggleResumen(): void {
    this.mostrarResumen = !this.mostrarResumen;
  }

  /**
   * Cambia la vista del resumen
   */
  protected cambiarVistaResumen(vista: 'overview' | 'estados' | 'anios'): void {
    this.vistaResumen = vista;
  }

  /**
   * Calcula el total de recomendaciones por estado
   */
  protected getTotalPorEstado() {
    return {
      enProceso: this.dataEnProceso.reduce((acc, val) => acc + val, 0),
      cumplidas: this.dataCumplidas.reduce((acc, val) => acc + val, 0),
      noCumplidas: this.dataNoCumplidas.reduce((acc, val) => acc + val, 0),
      noAplica: this.dataNoAplica.reduce((acc, val) => acc + val, 0),
    };
  }

  /**
   * Calcula el total general de todas las recomendaciones
   */
  protected getTotalGeneral(): number {
    const totales = this.getTotalPorEstado();
    return (
      totales.enProceso +
      totales.cumplidas +
      totales.noCumplidas +
      totales.noAplica
    );
  }

  /**
   * Calcula el porcentaje de un estado específico
   */
  protected getPorcentaje(cantidad: number): number {
    const total = this.getTotalGeneral();
    return total > 0 ? Math.round((cantidad / total) * 100) : 0;
  }

  /**
   * Obtiene el año con más recomendaciones
   */
  protected getAnioConMasRecomendaciones(): { anio: string; total: number } {
    let maxTotal = 0;
    let anioMax = '';

    this.labelsAnios.forEach((anio, index) => {
      const total =
        this.dataEnProceso[index] +
        this.dataCumplidas[index] +
        this.dataNoCumplidas[index] +
        this.dataNoAplica[index];
      if (total > maxTotal) {
        maxTotal = total;
        anioMax = anio;
      }
    });

    return { anio: anioMax, total: maxTotal };
  }

  /**
   * Obtiene el porcentaje de cumplimiento por año
   */
  protected getPorcentajeCumplimientoPorAnio(anio: string): number {
    const index = this.labelsAnios.indexOf(anio);
    if (index === -1) return 0;

    const total =
      this.dataEnProceso[index] +
      this.dataCumplidas[index] +
      this.dataNoCumplidas[index] +
      this.dataNoAplica[index];
    return total > 0
      ? Math.round((this.dataCumplidas[index] / total) * 100)
      : 0;
  }
}
