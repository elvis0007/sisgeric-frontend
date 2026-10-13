export interface ConclusionRecomendaciones {
  areco_codigo: number;
  areco_conclusion: string;
  ainin_orden_trabajo: string;
  recomendaciones: Recomendacion[];
}

export interface Recomendacion {
  arere_codigo: number;
  arere_num_rec: number;
  arere_descripcion: string;
  arere_fecha_maxima: string;
  arere_fecha_inicio_control: string;
  plazo: number;
  estado_seguimiento: EstadoSeg;
  motivo_estado: string;
  responsables: number;
}

export interface EstadoSeg {
  arees_codigo: string;
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
  arers_fecha_reempl: string;
  aredr_fecha_maxima?: string;
  plazo?: number;
  estado_plazo?: string;
  areev_descripcion?: string;
}
