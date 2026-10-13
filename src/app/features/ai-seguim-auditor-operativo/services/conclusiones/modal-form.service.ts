import { Injectable, signal } from '@angular/core';
import { Conclusion } from '@features/ai-seguim-auditor-operativo/models/conclusion';

@Injectable({
  providedIn: 'root',
})
export class ModalFormService {
  isModalOpen = signal(false);
  private data = signal<any>(null);
  private operationType = signal<'create' | 'edit'>('create');

  modalData() {
    return this.data();
  }

  getOperationType() {
    return this.operationType();
  }

  openModal(data: Conclusion | null, type: 'create' | 'edit' = 'create') {
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
