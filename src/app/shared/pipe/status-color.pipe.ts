import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statusColor',
  standalone: true,
})
export class StatusColorPipe implements PipeTransform {
  transform(status: string): { [klass: string]: boolean } {
    return {
      'bg-blue-900/80':
        status === 'EN PROCESO' ||
        status === 'APROBADO PARCIAL' ||
        status === 'PENDIENTE', // Celeste-Azul
      'bg-amber-900/80':
        status === 'NO APLICA' || status === 'PENDIENTE', // Amarillo-Crema
      'bg-emerald-900/80':
        status === 'CUMPLIDA' ||
        status === 'APROBADO' ||
        status === 'JUSTIFICA', // Verde
      'bg-orange-900/80':
        status === 'NO CUMPLIDA' || status === 'NO JUSTIFICA'|| status === 'NO APROBADO', // Rojo-Anaranjado
      'bg-amber-600/90':
        status === 'PENDIENTE DE REVISIÓN' ||
        status === 'PENDIENTE DE REVISION' ||
        (!!status && status.toUpperCase().includes('REVISI')), // Ámbar / Pendiente de revisión
      'bg-purple-900/80':
        status === 'VERIFICABLE NO CREADO' ||
        status === 'SIN VERIFICABLE', // Morado
      'bg-sky-800/80':
        status === 'ADICIONAL' || status === 'Adicional', // Celeste / Azul claro
      '!text-white': true,
    };
  }
}
