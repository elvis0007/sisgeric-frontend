import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnChanges,
  OnInit,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { ModalFormComponent } from '@features/ai-seg-configuracion/components/organismo-control/modal-form/modal-form.component';
import {
  OrganismoControl,
  OrganismoControlWrite,
} from '@features/ai-seg-configuracion/models/Organismo-Control';
import { ModalService } from '@features/ai-seg-configuracion/services/organismo-control/modal.service';
import { OrganismoControlService } from '@features/ai-seg-configuracion/services/organismo-control/organismo-control.service';
import { ResponseReadMultiple } from '@shared/models/response-read';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-table-organismo',
  standalone: true,
  imports: [CommonModule, ModalFormComponent, PaginationComponent],
  templateUrl: './table-organismo.component.html',
  styleUrl: './table-organismo.component.css',
})
export class TableOrganismoComponent implements OnChanges, OnInit, OnDestroy {
  protected modalService: ModalService = inject(ModalService);
  protected readonly organismoSrv: OrganismoControlService = inject(
    OrganismoControlService
  );
  protected readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];
  
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected organismos: OrganismoControl[] = [];
  protected displayedOrganismos: OrganismoControl[] = [];
  private organismoEliminar!: OrganismoControl;
  protected isLoading = false;
  
  ngOnInit(): void {
    this.getDataOrganismos();
  }
  
  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['organismos'] && changes['organismos'].currentValue) {
      this.updateDisplayedOrganismos();
    }
  }

  private updateDisplayedOrganismos(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedOrganismos = this.organismos.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  private getDataOrganismos(): void {
    this.isLoading = true;
    this.organismoSrv.getOrganismos().subscribe({
      next: (response: ResponseReadMultiple<OrganismoControl>) => {
        this.organismos = response.datos;
        this.updateTable();
        this.isLoading = false;
      },
      error: (err) => {
        this.alertsService.showAlert(
          'Error al obtener la información',
          'error'
        );
        this.isLoading = false;
      },
    });
  }

  private updateTable(): void {
    this.updateDisplayedOrganismos();
  }

  reloadTable() {
    this.getDataOrganismos();
  }

  protected openModalForm(organismo: OrganismoControlWrite | null) {
    if (organismo === null) {
      this.modalService.openModal(null);
    } else {
      this.modalService.openModal(organismo, 'edit');
    }
  }

  protected openModalConf(organismo: OrganismoControl) {
    this.organismoEliminar = organismo;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de eliminar el Ente de Control ${organismo.ainoc_descripcion} ?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteOrganismo(organismo);
    });
    
    this.subscriptions.push(subscription);
  }

  protected deleteOrganismo(organismo: OrganismoControl): void {
    this.organismoSrv.deleteOrganismo(organismo).subscribe({
      next: (response) => {
        this.reloadTable();
        this.alertsService.showAlert(response.mensaje, 'success');
      },
      error: (err) => {
        this.alertsService.showAlert(err.message, 'error');
      },
    });
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedOrganismos();
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedOrganismos();
  }
}
