import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportFechaCorteComponent } from '@features/ai-report-auditor-general/components/table-report-fecha-corte/table-report-fecha-corte.component';

@Component({
  selector: 'app-view-report-fecha-corte',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportFechaCorteComponent],
  templateUrl: './view-report-fecha-corte.component.html',
  styleUrl: './view-report-fecha-corte.component.css'
})
export class ViewReportFechaCorteComponent {

}
