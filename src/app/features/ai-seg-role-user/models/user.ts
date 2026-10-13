export interface UsuarioAsignadoRol {
  aseru_codigo: number;
  dsgus_cuenta: string;
  nombre_completo: string;
  fecha: string;
  departamento?: string;
  codigo_per?: string;
  email?: string;
}

export interface UsuarioListado {
  nombre_completo: string;
  // dmper_rol: string;
  dsgus_cuenta: string;
  departamento: string;
}

export interface PersonalInfoListado {
  NOMBRES: string;
  APELLIDOS: string;
  DEPARTAMENTO: string;
  CARGO: string;
  USUARIO: string;
  EMAIL: string;
  CODIGO: string;
  selected?: boolean;
  isAssigned?: boolean;
}
