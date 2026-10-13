import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableRecomendacionesVencidasResponsableComponent } from '@features/ai-report-responsables/components/table-recomendaciones-vencidas-responsable/table-recomendaciones-vencidas-responsable.component';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';

@Component({
  selector: 'app-view-recomendaciones-vencidas-responsable',
  standalone: true,
  imports: [CommonModule, BreadcrumbsComponent, TableRecomendacionesVencidasResponsableComponent, ModalResponsablesComponent],
  templateUrl: './view-recomendaciones-vencidas-responsable.component.html',
  styleUrl: './view-recomendaciones-vencidas-responsable.component.css'
})
export class ViewRecomendacionesVencidasResponsableComponent {

}

