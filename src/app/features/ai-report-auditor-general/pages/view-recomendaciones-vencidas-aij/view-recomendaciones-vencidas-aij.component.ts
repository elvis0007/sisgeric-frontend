import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableRecomendacionesVencidasAijComponent } from '@features/ai-report-auditor-general/components/table-recomendaciones-vencidas-aij/table-recomendaciones-vencidas-aij.component';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';

@Component({
  selector: 'app-view-recomendaciones-vencidas-aij',
  standalone: true,
  imports: [CommonModule, BreadcrumbsComponent, TableRecomendacionesVencidasAijComponent, ModalResponsablesComponent],
  templateUrl: './view-recomendaciones-vencidas-aij.component.html',
  styleUrl: './view-recomendaciones-vencidas-aij.component.css'
})
export class ViewRecomendacionesVencidasAijComponent {

}

