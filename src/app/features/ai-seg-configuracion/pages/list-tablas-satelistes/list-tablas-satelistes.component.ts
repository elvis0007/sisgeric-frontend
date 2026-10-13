import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { TableEstadoSegComponent } from '@features/ai-seg-configuracion/components/estado-seg/table-estado-seg/table-estado-seg.component';
import { TableTipoInformeComponent } from '@features/ai-seg-configuracion/components/tipo-informe/table-tipo-informe/table-tipo-informe.component';
import { TableOrganismoComponent } from '@features/ai-seg-configuracion/components/organismo-control/table-organismo/table-organismo.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-list-tablas-satelistes',
  standalone: true,
  imports: [
    CommonModule,
    BreadcrumbsComponent,
    TableEstadoSegComponent,
    TableTipoInformeComponent,
    TableOrganismoComponent
  ],
  templateUrl: './list-tablas-satelistes.component.html',
  styleUrl: './list-tablas-satelistes.component.css',
})
export class ListTablasSatelistesComponent {
  protected currentTab: number = 2;

  protected switchTab(tabIndex: number): void {
    this.currentTab = tabIndex;
  }

}
