export interface ChartDonut {
  cantRecIngreUltimoMes: number;
  cantRecPendientesAprobacion: number;
  departamentos: DepartamentoDonut[];
  general?: {
    enProceso: number;
    cumplidas: number;
    noCumplidas: number;
    noAplica: number;
  };
  totalesGlobales?: {
    totalRecomendaciones: number;
    enProceso: number;
    cumplidas: number;
    noCumplidas: number;
    noAplica: number;
  };
}

interface DepartamentoDonut {
  departamento: string;
  totalRecomendaciones: number;
  enProceso: number;
  cumplidas: number;
  noCumplidas: number;
  noAplica: number;
}

export interface ChartBarDpto {
  anios: AnioDpto[];
}

// Modelo para el chart de barras por departamento
interface AnioDpto {
  anio: string;
  departamentos: Departamentos;
}

interface Departamentos {
  [nombreDpto: string]: DepartamentoData;
}

interface DepartamentoData {
  totalRecomendaciones: number;
  enProceso: number;
  cumplidas: number;
  noCumplidas: number;
  noAplica: number;
  departamentoAbrev: string;
}

export interface ChartBarAnio {
  anios: Anio[];
}

interface Anio {
  anio: string;
  detalles: DetallesAnio;
}

interface DetallesAnio {
  totalRecomendaciones: number;
  enProceso: number;
  cumplidas: number;
  noCumplidas: number;
  noAplica: number;
}

export interface ChartList {
  anios: AnioList[];
}

interface AnioList {
  anio: string;
  codigoInformes: CodigoInformes[];
}
interface CodigoInformes {
  [codigo: string]: DetallesInforme;
}

interface DetallesInforme {
  tituloInforme: string;
  totalRecomendaciones: number;
  enProceso: number;
  cumplidas: number;
  noCumplidas: number;
  noAplica: number;
}

export interface MetricasResponsable {
  recomendacionesPendientes: number;
  solicitudesPendientesAprobacion: number;
  recomendacionesVencidasSinJustificar: number; // sin justificar (estado 1 o 3 o NULL)
  recomendacionesVencidasJustificadas: number; // justificadas (estado 2)
  verificablesPendientes: number;
}

export interface ChartListAiJefe{
  departamentos: Departamento[];
}

interface Departamento{
  departamento: string;
  codigoInformes: {
    [codigo: string]: {
      totalRecomendaciones: number;
      enProceso: number;
      cumplidas: number;
      noCumplidas: number;
      noAplica: number;
    };
  };
}
