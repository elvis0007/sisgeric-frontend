import { EstadoVerificable } from '@features/ai-seg-configuracion/models/Estado-Ver';

export interface RecomendacionVerificable {
  ainin_codigo: string;
  ainin_memorando: string;
  ainin_memo_aprobacion: string;
  ainin_titulo: string;
  ainin_orden_trabajo: string;
  ainoc_descripcion: string;
  recomendaciones: Recomendacion;
  ainin_usuario?: string;
}

export interface RecomendacionVerificables {
  arere_codigo: number;
  arere_descripcion: number;
  verificables: Verificable[];
}

interface Recomendacion {
  arere_codigo: number;
  arere_num_rec: number;
  arere_descripcion: string;
  arere_fecha_maxima: string;
  plazo: number;
  motivo_estado: string;
  estado_seguimiento: EstadoSeguimiento;
  estado_solicitud?: string;
  estado_verificable?: string;
  arere_progreso?: number;
  total_responsables?: number;
  responsables_cumplidos?: number;
  estado_general?: EstadoSeguimiento;
  estado_individual?: EstadoSeguimiento;
  fecha_maxima_general?: string;
  fecha_maxima_individual?: string;
  plazo_individual?: number;
  arere_evidencia_requerida?: string;
  arere_riesgo_verificado?: string;
  aredr_codigo?: number;
  arers_codigo?: number;
  arers_codigo_per?: string;
}

interface EstadoSeguimiento {
  arees_codigo: number;
  arees_descripcion: string;
}

export interface Verificable {
  areve_codigo: number;
  areve_descripcion: string;
  areve_fecha_carga: string;
  areve_fecha_validacion: string;
  areve_adjunto: string;
  areve_motivo_estado: string;
  estado_seguimiento: EstadoVerificable;
  responsable?: any;
  advertencia?: string;
}

export interface ModalData {
  arere_codigo: number;
  areve_codigo: number;
}
