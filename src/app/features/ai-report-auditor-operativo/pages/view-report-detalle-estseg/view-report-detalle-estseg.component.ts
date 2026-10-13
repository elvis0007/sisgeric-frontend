import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableDetalleEstSegComponent } from '@features/ai-report-auditor-operativo/components/table-detalle-est-seg/table-detalle-est-seg.component';

@Component({
  selector: 'app-view-report-detalle-estseg',
  standalone: true,
  imports: [BreadcrumbsComponent, TableDetalleEstSegComponent],
  templateUrl: './view-report-detalle-estseg.component.html',
  styleUrl: './view-report-detalle-estseg.component.css'
})
export class ViewReportDetalleEstsegComponent {

}
