import { CommonModule } from '@angular/common';
import { Component, effect, inject} from '@angular/core';
import { ResponsableView } from '@features/ai-seguim-auditor-operativo/models/recomendacion';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { RecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/recomendaciones.service';
import { ModalResponsablesService } from '@features/ai-seguim-recomendaciones/services/modal-responsables.service';

import { ResponseReadMultiple } from '@shared/models/response-read';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';

@Component({
  selector: 'app-modal-responsables',
  standalone: true,
  imports: [CommonModule, StatusColorPipe],
  templateUrl: './modal-responsables.component.html',
  styleUrl: './modal-responsables.component.css',
})
export class ModalResponsablesComponent {
  private readonly alertsService = inject(AlertsStateService);
  protected modalResponsableSrv: ModalResponsablesService = inject(
    ModalResponsablesService
  );
  private readonly recomendacionSrv: RecomendacionesService = inject(
    RecomendacionesService
  );
  
  protected userPhotoUrl: string =
    'sisrec/assets/images/avatar_profile.png';
  protected readonly Math = Math;
  protected id_rec!: number;
  protected selectedState: number = 1; // 'Actuales' activado por defecto
  protected responsables: ResponsableView[] = [];
  protected responsablesReporte7: any[] = [];
  protected isLoadingBoton = false;
  protected isLoadingCards = false;
  protected isObservacionModalOpen = false;
  protected selectedResponsable: ResponsableView | null = null;
  protected isFromReporte7 = false;

  constructor() {
    effect(() => {
      const id_rec = this.modalResponsableSrv.modalData();
      this.isFromReporte7 = this.modalResponsableSrv.isFromReporte7();
      if (id_rec) {
        this.id_rec = id_rec;
        if (this.isFromReporte7) {
          this.responsablesReporte7 = this.modalResponsableSrv.getResponsablesReporte7();
          // Obtener los datos completos de los responsables y combinar con los datos del reporte 7
          this.getResponsablesForReporte7(this.id_rec);
        } else {
          this.getResponsables(this.id_rec);
        }
      }
    });
  }

  protected closeModal() {
    this.modalResponsableSrv.closeModal();
    this.responsables = [];
    this.responsablesReporte7 = [];
    this.isFromReporte7 = false;
  }

  // Obtiene los responsables de la recomendación
  protected getResponsables(id_rec: number): void {
    this.isLoadingCards = true; // Activa el indicador de carga para las tarjetas

    this.recomendacionSrv.getResponsables(id_rec).subscribe({
      next: (response: ResponseReadMultiple<ResponsableView>) => {
        let datos = response.datos;

        // Si hay un Periodo de Evaluación seleccionado, mostrar únicamente los
        // responsables incluidos en ese periodo (excluyendo los no incluidos).
        const periodoMap = this.modalResponsableSrv.getResponsablesPeriodo();
        if (periodoMap && periodoMap.has(id_rec)) {
          const incluidos = periodoMap.get(id_rec)!;
          datos = datos.filter((responsable) =>
            incluidos.has(Number(responsable.arers_codigo))
          );
        }

        this.responsables = datos.map((responsable) => ({
          ...responsable,
          fotografia: `data:image/jpeg;base64,${responsable.fotografia}`, // Concatenar el prefijo
        }));
      },
      error: () => {
        this.alertsService.showAlert(
          'Error al obtener responsables.',
          'error'
        );
      },
      complete: () => {
        this.isLoadingCards = false; // Desactiva el indicador de carga al finalizar
      },
    });
  }

  // Obtiene los responsables completos y los combina con los datos del reporte 7
  protected getResponsablesForReporte7(id_rec: number): void {
    this.isLoadingCards = true;

    this.recomendacionSrv.getResponsables(id_rec).subscribe({
      next: (response: ResponseReadMultiple<ResponsableView>) => {
        // Combinar los datos completos del responsable con los datos del reporte 7
        this.responsables = response.datos.map((responsable) => {
          // Buscar el responsable correspondiente en los datos del reporte 7
          const responsableReporte7 = this.responsablesReporte7.find(
            r7 => r7.nombreCompleto === responsable.nombre_completo
          );

          return {
            ...responsable,
            fotografia: `data:image/jpeg;base64,${responsable.fotografia}`,
            // Agregar datos del reporte 7
            fechaHoraCargaVerificable: responsableReporte7?.fechaHoraCargaVerificable || null,
            fechaHoraCambioEstado: responsableReporte7?.fechaHoraCambioEstado || null,
            estadoVerificableReporte7: responsableReporte7?.estadoVerificable || null
          };
        });
      },
      error: () => {
        this.alertsService.showAlert(
          'Error al obtener responsables.',
          'error'
        );
      },
      complete: () => {
        this.isLoadingCards = false;
      },
    });
  }

  protected get filteredResponsables(): ResponsableView[] {
    // Si es reporte 7, mostrar todos los responsables (ya vienen filtrados del backend)
    if (this.isFromReporte7) {
      return this.responsables;
    }

    return this.responsables.filter((responsable) => {
      // Filtrar por departamento si está especificado
      const departamentoFiltro = this.modalResponsableSrv.getDepartamento();
      if (departamentoFiltro && responsable.arers_departamento !== departamentoFiltro) {
        return false;
      }

      // Si el filtro es ACTUALES (1), se muestran los que no tienen estado '0'
      if (this.selectedState === 1) {
        const isActual = responsable.arers_estado !== '0';
        
        // Si se debe filtrar solo los no justificados (desde reporte de vencidas)
        if (this.modalResponsableSrv.shouldFilterNoJustificados()) {
          // Excluir los que ya justificaron (solo mostrar los que NO han justificado)
          const estadoVerificable = responsable.areev_descripcion?.trim() || '';
          
          // Excluir si el estado es "JUSTIFICA" (código 2)
          // Mostrar si es null, vacío, "VERIFICABLE NO CREADO", "PENDIENTE", o "NO JUSTIFICA"
          const esJustificado = estadoVerificable === 'JUSTIFICA';
          
          return isActual && !esJustificado;
        }
        
        return isActual;
      }
      // Si el filtro es ANTERIORES (2), se muestran los que tienen estado '0'
      return responsable.arers_estado === '0';
    });
  }  

  protected setFilter(state: number): void {
    this.selectedState = state;
  }

  protected openObservacionModal(responsable: ResponsableView): void {
    this.selectedResponsable = responsable;
    this.isObservacionModalOpen = true;
  }

  protected closeObservacionModal(): void {
    this.isObservacionModalOpen = false;
    this.selectedResponsable = null;
  }

  protected calcularTiempoExcedido(fechaCarga: string | null | undefined, fechaCambio: string | null | undefined): { dias: number; horas: number; texto: string } | null {
    if (!fechaCarga || !fechaCambio) {
      return null;
    }

    try {
      const parseFecha = (fechaStr: string): Date => {
        const [fecha, hora] = fechaStr.split(' ');
        const [dia, mes, anio] = fecha.split('/');
        const [horas, minutos, segundos] = hora.split(':');
        return new Date(
          parseInt(anio),
          parseInt(mes) - 1,
          parseInt(dia),
          parseInt(horas),
          parseInt(minutos),
          parseInt(segundos)
        );
      };

      const fechaCargaDate = parseFecha(fechaCarga);
      const fechaCambioDate = parseFecha(fechaCambio);

      const diferenciaMs = fechaCambioDate.getTime() - fechaCargaDate.getTime();
      const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
      const horasLimite = 24;

      if (diferenciaHoras > horasLimite) {
        const horasExcedidas = diferenciaHoras - horasLimite;
        const dias = Math.floor(horasExcedidas / 24);
        const horas = Math.floor(horasExcedidas % 24);

        let texto = '';
        if (dias > 0) {
          texto += `${dias} día${dias > 1 ? 's' : ''}`;
        }
        if (horas > 0) {
          if (texto) texto += ' y ';
          texto += `${horas} hora${horas > 1 ? 's' : ''}`;
        }

        return { dias, horas, texto: texto.trim() };
      }

      return null;
    } catch (error) {
      console.error('Error al calcular tiempo excedido:', error);
      return null;
    }
  }

  protected esJustificado(responsable: any): boolean {
    const estado = (responsable?.estadoVerificableReporte7 || responsable?.areev_descripcion || '').trim().toUpperCase();
    if (estado === 'NO JUSTIFICA') return false;
    return estado === 'JUSTIFICA' || estado === 'JUSTIFICADO' || estado === 'VERIFICABLE JUSTIFICADO' || responsable?.estado_plazo === 'CUMPLIDO';
  }
}
