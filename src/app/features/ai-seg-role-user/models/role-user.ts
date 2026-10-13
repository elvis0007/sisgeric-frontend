import { Auditoria } from '@shared/models/audit';

import { UsuarioAsignadoRol } from './user';

export interface RolUsuario {
  asero_codigo: number;
  asero_descripcion: string;
  usuarios: UsuarioAsignadoRol[];
}

export interface RolUsuarioEscritura {
  codigo_per: string;
  rol: number;
  aseru_cuenta: string;
  email: string;
  auditoria: Auditoria;
}

export interface RolUsuarioActualizacion {
  aseru_codigo: number;
  codigo_per: string;
  rol: number;
  aseru_cuenta: string;
  email: string;
  departamento: string;
  auditoria: Auditoria;
}