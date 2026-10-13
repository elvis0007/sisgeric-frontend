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
  arere_evidencia_requerida?: string;
  arere_riesgo_verificado?: string;
}

export interface RecomendacionFechaWrite {
  arere_codigo: number;
  arere_fecha_maxima: string;
  aredr_codigo?: number;
  arers_codigo?: number;
}

export interface RecomendacionEstadoSeguimWrite {
  arere_codigo: number;
  arees_codigo: number;
  motivo_estado: string;
}

export interface InformeRecomendacion {
  ainin_codigo: number;
  ainin_orden_trabajo: string;
  ainin_titulo: string;
  recomendaciones: Recomendacion[];
}

export interface DetalleRecomendacion {
  aredr_codigo?: number;
  ainin_codigo: number;
  ainin_orden_trabajo: string;
  ainin_memorando: string;
  ainin_memo_aprobacion: string;
  ainoc_descripcion: string;
  ainin_titulo: string;
  recomendaciones: Recomendacion;
}
