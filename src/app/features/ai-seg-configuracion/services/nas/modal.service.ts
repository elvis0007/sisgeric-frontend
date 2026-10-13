import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  isModalOpen = signal(false);
  modalData = signal<any>(null);
  configurationUpdated = signal(false);

  constructor() {}

  openModal(data: any) {
    this.modalData.set(data);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.modalData.set(null);
  }

  notifyConfigurationUpdated() {
    this.configurationUpdated.set(true);
    // Reset the signal after a short delay to allow components to react
    setTimeout(() => {
      this.configurationUpdated.set(false);
    }, 100);
  }
}
