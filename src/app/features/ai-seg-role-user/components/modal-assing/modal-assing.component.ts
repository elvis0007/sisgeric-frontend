import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { ModalAssingService } from '@features/ai-seg-role-user/services/modal.assing.service';
import { TableUsersComponent } from '@features/ai-seg-role-user/components/table-users/table-users.component';

@Component({
  selector: 'app-modal-assing',
  standalone: true,
  imports: [CommonModule, TableUsersComponent],
  templateUrl: './modal-assing.component.html',
  styleUrl: './modal-assing.component.css',
})
export class ModalAssingComponent {

  protected modalAssingSrv: ModalAssingService = inject(ModalAssingService);
  protected data: any;

  constructor() {}

  protected closeModal(): void {
    this.modalAssingSrv.closeModal();
  }
}
