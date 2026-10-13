export interface ReportRecomResponsable {
  tituloInforme: string;
  memorando: string;
  memoAprobacion: string;
  conclusion: string;
  recomendacion: string;
  fechaInicioControl: string;
  fechaMaxima: string;
  organismoControl: string;
  estadoSeguimiento: string;
  pendienteCumplimientoDepartamentos: string;
  pendienteCumplimientoResponsables: string;

}

export interface ReportProgresoRecomendacion {
  codigoInforme: number;
  tituloInforme: string;
  memorando: string;
  memoAprobacion: string;
  organismoControl: string;
  codigoAuditor: string;
  conteoRecomendaciones: number;
  recomendacionesEnProceso: number;
  recomendacionesCumplidas: number;
  recomendacionesNoCumplidas: number;
  recomendacionesNoAplica: number;
  progreso: number;
  departamentosResponsablesPendientesEnProceso?: string | null;
  departamentosResponsablesNoCumplida?: string | null;
}

export interface ReportRecomendacionesVencidasResponsable {
  tituloInforme: string;
  recomendacion: string;
  organismoControl: string;
  memorando: string;
  memoAprobacion: string;
  observacion: string;
  fechaEmision: string;
  fechaMaxima: string;
  plazo: number;
  responsables: string;
  arereCodigo: number;
}