import { Injectable, signal } from '@angular/core';

export interface ModalResponsablesData {
  id_rec: number;
  filterNoJustificados?: boolean;
  departamento?: string;
  isReporte7?: boolean;
  responsablesReporte7?: any[];
}

@Injectable({
  providedIn: 'root',
})
export class ModalResponsablesService {
  isModalOpen = signal(false);
  private data = signal<ModalResponsablesData | number | null>(null);
  private filterNoJustificados = signal(false);
  private departamento = signal<string | null>(null);
  private isReporte7 = signal(false);
  private responsablesReporte7 = signal<any[]>([]);
  private responsablesPeriodo = signal<Map<number, Set<number>> | null>(null);

  modalData(): number | null {
    const data = this.data();
    if (typeof data === 'number') {
      return data;
    }
    if (data && typeof data === 'object' && 'id_rec' in data) {
      return data.id_rec;
    }
    return null;
  }

  shouldFilterNoJustificados(): boolean {
    return this.filterNoJustificados();
  }

  getDepartamento(): string | null {
    return this.departamento();
  }

  isFromReporte7(): boolean {
    return this.isReporte7();
  }

  getResponsablesReporte7(): any[] {
    return this.responsablesReporte7();
  }

  setResponsablesPeriodo(map: Map<number, Set<number>> | null): void {
    this.responsablesPeriodo.set(map);
  }

  getResponsablesPeriodo(): Map<number, Set<number>> | null {
    return this.responsablesPeriodo();
  }

  openModal(data: number | ModalResponsablesData) {
    if (typeof data === 'number') {
      this.data.set(data);
      this.filterNoJustificados.set(false);
      this.departamento.set(null);
      this.isReporte7.set(false);
      this.responsablesReporte7.set([]);
    } else {
      this.data.set(data);
      this.filterNoJustificados.set(data.filterNoJustificados || false);
      this.departamento.set(data.departamento || null);
      this.isReporte7.set(data.isReporte7 || false);
      this.responsablesReporte7.set(data.responsablesReporte7 || []);
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.data.set(null);
    this.filterNoJustificados.set(false);
    this.departamento.set(null);
    this.isReporte7.set(false);
    this.responsablesReporte7.set([]);
  }
}
