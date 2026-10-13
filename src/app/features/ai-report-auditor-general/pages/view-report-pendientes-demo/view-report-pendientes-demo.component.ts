import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportPendientesJerarquicoDemoComponent } from '@features/ai-report-auditor-general/components/table-report-pendientes-jerarquico-demo/table-report-pendientes-jerarquico-demo.component';

@Component({
  selector: 'app-view-report-pendientes-demo',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportPendientesJerarquicoDemoComponent],
  templateUrl: './view-report-pendientes-demo.component.html',
  styleUrl: './view-report-pendientes-demo.component.css'
})
export class ViewReportPendientesDemoComponent {

}
