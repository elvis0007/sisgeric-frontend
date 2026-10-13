import { CommonModule } from '@angular/common';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { UsuarioAsignadoRol } from '@features/ai-seg-role-user/models/user';
import { RoleUserService } from '@features/ai-seg-role-user/services/role-user.service';
import { ModalEditService } from '@features/ai-seg-role-user/services/modal-edit.service';
import { ResponseWrite } from '@shared/models/response-write';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-table-role-user',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './table-role-user.component.html',
  styleUrl: './table-role-user.component.css',
})
export class TableRoleUserComponent implements OnChanges, OnInit, OnDestroy {
  @Input() users: UsuarioAsignadoRol[] = [];
  @Input() roleId: number = 0;
  protected roleUserSrv: RoleUserService = inject(RoleUserService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private readonly modalEditSrv = inject(ModalEditService);
  private subscriptions: Subscription[] = [];

  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedUsuario: UsuarioAsignadoRol[] = [];
  // Comenzamos con orden descendente
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  // Guardar el orden original si es necesario
  private originalOrder: UsuarioAsignadoRol[] = [];

  private userEliminar!: UsuarioAsignadoRol;
  protected readonly ROL_DIRECTOR = 5;
  
  ngOnInit() {
  }

  ngOnDestroy() {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['users'] && changes['users'].currentValue) {
      // Solo ordenamos si estamos recibiendo un array de usuarios con datos
      if (this.users && this.users.length > 0) {
        // Guardar una copia del orden original al recibir nuevos datos
        this.originalOrder = [...this.users];
        // Aplicar el ordenamiento descendente por defecto
        this.ordenFecha = 'desc';
        this.aplicarOrdenamiento();
      }
      this.updateDisplayedUsers();
    }
  }

  protected ordenarPorFecha(): void {
    // Simplificar: solo alternar entre asc y desc
    this.ordenFecha = this.ordenFecha === 'desc' ? 'asc' : 'desc';
    
    // Aplicar el ordenamiento basado en el nuevo estado
    this.aplicarOrdenamiento();
    
    // Actualizar la visualización
    this.currentPage = 1;
    this.updateDisplayedUsers();
  }

  private aplicarOrdenamiento(): void {
    // Solo ordenar si hay datos que ordenar
    if (!this.users || this.users.length === 0) return;

    // Ordenar los usuarios según el estado actual
    if (this.ordenFecha === 'asc') {
      // Ordenamiento ascendente (de más antiguo a más reciente)
      this.users.sort((a, b) => {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        return fechaA - fechaB;
      });
    } else {
      // Ordenamiento descendente (de más reciente a más antiguo)
      this.users.sort((a, b) => {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        return fechaB - fechaA;
      });
    }
  }

  protected openModal(user: UsuarioAsignadoRol) {
    // Si es director (rol 5), abrir modal de edición
    if (this.roleId === this.ROL_DIRECTOR) {
      this.modalEditSrv.openModal(user, this.roleId);
    } else {
      // Para otros roles, mostrar modal de confirmación de eliminación
      this.userEliminar = user;
      const actionId = this.modalConfirmationService.show({
        title: '¿Estás seguro?',
        message: `¿Quieres eliminar el usuario ${user.nombre_completo} ? `,
        confirmText: 'CONFIRMAR',
        cancelText: 'CANCELAR'
      });
      
      const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
        this.deleteUserAssing(user);
      });
      
      this.subscriptions.push(subscription);
    }
  }

  private updateDisplayedUsers(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedUsuario = this.users.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected deleteUserAssing(user: UsuarioAsignadoRol): void {
    this.roleUserSrv.deleteRoleUser(user).subscribe({
      next: (data: ResponseWrite) => {
        this.alertsService.showAlert('Usuario eliminado del rol', 'success');
      },
      error: (err) => {
        this.alertsService.showAlert('Error al eliminar', 'error');
      },
    });
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedUsers();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedUsers();
  }
}
