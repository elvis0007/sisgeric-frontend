import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ModalCrearSolicitudService {
  private isModalOpenSignal = signal<boolean>(false);
  private modalDataSignal = signal<any>(null);
  private generatedSolicitudSignal = signal<{ attachment: File | null; fechaCumplimiento: string; detalle?: string } | null>(null);

  isModalOpen() {
    return this.isModalOpenSignal();
  }

  getModalData() {
    return this.modalDataSignal();
  }

  getGeneratedAttachment() {
    return this.generatedSolicitudSignal()?.attachment ?? null;
  }

  getGeneratedFechaCumplimiento() {
    return this.generatedSolicitudSignal()?.fechaCumplimiento ?? '';
  }

  getGeneratedSolicitud() {
    return this.generatedSolicitudSignal();
  }

  openModal(data: any): void {
    this.modalDataSignal.set(data);
    this.isModalOpenSignal.set(true);
  }

  setGeneratedAttachment(file: File): void {
    this.generatedSolicitudSignal.set({
      attachment: file,
      fechaCumplimiento: this.generatedSolicitudSignal()?.fechaCumplimiento ?? '',
      detalle: this.generatedSolicitudSignal()?.detalle,
    });
  }

  setGeneratedFechaCumplimiento(fecha: string): void {
    this.generatedSolicitudSignal.set({
      attachment: this.generatedSolicitudSignal()?.attachment ?? null,
      fechaCumplimiento: fecha,
      detalle: this.generatedSolicitudSignal()?.detalle,
    });
  }

  setGeneratedSolicitud(data: { attachment: File | null; fechaCumplimiento: string; detalle?: string }): void {
    this.generatedSolicitudSignal.set(data);
  }

  clearGeneratedAttachment(): void {
    this.generatedSolicitudSignal.set(null);
  }

  clearGeneratedFechaCumplimiento(): void {
    this.generatedSolicitudSignal.set(null);
  }

  clearGeneratedSolicitud(): void {
    this.generatedSolicitudSignal.set(null);
  }

  closeModal(): void {
    this.isModalOpenSignal.set(false);
    this.modalDataSignal.set(null);
  }
}
