import { Injectable, signal, WritableSignal } from '@angular/core';
import { UsuarioAsignadoRol } from '@features/ai-seg-role-user/models/user';

@Injectable({
  providedIn: 'root',
})
export class ModalEditService {
  isModalOpen = signal(false);
  modalData = signal<{ user: UsuarioAsignadoRol; roleId: number } | null>(null);

  openModal(user: UsuarioAsignadoRol, roleId: number) {
    this.modalData.set({ user, roleId });
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.modalData.set(null);
  }
}

