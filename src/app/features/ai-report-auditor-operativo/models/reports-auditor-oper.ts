export interface ReportEstadoSeguimiento {
    memorandoAI: string;
    memorandoAprobacion: string;
    organismoControl: string;
    departamento: string;
    funcionarioResponsable: string;
    tituloInforme: string;
    conclusion: string;
    recomendacion: string;
    fechaMaximaRecomendacion: string;
    estadoSeguimiento?: string;
    riesgoVerificado?: string | null;
    evidenciaRequerida?: string | null;
    observacionAuditora?: string;
    observacionVerificable?: string;
    numeroRecomendacion?: number;
    fechaAprobacion?: string;
    codigoRecomendacion?: number;
    codigoInforme?: number;
}

export interface ReportEstadoSeguimientoDetalle {
    codigoInforme: string;
    tituloInforme: string;
    memorandoAI: string;
    memorandoPresidencia: string;
    organismoControl: string;
    departamentos: string;
    auditorInforme: string;
    totalAsignaciones: number;
    totalRecomendaciones: number;
    recomendacionesEnProceso: number;
    recomendacionesCumplidas: number;
    recomendacionesNoCumplidas: number;
    recomendacionesNoAplica: number;
    progreso: number;
}

export interface ReportRecomendacionesVencidasOperativo {
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

export interface ReportSeguimientoResponsable {
  codigoInforme: number;
  memoAuditoria: string;
  fechaMemorando: string;
  memoPresidencia: string;
  fechaAprobacion: string;
  auditor: string;
  fechaCreacionInforme: string;
  tituloInforme: string;
  organismoControl: string;
  hallazgo: string;
  conclusion: string;
  codigoRecomendacion: number;
  numeroRecomendacion?: number;
  recomendacion: string;
  fechaVencimiento: string;
  estadoRecomendacion: string;
  estadoPlazo: string;
  diasVencidos: number;
  progresoRecomendacion: number;
  fechaCargaVerificable: string | null;
  responsable: string;
  estadoVerificable: string;
  departamento: string;
  descripcionVerificableResponsable: string | null;
  observacionAuditor: string | null;
  progresoInforme: number;
  fechaConsulta: string;
  riesgo?: string;
  evidenciaRequerida?: string;
  tienePlanAccion?: string;
  cantidadActividadesPlan?: number;
  fechaValidacionVerificable?: string | null;
  aredrCodigo?: number;
  arersCodigo?: number;
  arersCodigoPer?: string;
}

