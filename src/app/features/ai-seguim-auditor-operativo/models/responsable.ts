export interface RoleResponsable {
    nombre_completo: string;
    aseru_codigo_per: string;
}

export interface  ResponsableInfo {
    CODIGO: string;
    NOMBRES: string;
    APELLIDOS: string;
    EMAIL: string;
    ROL: string;
    USUARIO: string;
    CARGO: string;
    DEPARTAMENTO: string;
    DEPARTAMENTO_ABREV: string;
    SECCION: string;
    selected?: boolean;
    isAssigned?: boolean;
}

