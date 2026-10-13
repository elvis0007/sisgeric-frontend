import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ModalResponsablesService {
  isModalOpen = signal(false);
  private data = signal<any>(null);
  isCumplida = signal(false);

  modalData() {
    return this.data();
  }

  openModal(data: any, isCumplida: boolean = false) {
    this.data.set(data);
    this.isCumplida.set(isCumplida);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.data.set(null);
    this.isCumplida.set(false);
  }
}
