import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { TableDepartamentoFechasVencidasComponent } from '@features/ai-report-director/components/table-departamento-fechas-vencidas/table-departamento-fechas-vencidas.component';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ModalResponsablesComponent } from '@features/ai-seguim-recomendaciones/components/modal-responsables/modal-responsables.component';

@Component({
  selector: 'app-view-departamento-fechas-vencidas',
  standalone: true,
  imports: [CommonModule, BreadcrumbsComponent, TableDepartamentoFechasVencidasComponent, ModalResponsablesComponent],
  templateUrl: './view-departamento-fechas-vencidas.component.html',
  styleUrl: './view-departamento-fechas-vencidas.component.css'
})
export class ViewDepartamentoFechasVencidasComponent implements OnInit {
  private readonly auxiliaryService = inject(AuxiliaryService);
  protected departamento: string = '';

  ngOnInit(): void {
    this.departamento = this.auxiliaryService.getUserInfo().departamento;
  }
}

