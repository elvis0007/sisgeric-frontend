import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportHallazgosComponent } from '@features/ai-report-auditor-general/components/table-report-hallazgos/table-report-hallazgos.component';

@Component({
  selector: 'app-view-report-hallazgos',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportHallazgosComponent],
  templateUrl: './view-report-hallazgos.component.html',
  styleUrl: './view-report-hallazgos.component.css'
})
export class ViewReportHallazgosComponent {

}
