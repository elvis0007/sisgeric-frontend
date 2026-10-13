import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportVerificablesComponent } from '@features/ai-report-responsables/components/table-report-verificables/table-report-verificables.component';

@Component({
  selector: 'app-view-verificables',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportVerificablesComponent],
  templateUrl: './view-verificables.component.html',
  styleUrl: './view-verificables.component.css'
})
export class ViewVerificablesComponent {

}
