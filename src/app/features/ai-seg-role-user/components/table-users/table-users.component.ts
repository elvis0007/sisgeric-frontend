import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, effect, inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  PersonalInfoListado,
  UsuarioAsignadoRol,
} from '@features/ai-seg-role-user/models/user';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalAssingService } from '@features/ai-seg-role-user/services/modal.assing.service';
import { RoleUserService } from '@features/ai-seg-role-user/services/role-user.service';
import { UserService } from '@features/ai-seg-role-user/services/user.service';
import { ResponseReadMultipeEeasa } from '@shared/models/response-read';  
import { SearchFilterComponent } from '@features/ai-seg-role-user/components/search-filter/search-filter.component';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';

@Component({
  selector: 'app-table-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SearchFilterComponent,
    PaginationComponent
  ],
  templateUrl: './table-users.component.html',
  styleUrl: './table-users.component.css',
})
export class TableUsersComponent {
  private readonly alertsService = inject(AlertsStateService);
  protected userService: UserService = inject(UserService);
  protected roleUserService: RoleUserService = inject(RoleUserService);
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  protected modalAssingSrv: ModalAssingService = inject(ModalAssingService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected users: PersonalInfoListado[] = [];
  protected filteredUsers: PersonalInfoListado[] = [];
  protected displayedUsers: PersonalInfoListado[] = [];
  protected dataUsersCheck: UsuarioAsignadoRol[] = [];
  private currentDepartamento: string = '';
  private currentSearchTerm: string = '';
  protected isLoading: boolean = false;
  protected isLoadingAssign: boolean = false;

  constructor() {
    effect(() => {
      this.dataUsersCheck = this.modalAssingSrv.modalData();
      this.getUsers();
    });
  }

  private updateDisplayedUsers(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedUsers = this.filteredUsers.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  private getUsers() {
    this.isLoading = true;
    return this.userService.getPersonalInfo().subscribe({
      next: (response: ResponseReadMultipeEeasa<PersonalInfoListado>) => {
        if (this.dataUsersCheck && this.dataUsersCheck.length > 0) {
          this.users = response.DATA.map((user) => ({
            ...user,
            selected: this.dataUsersCheck.some(
              (userCheck) => userCheck.dsgus_cuenta === user.USUARIO
            ),
            isAssigned: this.dataUsersCheck.some(
              (userCheck) => userCheck.dsgus_cuenta === user.USUARIO
            ),
          }));
        } else {
          this.users = response.DATA;
        }
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.alertsService.showAlert('Error al cargar usuarios', 'error');
        this.isLoading = false;
      },
    });
  }

  protected asignarUsuarios(): void {
    const id: number = +atob(this.ruta.snapshot.paramMap.get('id')!);

    const selectedUsers = this.users.filter(
      (user) => user.selected && !user.isAssigned
    );
    
    if (selectedUsers.length === 0) {
      this.alertsService.showAlert('No hay usuarios seleccionados para asignar', 'warning');
      return;
    }

    this.isLoadingAssign = true;
    
    let completedRequests = 0;
    let hasErrors = false;
    console.log(selectedUsers);

    selectedUsers.forEach((usuario: PersonalInfoListado) => {
      this.roleUserService.assignRoleUser(id, usuario.CODIGO, usuario.USUARIO, usuario.EMAIL).subscribe(
        (response) => {
          completedRequests++;
          
          if (completedRequests === selectedUsers.length) {
            if (!hasErrors) {
              this.alertsService.showAlert('Usuarios asignados correctamente', 'success');
            }
            this.isLoadingAssign = false;
            this.modalAssingSrv.closeModal();
          }
        },
        (error) => {
          completedRequests++;
          hasErrors = true;
          this.alertsService.showAlert('Error al asignar usuarios', 'error');
          
          if (completedRequests === selectedUsers.length) {
            this.isLoadingAssign = false;
          }
        }
      );
    });
  }

  protected onFilterChanged(filterData: { departamento: string; search: string }) {
    this.currentDepartamento = filterData.departamento;
    this.currentSearchTerm = filterData.search;

    // Verificar si el campo de búsqueda está vacío
    if (this.currentSearchTerm === '') {
      // Si el campo de búsqueda está vacío, recargar solo los datos filtrados por departamento
      this.filteredUsers = this.users.filter(
        (user) =>
          this.currentDepartamento === '' ||
          user.DEPARTAMENTO === this.currentDepartamento
      );
    } else {
      // Aplicar los filtros normalmente (departamento + búsqueda)
      this.applyFilters();
    }

    // Actualizar los usuarios mostrados
    this.currentPage = 1;
    this.updateDisplayedUsers();
    this.cdr.detectChanges();
  }

  private applyFilters(): void {
    this.filteredUsers = this.users.filter((user) => {
      // Filtro por departamento
      const matchDepartamento =
        this.currentDepartamento === '' ||
        user.DEPARTAMENTO === this.currentDepartamento;

      // Filtro por búsqueda
      if (this.currentSearchTerm === '') {
        return matchDepartamento;
      }

      // Si el término de búsqueda contiene " - ", es una selección del dropdown
      if (this.currentSearchTerm.includes(' - ')) {
        const parts = this.currentSearchTerm.split(' - ');
        // El nombre está en la última parte, el cargo puede estar en las primeras partes
        const searchNombre = parts[parts.length - 1]?.trim() || '';
        const searchCargo = parts.slice(0, -1).join(' - ').trim();
        const userFullName = `${user.NOMBRES} ${user.APELLIDOS}`.trim();
        const userCargo = user.CARGO.trim();
        
        // Comparación más flexible: buscar coincidencia en cargo o nombre
        const matchCargo = searchCargo && userCargo.toLowerCase().includes(searchCargo.toLowerCase());
        const matchNombre = searchNombre && userFullName.toLowerCase().includes(searchNombre.toLowerCase());
        
        // Debe coincidir el nombre completo (más importante) y opcionalmente el cargo
        return matchDepartamento && matchNombre && (matchCargo || !searchCargo);
      } else {
        // Búsqueda libre por texto
        const searchLower = this.currentSearchTerm.toLowerCase();
        const matchCargo = user.CARGO.toLowerCase().includes(searchLower);
        const matchNombre = `${user.NOMBRES} ${user.APELLIDOS}`.toLowerCase().includes(searchLower);
        
        return matchDepartamento && (matchCargo || matchNombre);
      }
    });

    // Reiniciar la paginación y mostrar los usuarios filtrados
    this.currentPage = 1;
    this.updateDisplayedUsers();
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
