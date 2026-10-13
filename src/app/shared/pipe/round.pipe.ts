import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'round',
  standalone: true,
})
export class RoundPipe implements PipeTransform {
  transform(value: number, decimals: number = 2): number {
    if (value == null) {
      return 0;
    }
    return parseFloat(value.toFixed(decimals));
  }
}
