export interface ReportEstadoSeguimiento {
  evidenciaRequerida?: string | null;
  riesgoVerificado?: string | null;
  organismoControl: string;
  memorando: string;
  memoAprobacion: string;
  fechaEmision: string;
  fechaAprobacion: string;
  tituloInforme: string;
  recomendacion: string;
  estadoSeguimiento: string;
  responsables: string;
  auditor?: string;
  progresoInforme: number;
}

export interface ReportDirectorio {
  codigoInforme: string;
  organismoControl: string;
  auditor: string;
  nroMemorando: string;
  fechaEmision: string;
  tituloInforme: string;
  conclusion: string;
  recomendacion: string;
  departamentos: string;
  estadoSeguimiento: string;
  fechaACumplir: string;
  progresoInforme: number;
}

export interface ReportOrgCtrlConteoEstados {
  organismoControl: string;
  totalRecomendaciones: number;
  recomendacionesEnProceso: number;
  recomendacionesCumplidas: number;
  recomendacionesNoCumplidas: number;
  recomendacionesNoAplica: number;
}

export interface ReportDptoConteoEstados {
  departamento: string;
  organismoControl: string;
  totalRecomendaciones: number;
  recomendacionesEnProceso: number;
  recomendacionesCumplidas: number;
  recomendacionesNoCumplidas: number;
  recomendacionesNoAplica: number;
}

export interface ReportTipoInforme {
  tipoInforme: string;
  cantidadRecomendacionesEnProceso: number;
  cantidadRecomendacionesCumplidas: number;
}

export interface ReportRecomendacionesDepartamento {
  departamento: string;
  informe: string;
  responsables: Responsable[];
  conclusiones: Conclusion[];
  recomendaciones: Recomendacion[];
  memorando_nro: string;
  organismo_control: string;
}

interface Responsable {
  nombres_apellidos: string;
}

interface Conclusion {
  texto: string;
}

interface Recomendacion {
  texto: string;
  fecha_a_cumplir: string;
}

export interface ReportHallazgos {
  tituloInforme: string;
  organismoControl: string;
  memorando: string;
  memoAprobacion: string;
  hallazgo: string;
  auditor: string;
}

export interface ReporteRecomendacionesFechaCorte {
  tituloInforme: string;
  auditorInforme: string;
  organismoControl: string;
  memoAuditoria: string;
  memoAprobacion: string;
  fechaMemo: string;
  fechaAprobacion: string;
  conclusion: string;
  recomendacion: string;
  riesgoVerificado?: string | null;
  evidenciaRequerida?: string | null;
  estadoRecomendacion: string;
  fechaRecomendacionCumplida: string;
  fechaMaximaCumplimiento: string;
  listaResponsables: string;
  listaDepartamentos: string;
  progresoRecomendacion?: number;
  progresoInforme?: number;
  numeroRecomendacion?: number;
  idInforme?: number | string;
  arere_codigo?: number;
  arereCodigo?: number;
}

export interface ReportRecomendacionesVencidasAIJ {
  tituloInforme: string;
  recomendacion: string;
  organismoControl: string;
  memorando: string;
  memoAprobacion: string;
  observacion: string;
  fechaEmision: string;
  fechaMaxima: string;
  plazo: number;
  auditor: string;
  responsables: string;
  arereCodigo: number;
}

export interface Report7Auditores {
  tituloInforme: string;
  recomendacion: string;
  enteControl: string;
  memorando: string;
  memoAprobacion: string;
  fechaEmision: string;
  fechaMaxima: string;
  auditor: string;
  responsables?: ResponsableReporte7[];
  arereCodigo: number;
}

export interface ResponsableReporte7 {
  nombreCompleto: string;
  observacion: string;
  fechaHoraCargaVerificable: string;
  fechaHoraCambioEstado: string;
  estadoVerificable: string;
}

export interface ReportGeneralAIJ {
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

export interface ReporteProrrogasAIJ {
  numeroRecomendacion: string;
  descripcionRecomendacion: string;
  fechaMaxima: string;
  estadoRecomendacion: string;
  responsable: string;
  departamento: string;
  estadoVerificable: string;
  totalProrrogas: number;
  prorrogas: ProrragaDetalle[];
  memoPresidencia: string;
  fechaAprobacion: string;
  auditor: string;
  tituloInforme: string;
  organismoControl: string;
  memoAuditoria?: string;
  fechaMemorando?: string;
  diasVencidos?: number;
  estadoPlazo?: string;
}

export interface ProrragaDetalle {
  fechaAnterior: string;
  nuevaFecha: string;
}

export interface ReporteProrrogasRealizadasAIJ {
  tituloInforme: string;
  numeroRecomendacion: number;
  descripcionRecomendacion: string;
  estadoRecomendacion: string;
  estadoVerificable: string;
  responsable?: string;
  realizadoPor: string;
  fechaCambio: string;
  fechaCambiada: string;
  fechaAnterior: string;
}

export interface ReportInformesRecomendaciones {
  codigoInforme?: number | string;
  tituloInforme: string;
  memorando: string;
  fechaEmision?: string;
  memoAprobacion: string;
  fechaAprobacion?: string;
  organismoControl: string;
  progresoInforme: number;
  totalRecomendaciones: number;
  recomendacionesEnProceso: number;
  recomendacionesCumplidas: number;
  recomendacionesNoCumplidas: number;
  recomendacionesNoAplica: number;
}