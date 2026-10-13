import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableEstSegRespComponent } from '@features/ai-report-auditor-operativo/components/table-est-seg-resp/table-est-seg-resp.component';

@Component({
  selector: 'app-view-report-est-seg-resp',
  standalone: true,
  imports: [BreadcrumbsComponent, TableEstSegRespComponent],
  templateUrl: './view-report-est-seg-resp.component.html',
  styleUrl: './view-report-est-seg-resp.component.css'
})
export class ViewReportEstSegRespComponent {}
