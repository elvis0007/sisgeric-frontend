import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableDptoConteoEstComponent } from '@features/ai-report-auditor-general/components/table-dpto-conteo-est/table-dpto-conteo-est.component';

@Component({
  selector: 'app-view-report-dpto-conteo',
  standalone: true,
  imports: [BreadcrumbsComponent, TableDptoConteoEstComponent],
  templateUrl: './view-report-dpto-conteo.component.html',
  styleUrl: './view-report-dpto-conteo.component.css'
})
export class ViewReportDptoConteoComponent {

}
