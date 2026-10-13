import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportProrrogasAijComponent } from '@features/ai-report-auditor-general/components/table-report-prorrogas-aij/table-report-prorrogas-aij.component';

@Component({
  selector: 'app-view-report-prorrogas-aij',
  standalone: true,
  imports: [CommonModule, BreadcrumbsComponent, TableReportProrrogasAijComponent],
  templateUrl: './view-report-prorrogas-aij.component.html',
  styleUrl: './view-report-prorrogas-aij.component.css'
})
export class ViewReportProrrogasAijComponent {

}
