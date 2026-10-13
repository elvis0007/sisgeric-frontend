import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Conclusion } from '@features/ai-seguim-auditor-general/models/conclusion-ag';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-table-conclusiones-ag',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './table-conclusiones-ag.component.html',
  styleUrl: './table-conclusiones-ag.component.css',
})
export class TableConclusionesAgComponent implements OnChanges {
  @Input() conclusiones: Conclusion[] = [];

  protected readonly auxiliarSrv = inject(AuxiliaryService);
  private readonly router = inject(Router);

  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedConclusiones: Conclusion[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conclusiones'] && changes['conclusiones'].currentValue) {
      this.currentPage = 1;
      this.updateDisplayedConclusiones();
    }
  }

  private updateDisplayedConclusiones(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedConclusiones = this.conclusiones.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedConclusiones();
  }
  
  protected redireccionPagina(id: number): void {
    const idHall: number = this.auxiliarSrv.getUrlParameter('id_inf');
    const idCon: number = this.auxiliarSrv.getUrlParameter('id_hal');
    
    this.router
      .navigate([
        'inicio/auditor-general/hallazgos-auditor-gen',
        btoa(idHall.toString()),
        'conclusiones-auditor-gen',
        btoa(idCon.toString()),
        'recomendaciones-auditor-gen',
        btoa(id.toString()),
      ])
      .catch((error) => {
        console.error('Error en navegación', error);
      });
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedConclusiones();
  }
}
