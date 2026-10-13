import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportTipoinfComponent } from '@features/ai-report-auditor-general/components/table-report-tipoinf/table-report-tipoinf.component';

@Component({
  selector: 'app-view-report-tipoinf',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportTipoinfComponent],
  templateUrl: './view-report-tipoinf.component.html',
  styleUrl: './view-report-tipoinf.component.css'
})
export class ViewReportTipoinfComponent {

}
