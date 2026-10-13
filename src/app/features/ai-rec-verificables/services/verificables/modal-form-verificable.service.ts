import { Injectable, signal } from '@angular/core';
import { Verificable } from '@features/ai-rec-verificables/models/Verificable';

@Injectable({
  providedIn: 'root',
})
export class ModalFormVerificableService {
  isModalOpen = signal(false);
  private data = signal<any>(null);
  private operationType = signal<'create' | 'edit' | 'adicional'>('create');

  modalData() {
    return this.data();
  }

  getOperationType() {
    return this.operationType();
  }

  openModal(data: Verificable | null, type: 'create' | 'edit' | 'adicional' = 'create') {
    this.data.set(data);
    this.operationType.set(type);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.data.set(null);
    this.operationType.set('create');
  }
}
