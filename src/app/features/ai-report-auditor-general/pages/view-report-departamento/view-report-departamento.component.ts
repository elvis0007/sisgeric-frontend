import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportDptoComponent } from '@features/ai-report-auditor-general/components/table-report-dpto/table-report-dpto.component';

@Component({
  selector: 'app-view-report-departamento',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportDptoComponent],
  templateUrl: './view-report-departamento.component.html',
  styleUrl: './view-report-departamento.component.css'
})
export class ViewReportDepartamentoComponent {

}
