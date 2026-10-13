import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ModalSolicitudesService {
  isModalOpen = signal(false);
  private data = signal<any>(null);

  getModalData() {
    return this.data();
  }

  openModal(data: any) {
    this.data.set(data);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.data.set(null);
  }
}
