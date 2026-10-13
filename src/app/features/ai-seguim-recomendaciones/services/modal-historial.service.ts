import { Injectable, signal } from '@angular/core';

export interface ModalHistorialData {
  id_rec: number;
  numRec: number;
  descripcion: string;
  riesgoVerificado?: string | null;
  evidenciaRequerida?: string | null;
  memorando: string;
  tituloInforme?: string;
  lista_responsables?: string;
  progreso_rec?: number;
  progreso_inf?: number;
  arere_fecha_inicio_control?: string;
  arere_fecha_maxima?: string;
  auditor?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ModalHistorialService {
  isModalOpen = signal(false);
  private data = signal<ModalHistorialData | null>(null);

  modalData(): ModalHistorialData | null {
    return this.data();
  }

  openModal(data: ModalHistorialData) {
    this.data.set(data);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.data.set(null);
  }
}
