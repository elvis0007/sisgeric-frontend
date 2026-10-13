export interface CredentialResponse {
  STATE: string;
  MESSAGE: string;
  DATA: User;
}

export interface User {
  dsgus_cuenta: string;
  nombre_completo: string;
  codigo_per: string;
  fotografia: string;
  departamento: string;
  roles: UserRole[];
  token: string;
  token_sisgerh: string;
}

export interface UserRole {
  asero_codigo: number;
  asero_descripcion: string;
  asero_fecha: string;
}
