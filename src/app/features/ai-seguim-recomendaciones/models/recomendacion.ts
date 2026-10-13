export interface Recomendacion {
  ainin_memorando: string;
  arere_codigo: number;
  arere_num_rec: number;
  arere_descripcion: string;
  arere_fecha_inicio_control: string;
  arere_fecha_maxima: string;
  plazo: number;
  estado_seguimiento: EstadoSeg;
  motivo_estado: string;
  responsables: number;
}

export interface EstadoSeg {
  arees_codigo: number;
  arees_descripcion: string;
}

export interface RecomendacionInforme {
  ainin_codigo: string;
  ainin_titulo: string;
  ainin_orden_trabajo: string;
  ainoc_descripcion: string;
  ainin_memorando: string;
  ainin_usuario?: string;
  recomendaciones: Recomendacion;
  lista_responsables?: string;
}
