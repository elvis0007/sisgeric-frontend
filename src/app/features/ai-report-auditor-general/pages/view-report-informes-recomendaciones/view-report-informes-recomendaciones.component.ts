import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportInformesRecomendacionesComponent } from '@features/ai-report-auditor-general/components/table-report-informes-recomendaciones/table-report-informes-recomendaciones.component';

@Component({
  selector: 'app-view-report-informes-recomendaciones',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportInformesRecomendacionesComponent],
  templateUrl: './view-report-informes-recomendaciones.component.html',
  styleUrl: './view-report-informes-recomendaciones.component.css'
})
export class ViewReportInformesRecomendacionesComponent {

}
