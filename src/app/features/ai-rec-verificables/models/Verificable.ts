import { EstadoVerificable } from '@features/ai-seg-configuracion/models/Estado-Ver';
import { EstadoSeg } from '@features/ai-seguim-recomendaciones/models/recomendacion';

export interface Verificable {
  areve_codigo: number;
  arere_codigo?: number;
  aredr_codigo?: number;
  aredr_fecha_maxima?: string;
  areve_descripcion: string;
  areve_archivo: string;
  areve_fecha_carga: string;
  areve_fecha_validacion: string;
  areve_adjunto: string;
  areve_motivo_estado: string;
  estado_seguimiento: EstadoVerificable;
  responsable: Responsable;
  advertencia?: string;
  areve_usuario?: string;
  auditor_recomendacion?: string;
  subido_por_responsable?: boolean;
  subido_por_auditor?: boolean;
  puede_editar?: boolean;
}

export interface VerificableEscritura {
  areve_codigo: number;
  areve_motivo_estado: string;
  areev_codigo: number;
}

export interface RecomendacionVerificable {
  aredr_codigo?: number;
  arere_codigo: number;
  arere_descripcion: string;
  arere_num_rec?: number | string;
  arere_evidencia_requerida?: string;
  arere_riesgo_verificado?: string;
  ainin_memorando?: string;
  ainin_titulo?: string;
  estado_seguimiento?: EstadoSeg;
  verificables: Verificable[];
}

interface Responsable {
  arers_codigo_per: string;
  arers_correo: string;
  arers_seccion: string;
  arers_cargo: string;
  arers_departamento: string;
  arers_num_rol: string;
  arers_usuario: string;
  nombre_completo: string;
}
