import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  isModalOpen = signal(false);
  modalData = signal<any>(null);

  openModal(data: any) {
    this.modalData.set(data);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.modalData.set(null);
  }
}
