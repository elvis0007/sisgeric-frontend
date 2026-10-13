export interface HallazgoConclusiones {
  ainin_codigo: number;
  areha_titulo: string;
  ainin_orden_trabajo: string
  conclusiones: Conclusion[];
}

export interface Conclusion {
  areco_codigo: number;
  areco_conclusion: string;
}

export interface Recomendacion {
  arere_descripcion: string;
  arere_fecha_maxima: string;
  arere_num_rec: number;
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
  arers_num_rol: string;
  arers_usuario_per: string;
}

export interface TitleInformeHallazgo {
  ainin_titulo: string;
  areha_descripcion: string;
  ainin_orden_trabajo: string;
}

