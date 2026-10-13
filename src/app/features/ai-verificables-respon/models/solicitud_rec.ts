import { Auditoria } from '@shared/models/audit';

export interface Solicitud {
  areso_codigo: number;
  numeroSolicitud?: string | number;
  asero_estado_aprob: string;
  areso_tipo_cambio: string;
  areso_descripcion: string;
  areso_fecha_max_ant: string;
  areso_fecha_max_nue: string;
  areso_memorando: string;
  areso_adjunto: string;
  areso_fecha_carga: string;
  responsable: Responsable;
  recomendacion: Recomendacion;
}

export interface SolicitudDetalle {
  areso_codigo: number;
  numeroSolicitud?: string | number;
  asero_estado_aprob: string;
  areso_tipo_cambio: string;
  areso_descripcion: string;
  areso_fecha_max_ant: string;
  areso_fecha_max_nue: string;
  areso_memorando: string;
  areso_adjunto: string;
  areso_fecha_carga: string;
  ainin_memorando: string;
  ainin_memo_aprobacion: string;
  ainoc_descripcion: string;
  responsable: Responsable;
  recomendacion: Recomendacion;
}

interface Responsable {
  arers_codigo: number;
  arers_usuario: string;
  arers_codigo_per: string;
  nombre_completo: string;
  arers_cargo: string;
  arers_departamento: string;
}

interface Recomendacion {
  arere_codigo: number;
  arere_descripcion: string;
  arere_fecha_maxima: string;
}

export interface ListResponsable {
  asero_codigo: number;
  asero_descripcion: string;
  usuarios: UsuarioResponsable[];
}

export interface UsuarioResponsable {
  aseru_codigo: number;
  dsgus_cuenta: string;
  nombre_completo: string;
  codigo_per: string;
}

export interface AprobarSolicitudWrite {
  aseru_codigo_per: string;
  areso_estado_aprob: string;
}

export enum EstadoAprobacion {
  APROBADO = '1',
  NO_APROBADO = '0',
}

export interface OpcionEstado {
  codigo: EstadoAprobacion;
  nombre: string;
}
