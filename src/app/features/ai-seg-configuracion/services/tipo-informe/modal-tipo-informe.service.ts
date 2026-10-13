import { Injectable, signal } from '@angular/core';
import { TipoInformeWrite } from '@features/ai-seg-configuracion/models/Tipo-Informe';

@Injectable({
  providedIn: 'root',
})
export class ModalTipoInformeService {
  isModalOpen = signal(false);
  private data = signal<any>(null);
  private operationType = signal<'create' | 'edit'>('create');

  modalData() {
    return this.data();
  }

  getOperationType() {
    return this.operationType();
  }

  openModal(data: TipoInformeWrite | null, type: 'create' | 'edit' = 'create') {
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
