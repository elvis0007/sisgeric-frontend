export interface Informe {
  ainin_codigo: number;
  ainin_titulo: string;
  ainin_otnum: number;
  ainin_otanio: number;
  ainin_ordenTrabajo: string
  ainin_infAdjunto: string;
  urlArchivo: string;
  ainin_fechaEmision: string;
  ainin_fechaAprobacion: string;
  ainin_memoAprobacion: string;
  ainin_memorando: string;
  ainin_fechaMemo: string;
  tipoInf: TipoInforme;
  organismoControl: OrganismoControl;
  ainin_usuario: string;
  ainin_notificado?: string;
  progreso?: number;
}

export interface TipoInforme {
  ainti_codigo: number;
  ainti_descripcion: string;
}

export interface OrganismoControl {
  ainoc_codigo: number;
  ainoc_descripcion: string;
}

export enum UserRole {
    AUDITOR_OP = 3,
    RESPONSABLE = 4
}

export interface ListaAuditorOp { 
  asero_codigo: number;
  asero_descripcion: string;
  usuarios: UsuarioAuditor[];
}
export interface UsuarioAuditor {
  aseru_codigo: number;
  dsgus_cuenta: string;
  nombre_completo: string;
} 
