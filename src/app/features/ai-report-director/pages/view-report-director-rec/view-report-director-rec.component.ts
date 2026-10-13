import { Component, inject, OnInit } from '@angular/core';
import { TableReportDirectorRecComponent } from '@features/ai-report-director/components/table-report-director-rec/table-report-director-rec.component';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-view-report-director-rec',
  standalone: true,
  imports: [BreadcrumbsComponent, TableReportDirectorRecComponent],
  templateUrl: './view-report-director-rec.component.html',
  styleUrl: './view-report-director-rec.component.css'
})
export class ViewReportDirectorRecComponent implements OnInit {
  private readonly auxiliaryService = inject(AuxiliaryService);
  protected departamento: string = '';

  ngOnInit(): void {
    this.departamento = this.auxiliaryService.getUserInfo().departamento;
  }

}
