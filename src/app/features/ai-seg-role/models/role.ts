import { Auditoria } from '@shared/models/audit';

export interface Rol {
  asero_codigo: number;
  asero_descripcion: string;
  asero_estado?: string;
  asero_fecha?: string;
}

export interface RolEscritura {
  asero_descripcion: string;
  auditoria: Auditoria;
}
