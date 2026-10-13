export interface EvidenciaRequerida { arer_codigo?: number | null; arer_descripcion: string; }
import { Responsable } from './conclusion';
export interface ConclusionRecomendaciones {
  areco_codigo: number;
  areco_conclusion: string;
  ainin_orden_trabajo: string;
  arere_fecha_inicio_control: string;
  recomendaciones: Recomendacion[];
}

export interface Recomendacion {
  arere_codigo: number;
  arere_num_rec: number;
  arere_descripcion: string;
  arere_fecha_inicio_control: string;
  arere_fecha_maxima: string;
  plazo: number;
  estado_seguimiento: EstadoSeg;
  motivo_estado: string;
  responsables: number;
  arere_riesgo_verificado?: string | null;
  arere_evidencia_requerida?: string | null;
  arere_evidencias_requeridas?: EvidenciaRequerida[];
}

export interface RecomendacionWrite {
  responsables?: Responsable[];
  arere_evidencia_requerida?: string | null;
  arere_evidencias_requeridas?: EvidenciaRequerida[];
  arere_riesgo_verificado?: string | null;
  arere_codigo: number;
  arere_descripcion: string;
  arere_fecha_inicio_control: string;
  arere_fecha_maxima: string;
  arere_num_rec: number;
  arers_codigo?: number | null;
}

export interface EstadoSeg {
  arees_codigo: number;
  arees_descripcion: string;
}

export interface ResponsableView {
  arers_codigo: number;
  nombre_completo: string;
  fotografia: string;
  arers_correo: string;
  arers_seccion: string;
  arers_cargo: string;
  arers_departamento: string;
  arers_codigo_per: string;
  arers_num_rol: string;
  arers_estado: string;
  arers_fecha: string;
  arers_reemp_por: string;
  arers_fecha_reempl: string
  areev_descripcion: string;
  observacion?: string;
  fechaHoraCargaVerificable?: string | null;
  fechaHoraCambioEstado?: string | null;
  estadoVerificableReporte7?: string | null;
  aredr_fecha_maxima?: string | null;
  plazo?: number | null;
  estado_plazo?: string | null;
}
