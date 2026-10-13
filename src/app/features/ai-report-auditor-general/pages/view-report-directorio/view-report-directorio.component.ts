import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportDirectorioComponent } from '@features/ai-report-auditor-general/components/table-report-directorio/table-report-directorio.component';


@Component({
  selector: 'app-view-report-directorio',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportDirectorioComponent],
  templateUrl: './view-report-directorio.component.html',
  styleUrl: './view-report-directorio.component.css'
})
export class ViewReportDirectorioComponent {

}
