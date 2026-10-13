export type EstadoCumplimiento = 'CUMPLE' | 'NO CUMPLE' | 'EN PROCESO' | 'PENDIENTE' | '';

export interface ActividadPlanAccion {
  id: string;
  num_actividad: number;
  fase?: string;
  actividad: string;
  fecha_ejecucion: string;
  entregable_esperado: string;
  estado_cumplimiento?: EstadoCumplimiento;
  observaciones?: string;
  arpac_codigo?: number;
  arer_codigo?: number;
}

export interface PlanAccionRecomendacion {
  arere_codigo: number;
  actividades: ActividadPlanAccion[];
  fecha_actualizacion?: string;
  fecha_maxima_referencia?: string;
}

export interface EvidenciaRequeridaDTO {
  arer_codigo: number;
  arere_codigo: number;
  arer_descripcion: string;
  arer_estado?: string;
}

export interface PlanActividadDTO {
  arpac_codigo?: number;
  arpa_codigo?: number;
  arer_codigo?: number;
  num_actividad: number;
  actividad: string;
  fecha_ejecucion: string;
  entregable_esperado: string;
  arpac_estado?: string;
}

export interface PlanAccionDTO {
  arpa_codigo?: number;
  arere_codigo: number;
  aredr_codigo: number;
  fecha_maxima_ref?: string;
  fecha_actualizacion?: string;
  arpa_estado?: string;
  actividades: PlanActividadDTO[];
}

export interface GuardarPlanAccionDTO {
  arere_codigo: number;
  aredr_codigo: number;
  arers_codigo?: number;
  arers_codigo_per?: string;
  fecha_maxima_ref?: string;
  actividades: PlanActividadDTO[];
}

export interface EvidenciaCotejoDTO {
  arec_codigo?: number;
  arer_codigo: number;
  aredr_codigo: number;
  arer_descripcion: string;
  cumple: boolean;
  fecha_cotejo?: string;
}

export interface GuardarCotejoDTO {
  arere_codigo?: number;
  aredr_codigo: number;
  checklist: { [key: string]: boolean };
}

