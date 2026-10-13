export interface Notification {
    anotif_codigo: number;
    arers_codigo: number;
    anotif_usuario_per: string | null;
    anotif_titulo: string;
    anotif_mensaje: string;
    anotif_auditor_asignado: string | null;
    anotif_estado: number;
    anotif_fecha_creacion: string;
    anotif_fecha_leida: string;
    anotif_url_sistema: string;
    anotif_tipo: string | null;
    anotif_anio: number | null;
    anotif_ainin_codigo: number | null;
    anotif_arere_codigo: number | null;
    anotif_padre_id?: number | null;
    checked: boolean;
  }