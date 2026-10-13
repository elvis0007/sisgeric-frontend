import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableOrgctrlConteoEstComponent } from '@features/ai-report-auditor-general/components/table-orgctrl-conteo-est/table-orgctrl-conteo-est.component';
@Component({
  selector: 'app-view-report-orgctrl-conteo',
  standalone: true,
  imports: [BreadcrumbsComponent, TableOrgctrlConteoEstComponent],
  templateUrl: './view-report-orgctrl-conteo.component.html',
  styleUrl: './view-report-orgctrl-conteo.component.css'
})
export class ViewReportOrgctrlConteoComponent {

}
