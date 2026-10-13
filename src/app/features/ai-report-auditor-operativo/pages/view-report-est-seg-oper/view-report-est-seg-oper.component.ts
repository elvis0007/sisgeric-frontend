import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableEstSegOperComponent } from '@features/ai-report-auditor-operativo/components/table-est-seg-oper/table-est-seg-oper.component';
@Component({
  selector: 'app-view-report-est-seg-oper',
  standalone: true,
  imports: [BreadcrumbsComponent, TableEstSegOperComponent],
  templateUrl: './view-report-est-seg-oper.component.html',
  styleUrl: './view-report-est-seg-oper.component.css'
})
export class ViewReportEstSegOperComponent {

}
