import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportRecRespComponent } from '@features/ai-report-responsables/components/table-report-rec-resp/table-report-rec-resp.component';

@Component({
  selector: 'app-view-recom-responsable',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportRecRespComponent],
  templateUrl: './view-recom-responsable.component.html',
  styleUrl: './view-recom-responsable.component.css'
})
export class ViewRecomResponsableComponent {

}
