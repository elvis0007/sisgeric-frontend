import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, OnDestroy } from '@angular/core';
import { ModalVerificablesService } from '@features/ai-verificables-respon/services/verificables/modal-verificables.service';
import { Verificable } from '@features/ai-verificables-respon/models/recomendaciones_verif';
import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';
import { ModalFormVerificablesService } from '@features/ai-verificables-respon/services/verificables/modal-form-verificables.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { Subscription } from 'rxjs';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-modal-verificables',
  standalone: true,
  imports: [
    CommonModule,
    StatusColorPipe
  ],
  templateUrl: './modal-verificables.component.html',
  styleUrl: './modal-verificables.component.css',
})
export class ModalVerificablesComponent implements OnInit, OnDestroy {
  protected modalVerifSrv: ModalVerificablesService = inject(
    ModalVerificablesService
  );
  private readonly verificablesRespSrv: VerificablesResponsablesService =
    inject(VerificablesResponsablesService);
  private readonly modalFormVerificableSrv: ModalFormVerificablesService =
    inject(ModalFormVerificablesService);
  private readonly alertService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private readonly auxiliarySrv = inject(AuxiliaryService);
  private subscriptions: Subscription[] = [];
  
  protected verificables: Verificable[] = [];
  protected isLoading = false;
  protected isEmpty = false;
  protected data: any | null = null;
  protected isLoadingFileMap: { [id: number]: boolean } = {};
  private ESTADO_PENDIENTE = 1;
  private ESTADO_JUSTIFICADO = 2;
  private ESTADO_NO_JUSTIFICA = 3;
  private ESTADO_PENDIENTE_REVISION = 5;
  private verificableEliminar!: Verificable;

  ngOnInit(): void {
    this.showVerificables();
    
    // Suscribirse a las actualizaciones de verificables
    const updateSubscription = this.verificablesRespSrv.verificableUpdated$.subscribe(
      ({ codigoRec, codPer }) => {
        // Solo actualizar si coincide con la recomendación actual del modal
        if (this.data?.codRec === codigoRec && this.data?.codPer === codPer) {
          this.showVerificables();
        }
      }
    );
    
    this.subscriptions.push(updateSubscription);
  }
  
  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  constructor() {
    effect(() => {
      this.data = this.modalVerifSrv.getModalData();
      this.showVerificables();
    });
  }

  protected closeModal(): void {
    this.modalVerifSrv.closeModal();
  }

  private showVerificables(): void {
    if (!this.data || !this.data.codRec || !this.data.codPer) {
      return;
    }

    this.isLoading = true;
    this.isEmpty = false;

    this.verificablesRespSrv
      .getVerificablesResp(this.data.codRec, this.data.codPer)
      .subscribe({
        next: (response) => {
          this.verificables = response.datos.verificables || [];
          this.isEmpty = this.verificables.length === 0;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        },
      });
  }

  protected openModalFormVerificables() {
    if (this.isRecommendationExpired()) {
      this.alertService.showAlert(
        'No se pueden ingresar verificables porque el plazo de la recomendación se encuentra vencido. Por favor, solicite una ampliación de plazo.',
        'warning'
      );
      return;
    }
    if (this.hasPendingVerificables()) {
      this.alertService.showAlert(
        'Tiene verificables pendientes de revisión por parte de auditoría. No puede subir nuevos verificables hasta que sean validados.',
        'warning'
      );
      return;
    }
    if (this.hasJustifiedVerificable()) {
      this.alertService.showAlert(
        'Esta recomendación ya cuenta con un verificable justificado.',
        'info'
      );
      return;
    }
    const parentData = { ...this.data };
    this.closeModal();
    const modalData = {
      arere_codigo: this.data.codRec,
      status: this.data?.status,
      plazo: this.data?.plazo,
      fechaMax: this.data?.fechaMax,
      parentData: parentData
    };
    this.modalFormVerificableSrv.openModal(modalData, 'create');
  }

  protected openModalEditFormVerificable(verificable: Verificable) {
    const parentData = { ...this.data };
    this.closeModal();
    const modalData = {
      arere_codigo: this.data.codRec,
      areve_codigo: verificable.areve_codigo,
      parentData: parentData
    };
    this.modalFormVerificableSrv.openModal(modalData, 'edit');
  }

  protected getFile(ruta: string, id: number) {
    this.isLoadingFileMap[id] = true;
    this.verificablesRespSrv.getFile(ruta).subscribe({
      next: (response: any) => {
        if (response && response.codigo === 1 && response.datos?.archivo) {
          const base64 = response.datos.archivo;
          const fileName = ruta.split('/').pop() || 'documento';
          this.downloadFile(base64, fileName, false);
        } else {
          this.alertService.showAlert(
            response?.mensaje || 'Error al obtener el archivo. Consulte con el administrador del sistema.',
            'error'
          );
        }
        this.isLoadingFileMap[id] = false;
      },
      error: (error: any) => {
        console.error(error);
        const mensaje = error?.error?.mensaje || error?.message || 'Error al procesar la solicitud. Consulte con el administrador del sistema.';
        this.alertService.showAlert(mensaje, 'error');
        this.isLoadingFileMap[id] = false;
      },
    });
  }

  private downloadFile(base64: string, fileName: string = 'documento', forceDownload: boolean = false): void {
    const blob = new Uint8Array(
      atob(base64)
        .split('')
        .map((char) => char.charCodeAt(0))
    );

    // Detectar el tipo de archivo basado en los primeros bytes
    let fileType = 'application/octet-stream';
    const signature = blob.slice(0, 4);
    if (signature[0] === 0x25 && signature[1] === 0x50) { // %PDF
      fileType = 'application/pdf';
      fileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      
      if (!forceDownload) {
        // Para PDFs, abrir en nueva pestaña si no se fuerza la descarga
        const file = new Blob([blob], { type: fileType });
        const fileURL = URL.createObjectURL(file);
        const newWindow = window.open(fileURL, '_blank');
        
        if (newWindow) {
          // Crear botón de descarga en la nueva ventana
          newWindow.onload = () => {
            const downloadButton = newWindow.document.createElement('button');
            downloadButton.textContent = 'Descargar PDF';
            downloadButton.style.position = 'fixed';
            downloadButton.style.top = '10px';
            downloadButton.style.right = '10px';
            downloadButton.style.zIndex = '9999';
            downloadButton.style.padding = '10px 20px';
            downloadButton.style.backgroundColor = '#007bff';
            downloadButton.style.color = 'white';
            downloadButton.style.border = 'none';
            downloadButton.style.borderRadius = '5px';
            downloadButton.style.cursor = 'pointer';
            downloadButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            
            // Agregar efecto hover
            downloadButton.onmouseover = () => {
              downloadButton.style.backgroundColor = '#0056b3';
            };
            downloadButton.onmouseout = () => {
              downloadButton.style.backgroundColor = '#007bff';
            };
            
            downloadButton.onclick = () => {
              this.downloadFile(base64, fileName, true);
            };
            
            newWindow.document.body.appendChild(downloadButton);
          };
        }
        return;
      }
    } else if (signature[0] === 0xD0 && signature[1] === 0xCF) { // DOC
      fileType = 'application/msword';
      fileName = fileName.endsWith('.doc') ? fileName : `${fileName}.doc`;
    } else if (signature[0] === 0x50 && signature[1] === 0x4B) { // DOCX/XLSX
      // Verificar si es un archivo XLSX por el nombre
      if (fileName.toLowerCase().endsWith('.xlsx')) {
        fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
      } else {
        fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileName = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
      }
    } else if (signature[0] === 0xD0 && signature[1] === 0xCF && signature[2] === 0x11 && signature[3] === 0xE0) { // XLS
      fileType = 'application/vnd.ms-excel';
      fileName = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`;
    }

    // Para todos los demás tipos de archivo o cuando se fuerza la descarga
    const file = new Blob([blob], { type: fileType });
    const fileURL = URL.createObjectURL(file);
    
    const link = document.createElement('a');
    link.href = fileURL;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(fileURL);
  }

  // Método para verificar si la recomendación está vencida (no cumplida)
  protected isRecommendationExpired(): boolean {
    if (!this.data) return false;
    const status = this.data.status;
    const plazo = this.data.plazo;
    return status === 3 || (plazo !== undefined && plazo !== null && plazo < 0);
  }

  // Verifica si hay al menos un verificable pendiente de revisión (código 1 PENDIENTE o 5 PENDIENTE DE REVISIÓN) esperando dictamen de auditoría
  protected hasPendingVerificables(): boolean {
    return this.verificables.some((v) => {
      const cod = Number(v.estado_seguimiento?.areev_codigo ?? (v as any)?.areev_codigo);
      const desc = (v.estado_seguimiento?.areev_descripcion || '').trim().toUpperCase();
      return cod === this.ESTADO_PENDIENTE || cod === this.ESTADO_PENDIENTE_REVISION || desc.includes('PENDIENTE') || desc.includes('REVISI');
    });
  }

  // Verifica si hay al menos un verificable justificado (estado 2 o descripción JUSTIFICA)
  protected hasJustifiedVerificable(): boolean {
    return this.verificables.some((v) => {
      const cod = Number(v.estado_seguimiento?.areev_codigo ?? (v as any)?.areev_codigo);
      const desc = (v.estado_seguimiento?.areev_descripcion || '').trim().toUpperCase();
      return cod === this.ESTADO_JUSTIFICADO || desc === 'JUSTIFICA' || desc === 'JUSTIFICADO';
    });
  }

  // Deshabilita la subida si ya está justificado o si hay verificables pendientes de revisión por auditoría
  isUploadDisabled(): boolean {
    return this.hasJustifiedVerificable() || this.hasPendingVerificables();
  }

  // Texto dinámico para el botón de subida según el estado
  protected getUploadButtonText(): string {
    if (this.isRecommendationExpired()) {
      return 'POR FAVOR, ELABORAR UNA SOLICITUD DE REPROGRAMACIÓN';
    }
    if (this.hasJustifiedVerificable()) {
      return 'RECOMENDACIÓN JUSTIFICADA';
    }
    if (this.hasPendingVerificables()) {
      return 'VERIFICABLES PENDIENTES DE REVISIÓN EN AUDITORÍA';
    }
    return 'SUBIR';
  }

  // Método para verificar si un botón debe estar deshabilitado en cada verificable
  protected isEditOrDeleteDisabled(verificable: Verificable): boolean {
    return (
      verificable.estado_seguimiento.areev_codigo === this.ESTADO_JUSTIFICADO || verificable.estado_seguimiento.areev_codigo === this.ESTADO_NO_JUSTIFICA
    );
  }

  private deleteVerificable(verificable: Verificable) {
    this.verificablesRespSrv
      .deleteVerificable(verificable.areve_codigo)
      .subscribe({
        next: () => {
          this.alertService.showAlert(
            'Verificable eliminado correctamente',
            'success'
          );
          this.closeModal();
          this.reloadVerificables();
          
          // Notificar que el verificable fue eliminado (actualizado)
          if (this.data?.codRec && this.data?.codPer) {
            this.verificablesRespSrv.notifyVerificableUpdated(this.data.codRec, this.data.codPer);
          }
        },
        error: (error) => this.alertService.showAlert(error, 'error'),
      });
  }

  protected openModalConfDeleteVerf(verificable: Verificable) {
    this.verificableEliminar = verificable;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: '¿Estás seguro de eliminar el verificable?',
      confirmText: 'ELIMINAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'secondary',
      cancelButtonType: 'error'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteVerificable(this.verificableEliminar);
    });
    
    this.subscriptions.push(subscription);
  }

  reloadVerificables() {
    this.showVerificables();
  }
}
