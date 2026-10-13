import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Hallazgo } from '@features/ai-seguim-auditor-general/models/hallazgo-ag';
import { HallazgosAgService } from '@features/ai-seguim-auditor-general/services/hallazgos-ag/hallazgos-ag.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-table-hallazgos-ag',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './table-hallazgos-ag.component.html',
  styleUrl: './table-hallazgos-ag.component.css',
})
export class TableHallazgosAgComponent implements OnChanges {
  @Input() hallazgos: Hallazgo[] = [];
  protected hallazgoSrv: HallazgosAgService = inject(HallazgosAgService);
  private readonly router = inject(Router);
  protected readonly auxiliarSrv = inject(AuxiliaryService);

  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedHallazgos: Hallazgo[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hallazgos'] && changes['hallazgos'].currentValue) {
      this.currentPage = 1;
      this.updateDisplayedHallazgos();
    }
  }

  private updateDisplayedHallazgos(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedHallazgos = this.hallazgos.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedHallazgos();
  }

  protected redireccionPagina(id: number): void {
    const idInf: number = this.auxiliarSrv.getUrlParameter('id_inf');
    this.router.navigate([
      'inicio/auditor-general/hallazgos-auditor-gen', btoa(idInf.toString()), 'conclusiones-auditor-gen',
      btoa(id.toString())
    ]).catch(error => {
      console.error('Error en navegación', error);
    });
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedHallazgos();
  }
}
