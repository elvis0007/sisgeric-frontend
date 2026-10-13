import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableRecomendacionesVencidasOperativoComponent } from '@features/ai-report-auditor-operativo/components/table-recomendaciones-vencidas-operativo/table-recomendaciones-vencidas-operativo.component';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';

@Component({
  selector: 'app-view-recomendaciones-vencidas-operativo',
  standalone: true,
  imports: [CommonModule, BreadcrumbsComponent, TableRecomendacionesVencidasOperativoComponent, ModalResponsablesComponent],
  templateUrl: './view-recomendaciones-vencidas-operativo.component.html',
  styleUrl: './view-recomendaciones-vencidas-operativo.component.css'
})
export class ViewRecomendacionesVencidasOperativoComponent {

}

