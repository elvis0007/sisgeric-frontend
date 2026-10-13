import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReportProgresoRecComponent } from '@features/ai-report-responsables/components/table-report-progreso-rec/table-report-progreso-rec.component';

@Component({
  selector: 'app-view-progreso-recom',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportProgresoRecComponent],
  templateUrl: './view-progreso-recom.component.html',
  styleUrl: './view-progreso-recom.component.css'
})
export class ViewProgresoRecomComponent {

}
