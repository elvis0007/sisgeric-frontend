import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-report-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-loading.component.html',
  styleUrl: './report-loading.component.css'
})
export class ReportLoadingComponent {
  @Input() message: string = 'Cargando información del reporte...';
  @Input() subtitle: string = 'Consultando recomendaciones y estados en tiempo real';
  @Input() showSkeleton: boolean = true;
  @Input() skeletonRows: number = 4;
}
