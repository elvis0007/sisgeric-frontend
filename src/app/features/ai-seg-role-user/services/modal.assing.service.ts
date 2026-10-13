import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ModalAssingService {
  isModalOpen = signal(false);
  modalData = signal<any>(null);
  roleDescription = signal<string>('');

  openModal(data: any, roleDescription: string = '') {
    this.modalData.set(data);
    this.roleDescription.set(roleDescription);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.modalData.set(null);
    this.roleDescription.set('');
  }
}
