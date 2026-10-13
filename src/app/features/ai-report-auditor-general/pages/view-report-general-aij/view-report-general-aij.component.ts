import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportGeneralAijComponent } from '@features/ai-report-auditor-general/components/table-report-general-aij/table-report-general-aij.component';

@Component({
  selector: 'app-view-report-general-aij',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportGeneralAijComponent],
  templateUrl: './view-report-general-aij.component.html'
})
export class ViewReportGeneralAijComponent {}

