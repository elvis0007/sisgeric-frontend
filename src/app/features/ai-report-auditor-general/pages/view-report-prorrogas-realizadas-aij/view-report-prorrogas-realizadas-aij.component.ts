import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportProrrogasRealizadasAijComponent } from '@features/ai-report-auditor-general/components/table-report-prorrogas-realizadas-aij/table-report-prorrogas-realizadas-aij.component';

@Component({
  selector: 'app-view-report-prorrogas-realizadas-aij',
  standalone: true,
  imports: [CommonModule, BreadcrumbsComponent, TableReportProrrogasRealizadasAijComponent],
  templateUrl: './view-report-prorrogas-realizadas-aij.component.html',
  styleUrl: './view-report-prorrogas-realizadas-aij.component.css'
})
export class ViewReportProrrogasRealizadasAijComponent {

}
