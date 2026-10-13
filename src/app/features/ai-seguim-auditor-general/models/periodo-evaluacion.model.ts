export type TipoPeriodoEvaluacion = 'TRIMESTRAL' | 'CIERRE_ANUAL' | 'PERSONALIZADO';

export interface PeriodoEvaluacion {
  arcev_codigo: number;
  arcev_nombre: string;
  arcev_tipo: TipoPeriodoEvaluacion;
  arcev_fecha_inicio: string;
  arcev_fecha_fin: string;
  arcev_fecha_corte: string;
  arcev_anio: number;
  arcev_estado: number; // 1: Activo, 0: Inactivo
  total_informes?: number;
  total_recomendaciones?: number;
}

export interface PeriodoInformeDetalle {
  arcei_codigo?: number;
  arcev_codigo: number;
  ainin_codigo: number;
  ainin_titulo: string;
  ainin_memorando: string;
  ainin_fecha_emision?: string;
  ainin_fecha_aprobacion?: string;
  organismo_control?: string;
  arcei_es_manual: number; // 0: Auto por fecha, 1: Manual
  arcei_fecha_registro?: string;
}

export interface CrearPeriodoDTO {
  arcev_nombre: string;
  arcev_tipo: TipoPeriodoEvaluacion;
  arcev_fecha_inicio: string;
  arcev_fecha_fin: string;
  arcev_fecha_corte: string;
  arcev_anio: number;
  informes_ids?: number[];
}
