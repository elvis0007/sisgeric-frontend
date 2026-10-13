import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModalAsignAuditAgService {

    isModalOpen = signal(false);
    private data = signal<any>(null);
  
    modalData() {
      return this.data();
    }
  
    openModal(data: any | null) {
      this.data.set(data);
      this.isModalOpen.set(true);
    }
  
    closeModal() {
      this.isModalOpen.set(false);
      this.data.set(null);
    }
}
