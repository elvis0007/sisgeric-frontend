import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModalAddResponsablesService {

  isModalOpen = signal(false);
  private data = signal<any>(null);
  private operationType = signal<'assing' | 'replace'>('assing');

  modalData() {
    return this.data();
  }

  getOperationType() {
    return this.operationType();
  }

  openModal(data: any, type: 'assing' | 'replace') {
    this.data.set(data);
    this.isModalOpen.set(true);
    this.operationType.set(type);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.data.set(null);
    this.operationType.set('assing');
  }
}
