import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableReport7AuditoresComponent } from '@features/ai-report-auditor-general/components/table-report7-auditores/table-report7-auditores.component';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';

@Component({
  selector: 'app-view-report7-auditores',
  standalone: true,
  imports: [CommonModule, BreadcrumbsComponent, TableReport7AuditoresComponent, ModalResponsablesComponent],
  templateUrl: './view-report7-auditores.component.html',
  styleUrl: './view-report7-auditores.component.css'
})
export class ViewReport7AuditoresComponent {

}

