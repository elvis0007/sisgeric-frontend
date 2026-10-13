export interface HallazgoConclusiones {
  ainin_codigo: number;
  areha_titulo: string;
  ainin_orden_trabajo: string;
  conclusiones: Conclusion[];
}

export interface Conclusion {
  areco_codigo: number;
  areco_conclusion: string;
  totalRecomendaciones?: number;
}

export interface ConclusionEscritura {
  areco_conclusion: string;
  areha_codigo: number;
  recomendaciones: Recomendacion[];
}

export interface Recomendacion {
  arere_descripcion: string;
  arere_fecha_maxima: string;
  arere_fecha_inicio_control: string;
  arere_num_rec: number;
  arere_riesgo_verificado?: 'ALTO' | 'MODERADO' | 'BAJO';
  arere_evidencia_requerida?: string;
  responsables: Responsable[];
}

export interface Responsable {
  arers_codigo_per: string;
  arers_nombre: string;
  arers_apellido: string;
  arers_correo: string;
  arers_seccion: string;
  arers_cargo: string;
  arers_departamento: string;
  arers_departamento_abrev: string;
  arers_num_rol: string;
  arers_usuario_per: string;
  hasRol?: boolean;
}

export interface MaxItems {
  datos: number;
}

export interface TitleInformeHallazgo {
  ainin_titulo: string;
  areha_fecha_inicio_control: string | Date;
  areha_descripcion: string;
  ainin_orden_trabajo: string;
}
