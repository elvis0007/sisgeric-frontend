import { CommonModule } from '@angular/common';
import { Component, inject, Input, effect } from '@angular/core';
import { Nas } from '@features/ai-seg-configuracion/models/Nas';
import { ModalService } from '@features/ai-seg-configuracion/services/nas/modal.service';

@Component({
  selector: 'app-card-nas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card-nas.component.html',
  styleUrl: './card-nas.component.css',
})
export class CardNasComponent {
  @Input() configuracion: Nas[] = [];
  protected modalSrv: ModalService = inject(ModalService);
  protected isUpdating = false;

  constructor() {
    // Escuchar actualizaciones de configuración
    effect(() => {
      if (this.modalSrv.configurationUpdated()) {
        this.triggerUpdateAnimation();
      }
    });
  }

  openModal(configuracion: Nas) {
    this.modalSrv.openModal(configuracion);
  }

  editField(config: Nas, field: string) {
    // Crear un objeto de configuración específico para el campo a editar
    const editConfig = {
      ...config,
      editField: field
    };
    this.modalSrv.openModal(editConfig);
  }

  formatFileSize(sizeInMB: number): string {
    if (sizeInMB >= 1024) {
      return `${(sizeInMB / 1024).toFixed(1)} GB`;
    }
    return `${sizeInMB} MB`;
  }

  private triggerUpdateAnimation() {
    this.isUpdating = true;
    // Remover la clase después de la animación
    setTimeout(() => {
      this.isUpdating = false;
    }, 600);
  }
}
