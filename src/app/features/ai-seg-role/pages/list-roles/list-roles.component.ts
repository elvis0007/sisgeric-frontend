import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { NgZone } from '@angular/core';
import { TableRoleComponent } from '@features/ai-seg-role/components/table-role/table-role.component';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ModalService } from '@features/ai-seg-role/services/modal.service';
import { ModalCreateEditComponent } from '@features/ai-seg-role/components/modal-create-edit/modal-create-edit.component';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { BreadcrumbsComponent } from '@core/ui/breadcrumbs/breadcrumbs.component';
import { Rol } from '@features/ai-seg-role/models/role';
import { RoleService } from '@features/ai-seg-role/services/role.service';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-list-roles',
  standalone: true,
  imports: [
    TableRoleComponent,
    RouterOutlet,
    CommonModule,
    ModalCreateEditComponent,
    BreadcrumbsComponent,
  ],
  templateUrl: './list-roles.component.html',
  styleUrl: './list-roles.component.css',
})
export class ListRolesComponent implements OnInit, OnDestroy {
  private readonly alertsService = inject(AlertsStateService);
  protected modalService: ModalService = inject(ModalService);
  private readonly rolSrv: RoleService = inject(RoleService);
  private readonly ngZone = inject(NgZone);
  
  protected rutaHijaActiva: boolean = false;
  protected roles: Rol[] = [];
  protected isLoading: boolean = false;
  private updateSubscription!: Subscription;

  ngOnInit(): void {
    this.getDataRoles();
    this.updateSubscription = this.rolSrv.updateData.subscribe(() => {
      this.getDataRoles();
    });
  }

  ngOnDestroy(): void {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
    }
  }

  private getDataRoles(): void {
    this.isLoading = true;
    
    this.rolSrv.getRoles().subscribe({
      next: (response: ResponseReadMultiple<Rol>) => {
        this.roles = response.datos;
        this.isLoading = false;
      },
      error: (err) => {
        this.alertsService.showAlert("Error al obtener la información", "error");
        this.isLoading = false;
      },
    });
  }

  protected enActivacionRutaHija(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.rutaHijaActiva = true;
      });
    });
  }

  protected enDesactivacionRutaHija(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.rutaHijaActiva = false;
      });
    });
  }
}
