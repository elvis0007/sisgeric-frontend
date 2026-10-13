import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';

export interface Recomendacion {
  aredr_codigo: number;
  arere_codigo: number;
  arere_num_rec: number;
  arere_progreso: number;
  arere_descripcion: string;
  arere_fecha_inicio_control: string;
  arere_fecha_maxima: string;
  arere_num_prorroga: number;
  plazo: number;
  estado_seguimiento: EstadoSeg;
  motivo_estado: string;
  responsables: number;
  total_responsables?: number;
  responsables_cumplidos?: number;
  responsables_vencidos?: number;
}

export interface RecomendacionFechaWrite {
  arere_codigo: number;
  arere_fecha_maxima: string;
}

export interface InformeRecomendacion {
  ainin_codigo: number;
  ainin_orden_trabajo: string;
  ainin_titulo: string;
  recomendaciones: Recomendacion[];
}

export interface DetalleRecomendacion {
  ainin_codigo: number;
  ainin_orden_trabajo: string;
  ainin_titulo: string;
  recomendaciones: Recomendacion;
}
