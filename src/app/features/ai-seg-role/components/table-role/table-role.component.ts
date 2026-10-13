import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { Router } from '@angular/router';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Rol } from '@features/ai-seg-role/models/role';
import { ModalService } from '@features/ai-seg-role/services/modal.service';

@Component({
  selector: 'app-table-role',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './table-role.component.html',
  styleUrl: './table-role.component.css',
})
export class TableRoleComponent implements OnChanges {
  @Input() roles: Rol[] = [];
  protected modalService: ModalService = inject(ModalService);
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  private readonly router = inject(Router);

  protected displayedRoles: Rol[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['roles'] && changes['roles'].currentValue) {
      this.updateDisplayedRoles();
    }
  }
  
  private updateDisplayedRoles(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedRoles = this.roles.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }
  
  protected abrirModalEditar(rol: Rol | null): void {
    this.modalService.openModal(rol);
  }

  protected redireccionPagina(id: number): void {
    this.router.navigate([
      'inicio/roles/rol-usuario',
      btoa(id.toString())
    ]);
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedRoles();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedRoles();
  }
}
