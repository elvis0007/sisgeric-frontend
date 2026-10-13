import { Injectable } from '@angular/core';

export enum EstadoSolicitud {
  Pendiente = '1',
  AprobadoParcial = '2',
  Aprobado = '3',
  NoAprobado = '4',
}

@Injectable({
  providedIn: 'root',
})
export class EstadoSolicitudUtil {
  estados = [
    { label: 'PENDIENTE', value: EstadoSolicitud.Pendiente },
    { label: 'APROBADO PARCIAL', value: EstadoSolicitud.AprobadoParcial },
    { label: 'APROBADO', value: EstadoSolicitud.Aprobado },
    { label: 'NO APROBADO', value: EstadoSolicitud.NoAprobado },
  ];

  getEstados() {
    return this.estados;
  }

  getEstadoLabel(value: string): string {
    return (
      this.estados.find((estado) => estado.value === value)?.label ||
      'Desconocido'
    );
  }
}
