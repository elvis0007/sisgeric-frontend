import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportEstSegComponent } from '@features/ai-report-auditor-general/components/table-report-est-seg/table-report-est-seg.component';

@Component({
  selector: 'app-view-report-est-seg',
  standalone: true,
  imports: [CommonModule, BreadcrumbsComponent, TableReportEstSegComponent],
  templateUrl: './view-report-est-seg.component.html',
  styleUrl: './view-report-est-seg.component.css'
})
export class ViewReportEstSegComponent {

}
