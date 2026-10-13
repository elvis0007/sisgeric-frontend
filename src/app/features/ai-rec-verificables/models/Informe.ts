export interface Informe {
  ainin_codigo: number;
  ainin_titulo: string;
  progreso: number;
  ainin_ordenTrabajo: string;
  ainin_infAdjunto: string;
  urlArchivo: string;
  ainin_fechaEmision: string;
  ainin_fechaAprobacion: string;
  ainin_memoAprobacion: string;
  ainin_memorando: string;
  ainin_fechaMemo: string;
  tipoInf: TipoInforme;
  organismoControl: OrganismoControl;
  totalRecomendaciones: number;
  ainin_usuario: string;
}

export interface TipoInforme {
  ainti_codigo: number;
  ainti_descripcion: string;
}

export interface OrganismoControl {
  ainoc_codigo: number;
  ainoc_descripcion: string;
}
