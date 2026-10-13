import { Component, ElementRef, inject, ViewChild, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartBarDpto } from '@core/main-page/models/dashboards';
import { DashboardsService } from '@core/services/dashboards.service';
import { Chart, registerables } from 'chart.js';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Router } from '@angular/router';
import { AlertsStateService } from '@core/services/alerts-state.service';

Chart.register(...registerables);

@Component({
  selector: 'app-chart-bar-dpto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chart-bar-dpto.component.html',
  styleUrl: './chart-bar-dpto.component.css'
})
export class ChartBarDptoComponent implements OnInit, OnDestroy {
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly router: Router = inject(Router);
  private readonly alertsSrv: AlertsStateService = inject(AlertsStateService);
  private chart?: Chart;
  private themeObserver?: MutationObserver;
  protected readonly dashboardSrv: DashboardsService = inject(DashboardsService);
  protected chartBarDpto?: ChartBarDpto;
  protected mostrarEtiquetas: boolean = false;
  protected mostrarResumen: boolean = false;
  protected vistaResumen: 'overview' | 'estados' | 'departamentos' = 'overview';
  protected datosPorDepartamento: any[] = [];

  // Arrays para datos del gráfico
  protected labelsAnios: string[] = [];
  protected labelsDptos: string[] = [];
  protected labelsDptosAbreviados: string[] = []; // Nombres abreviados para mostrar en el gráfico
  protected selectedAnios: string[] = [];
  protected showDropdown: boolean = false;
  
  // Datos por departamento
  protected dataEnProceso: number[] = [];
  protected dataCumplidas: number[] = [];
  protected dataNoAplica: number[] = [];
  protected dataNoCumplidas: number[] = [];

  // Roles
  private readonly ROL_AUDITOR_JEFE = 2;
  private readonly ROL_AUDITOR_OPERATIVO = 3;
  protected isLoading = false;

  // Límite de años a mostrar
  private readonly MAX_YEARS = 7;

  // Cerrar el dropdown cuando se hace clic fuera de él
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Verificar si el clic fue fuera del dropdown y su botón
    if (!target.closest('.select-primary') && !target.closest('.absolute') && this.showDropdown) {
      this.showDropdown = false;
    }
  }

  ngOnInit(): void {
    this.getChartBarDpto();
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

  /**
   * Obtiene los datos para el gráfico
   */
  private getChartBarDpto(): void {
    // Si el usuario tiene el rol de Auditor Jefe, usamos ese independientemente de si tiene también el rol de Auditor Operativo
    this.isLoading = true;
    if (this.auxiliarySrv.hasRole([this.ROL_AUDITOR_JEFE])) {
      // Usuario es Auditor Jefe
      this.dashboardSrv.getChartBarsAiJefeDpto().subscribe((response) => {
        if (response && response.datos.anios !== null) {
          this.chartBarDpto = response.datos;
          this.extractYears();
          // Seleccionar todos los años por defecto
          this.selectedAnios = [...this.labelsAnios];
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
      this.dashboardSrv.getChartBarsAiOperDpto(aiUser).subscribe((response) => {
        if (response && response.datos.anios !== null) {
          this.chartBarDpto = response.datos;
          this.extractYears();
          // Seleccionar todos los años por defecto
          this.selectedAnios = [...this.labelsAnios];
          this.parseData();
          this.inicializarGrafico();
          this.isLoading = false;
        } else {
          this.isLoading = false;
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  /**
   * Extrae los años disponibles de los datos
   */
  private extractYears(): void {
    if (!this.chartBarDpto) return;
    
    // Obtener todos los años
    let allYears = this.chartBarDpto.anios.map(anioObj => anioObj.anio);
    
    // Ordenar años en orden descendente (más recientes primero)
    allYears.sort((a, b) => parseInt(b) - parseInt(a));
    
    // Tomar solo los últimos MAX_YEARS años (o menos si no hay suficientes)
    this.labelsAnios = allYears.slice(0, this.MAX_YEARS);
    
    // Inicialmente seleccionamos todos los años disponibles (los últimos MAX_YEARS años)
    this.selectedAnios = [...this.labelsAnios];
  }

  /**
   * Muestra u oculta el dropdown de años
   */
  protected toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  /**
   * Verifica si un año está seleccionado
   */
  protected isAnioSelected(anio: string): boolean {
    return this.selectedAnios.includes(anio);
  }

  /**
   * Devuelve el texto que se muestra en el botón del dropdown
   */
  protected getSelectionText(): string {
    if (this.selectedAnios.length === 0) {
      return 'Seleccione años';
    } 
    else if (this.selectedAnios.length === this.labelsAnios.length) {
      return 'Todos los años';
    } 
    else if (this.selectedAnios.length <= 2) {
      return this.selectedAnios.join(', ');
    } 
    else {
      return `${this.selectedAnios.length} años seleccionados`;
    }
  }

  /**
   * Maneja la selección/deselección de todos los años
   */
  protected toggleSelectAll(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedAnios = [...this.labelsAnios];
    } else {
      this.selectedAnios = [];
    }
    this.parseData();
    this.inicializarGrafico();
  }

  /**
   * Maneja la selección/deselección de un año específico
   */
  protected toggleAnioSelection(anio: string): void {
    if (this.selectedAnios.includes(anio)) {
      // Si ya está seleccionado, quitarlo
      this.selectedAnios = this.selectedAnios.filter(a => a !== anio);
    } else {
      // Si no está seleccionado, agregarlo
      this.selectedAnios.push(anio);
    }
    
    // Actualizar datos y gráfico con la nueva selección
    this.parseData();
    this.inicializarGrafico();
  }

  /**
   * Procesa los datos para mostrar por departamento
   */
  private parseData(): void {
    if (!this.chartBarDpto) return;
    
    // Reiniciamos los arreglos
    this.labelsDptos = [];
    this.labelsDptosAbreviados = [];
    this.dataEnProceso = [];
    this.dataCumplidas = [];
    this.dataNoAplica = [];
    this.dataNoCumplidas = [];

    // Si no hay años seleccionados, no mostramos datos
    if (this.selectedAnios.length === 0) {
      return;
    }

    // Extraer todos los departamentos únicos de los años seleccionados
    const allDepartamentos = new Set<string>();
    
    this.chartBarDpto.anios.forEach(anioObj => {
      // Si el año está entre los seleccionados
      if (this.selectedAnios.includes(anioObj.anio)) {
        Object.keys(anioObj.departamentos).forEach(dpto => {
          allDepartamentos.add(dpto);
        });
      }
    });

    // Crear los arreglos de departamentos y ordenarlos alfabéticamente
    this.labelsDptos = Array.from(allDepartamentos).sort();
    
    // Usar las abreviaturas del servicio
    this.labelsDptosAbreviados = this.labelsDptos.map(dpto => {
      // Buscar la abreviatura en cualquier año que contenga el departamento
      for (const anio of this.chartBarDpto?.anios || []) {
        const departamento = anio.departamentos[dpto];
        if (departamento?.departamentoAbrev) {
          return departamento.departamentoAbrev;
        }
      }
      return dpto; // Fallback al nombre completo si no se encuentra abreviatura
    });

    // Calcular la suma de valores para cada departamento en los años seleccionados
    this.labelsDptos.forEach(dpto => {
      let sumEnProceso = 0;
      let sumCumplidas = 0;
      let sumNoAplica = 0;
      let sumNoCumplidas = 0;

      this.chartBarDpto!.anios.forEach(anioObj => {
        // Si el año está entre los seleccionados
        if (this.selectedAnios.includes(anioObj.anio)) {
          if (anioObj.departamentos[dpto]) {
            sumEnProceso += anioObj.departamentos[dpto].enProceso;
            sumCumplidas += anioObj.departamentos[dpto].cumplidas;
            sumNoAplica += anioObj.departamentos[dpto].noAplica;
            sumNoCumplidas += anioObj.departamentos[dpto].noCumplidas;
          }
        }
      });

      this.dataEnProceso.push(sumEnProceso);
      this.dataCumplidas.push(sumCumplidas);
      this.dataNoAplica.push(sumNoAplica);
      this.dataNoCumplidas.push(sumNoCumplidas);
    });

    // Actualizar datos por departamento para la vista de resumen
    this.updateDatosPorDepartamento();
  }

  /**
   * Actualiza la propiedad datosPorDepartamento
   */
  private updateDatosPorDepartamento(): void {
    this.datosPorDepartamento = this.labelsDptos.map((dpto, index) => ({
      departamento: dpto,
      departamentoAbrev: this.labelsDptosAbreviados[index],
      enProceso: this.dataEnProceso[index],
      cumplidas: this.dataCumplidas[index],
      noCumplidas: this.dataNoCumplidas[index],
      noAplica: this.dataNoAplica[index],
      total: this.dataEnProceso[index] + this.dataCumplidas[index] + 
             this.dataNoCumplidas[index] + this.dataNoAplica[index]
    }));
  }

  /**
   * Navega a la página de recomendaciones con los filtros aplicados
   * 
   * @param departamento El departamento seleccionado
   * @param estado El código del estado (1: En proceso, 2: Cumplidas, 3: No cumplidas, 4: No aplica)
   * @param anio El año seleccionado o el año actual si hay múltiples años
   */
  private navigateToRecomendaciones(departamento: string, estado: number, anio?: string): void {
    // Si hay múltiples años seleccionados, usar el año actual
    const year = anio || new Date().getFullYear().toString();
    
    this.router.navigate(['/inicio/recomendaciones'], { 
      queryParams: { 
        departamento: departamento,
        estado: estado.toString(),
        anio: year,
        fromChart: 'true' // Indicador de que viene desde un gráfico
      }
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

    const ctx = this.barChartRef?.nativeElement.getContext('2d');
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
        labels: this.labelsDptosAbreviados,
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
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Hace que las barras sean horizontales
        scales: {
          x: {
            stacked: true,
            grid: {
              color: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'
            },
            border: {
              display: false
            },
            title: {
              display: true,
              text: 'Cantidad recomendaciones',
              color: textColor,
              font: {
                size: window.innerWidth < 768 ? 10 : 12 // Fuente más pequeña en móvil
              }
            },
            ticks: {
              stepSize: 10, // Ajusta el tamaño del paso en el eje x si es necesario
              color: textColor,
              font: {
                size: window.innerWidth < 768 ? 10 : 12 // Fuente más pequeña en móvil
              }
            }
          },
          y: {
            stacked: true,
            grid: {
              display: false
            },
            border: {
              display: false
            },
            title: {
              display: true,
              text: 'Departamento',
              color: textColor,
              font: {
                size: window.innerWidth < 768 ? 10 : 12 // Fuente más pequeña en móvil
              }
            },
            ticks: {
              color: textColor,
              font: {
                size: window.innerWidth < 768 ? 10 : 12 // Fuente más pequeña en móvil
              }
            }
          }
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
                size: window.innerWidth < 768 ? 10 : 12 // Fuente más pequeña en móvil
              }
            }
          },
          datalabels: {
            display: this.mostrarEtiquetas,
            color: '#ffffff',
            font: {
              weight: 'bold',
              size: window.innerWidth < 768 ? 9 : 11
            },
            formatter: (value, context) => {
              return value === 0 ? '' : value.toString();
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
            enabled: true,
            callbacks: {
              // Usar el nombre completo del departamento en el tooltip para mayor claridad
              title: (tooltipItems) => {
                const index = tooltipItems[0].dataIndex;
                return this.labelsDptos[index];
              }
            }
          }
        },
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const element = elements[0];
            const datasetIndex = element.datasetIndex;
            const index = element.index;
            
            // Obtener el departamento seleccionado
            const departamento = this.labelsDptos[index];
            
            // Determinar el estado según el datasetIndex
            let estado = 0;
            switch (datasetIndex) {
              case 0: estado = 1; break; // En proceso
              case 1: estado = 2; break; // Cumplidas
              case 2: estado = 3; break; // No cumplidas
              case 3: estado = 4; break; // No aplica
            }
            
            // Verificar si todos los años están seleccionados o más de un año
            if (this.selectedAnios.length > 1) {
              // Mostrar alerta advirtiendo que debe seleccionar un año específico
              this.alertsSrv.showAlert('Para ver recomendaciones, seleccione un año específico', 'warning');
              return;
            }
            
            // Determinar el año a enviar
            let anioSeleccionado: string | undefined;
            
            // Si hay un solo año seleccionado, usar ese año
            if (this.selectedAnios.length === 1) {
              anioSeleccionado = this.selectedAnios[0];
            } 
            // Si no, enviamos undefined y el método de navegación usará el año actual
            
            // Navegar a la página de recomendaciones con los filtros
            this.navigateToRecomendaciones(departamento, estado, anioSeleccionado);
          }
        }
      }
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
  protected cambiarVistaResumen(vista: 'overview' | 'estados' | 'departamentos'): void {
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
      noAplica: this.dataNoAplica.reduce((acc, val) => acc + val, 0)
    };
  }

  /**
   * Calcula el total general de todas las recomendaciones
   */
  protected getTotalGeneral(): number {
    const totales = this.getTotalPorEstado();
    return totales.enProceso + totales.cumplidas + totales.noCumplidas + totales.noAplica;
  }

  /**
   * Calcula el porcentaje de un estado específico
   */
  protected getPorcentaje(cantidad: number): number {
    const total = this.getTotalGeneral();
    return total > 0 ? Math.round((cantidad / total) * 100) : 0;
  }

  /**
   * Obtiene el departamento con más recomendaciones
   */
  protected getDepartamentoConMasRecomendaciones(): { departamento: string, departamentoAbrev: string, total: number } {
    let maxTotal = 0;
    let deptoMax = '';
    let deptoAbrevMax = '';
    
    this.labelsDptos.forEach((dpto, index) => {
      const total = this.dataEnProceso[index] + this.dataCumplidas[index] + 
                   this.dataNoCumplidas[index] + this.dataNoAplica[index];
      if (total > maxTotal) {
        maxTotal = total;
        deptoMax = dpto;
        deptoAbrevMax = this.labelsDptosAbreviados[index];
      }
    });
    
    return { departamento: deptoMax, departamentoAbrev: deptoAbrevMax, total: maxTotal };
  }

  /**
   * Obtiene el porcentaje de cumplimiento por departamento
   */
  protected getPorcentajeCumplimientoPorDepartamento(departamento: string): number {
    const index = this.labelsDptos.indexOf(departamento);
    if (index === -1) return 0;
    
    const total = this.dataEnProceso[index] + this.dataCumplidas[index] + 
                  this.dataNoCumplidas[index] + this.dataNoAplica[index];
    return total > 0 ? Math.round((this.dataCumplidas[index] / total) * 100) : 0;
  }

  /**
   * Obtiene el texto de años seleccionados para el resumen
   */
  protected getAniosSeleccionadosTexto(): string {
    if (this.selectedAnios.length === 0) return 'Ningún año';
    if (this.selectedAnios.length === 1) return this.selectedAnios[0];
    if (this.selectedAnios.length === this.labelsAnios.length) return 'Todos los años';
    return `${this.selectedAnios.length} años`;
  }
}
