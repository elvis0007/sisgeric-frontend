export interface InformeHallazgos {
  ainin_codigo: number;
  ainin_titulo: string;
  ainin_orden_trabajo: string;
  hallazgos: Hallazgo[];
}

export interface Hallazgo {
  areha_codigo: number;
  areha_titulo: string;
  ainin_codigo?: number;
  totalConclusiones?: number;
}

export interface HallazgoEscritura {
  areha_codigo: number;
  ainin_codigo?: number;
  areha_titulo: string;
}
