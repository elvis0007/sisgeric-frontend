import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportPlanEvidenciasComponent } from '@features/ai-report-auditor-general/components/table-report-plan-evidencias/table-report-plan-evidencias.component';

@Component({
  selector: 'app-view-report-plan-evidencias',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportPlanEvidenciasComponent],
  templateUrl: './view-report-plan-evidencias.component.html'
})
export class ViewReportPlanEvidenciasComponent {}
