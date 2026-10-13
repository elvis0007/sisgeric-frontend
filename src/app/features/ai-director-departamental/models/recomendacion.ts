export interface DetalleRecomendacion {
    ainin_codigo: number;
    ainin_orden_trabajo: string;
    ainin_memorando: string;
    ainin_memo_aprobacion: string;
    ainoc_descripcion: string;
    ainin_titulo: string;
    recomendaciones: Recomendacion;
  }
  
  export interface Recomendacion {
    aredr_codigo: number;
    arere_codigo: number;
    arere_num_rec: number;
    arere_progreso: number;
    arere_descripcion: string;
    arere_fecha_inicio_control: string;
    arere_fecha_maxima: string;
    arere_num_prorroga: number;
    plazo: number;
    estado_seguimiento: EstadoSeg;
    motivo_estado: string;
    responsables: number;
  }

  export interface EstadoSeg {
    arees_codigo: number;
    arees_descripcion: string;
  }
  