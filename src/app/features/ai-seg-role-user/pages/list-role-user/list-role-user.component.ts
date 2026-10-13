import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { InputComponent } from '@core/ui/input/input.component';
import { ModalAssingComponent } from '@features/ai-seg-role-user/components/modal-assing/modal-assing.component';
import { ModalEditDirectorComponent } from '@features/ai-seg-role-user/components/modal-edit-director/modal-edit-director.component';
import { TableRoleUserComponent } from '@features/ai-seg-role-user/components/table-role-user/table-role-user.component';
import { RolUsuario } from '@features/ai-seg-role-user/models/role-user';
import { UsuarioAsignadoRol } from '@features/ai-seg-role-user/models/user';
import { ModalAssingService } from '@features/ai-seg-role-user/services/modal.assing.service';
import { RoleUserService } from '@features/ai-seg-role-user/services/role-user.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-list-role-user',
  standalone: true,
  imports: [
    TableRoleUserComponent,
    InputComponent,
    CommonModule,
    ModalAssingComponent,
    ModalEditDirectorComponent,
  ],
  templateUrl: './list-role-user.component.html',
  styleUrl: './list-role-user.component.css',
})
export class ListRoleUserComponent implements OnInit, OnDestroy {
  @ViewChild(InputComponent) searchInput!: InputComponent;
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly modalAssingSrv: ModalAssingService =
    inject(ModalAssingService);
  private readonly alertsService = inject(AlertsStateService);
  protected users: UsuarioAsignadoRol[] = [];
  protected filteredUsers: UsuarioAsignadoRol[] = [];
  private readonly rolSrv: RoleUserService = inject(RoleUserService);
  protected descriptionRole: string = '';
  protected isLoading: boolean = false;
  protected roleId: number = 0;
  private updateSubscription!: Subscription;

  ngOnInit(): void {
    this.getData();
    this.updateSubscription = this.rolSrv.updateData.subscribe(() => {
      this.getData();
    });
  }

  ngOnDestroy(): void {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
    }
  }

  private getData(): void {
    this.isLoading = true;
    const id: number = +atob(this.ruta.snapshot.paramMap.get('id')!);
    this.roleId = id;
    this.rolSrv.getRolesUsers(id).subscribe({
      next: (response: ResponseReadSimple<RolUsuario>) => {
        this.users = response.datos.usuarios;
        this.descriptionRole = response.datos.asero_descripcion;
        this.filteredUsers = this.users;
        this.isLoading = false;
      },
      error: (error) => {
        this.alertsService.showAlert('Error al obtener los usuarios', 'error');
        this.isLoading = false;
      },
    });
  }

  protected filterUsers(): void {
    const searchTerm = this.searchInput.value.toLowerCase();
    if (searchTerm) {
      this.filteredUsers = this.users.filter((user) =>
        user.nombre_completo.toLowerCase().includes(searchTerm)
      );
    } else {
      // Si el input está vacío, recarga los usuarios completos
      this.filteredUsers = [...this.users];
    }
  }

  protected openModal(): void {
    this.modalAssingSrv.openModal(this.users, this.descriptionRole);
  }
}
