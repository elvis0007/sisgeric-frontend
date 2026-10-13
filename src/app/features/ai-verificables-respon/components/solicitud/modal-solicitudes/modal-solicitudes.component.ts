import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import { Solicitud } from '@features/ai-verificables-respon/models/solicitud_rec';
import { ModalFormFechaMaxService } from '@features/ai-verificables-respon/services/solicitud/modal-form-fecha-max.service';
import { ModalSolicitudesService } from '@features/ai-verificables-respon/services/solicitud/modal-solicitudes.service';
import { SolicitudResponsableService } from '@features/ai-verificables-respon/services/solicitud/solicitud-responsable.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { FileService } from '@shared/services/file.service';
import { EstadoSolicitudUtil } from '@shared/utils/estado-solicitud';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';

import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-modal-solicitudes',
  standalone: true,
  imports: [CommonModule, StatusColorPipe],
  templateUrl: './modal-solicitudes.component.html',
  styleUrl: './modal-solicitudes.component.css',
})
export class ModalSolicitudesComponent {
  @Input() reloadCards!: () => void;
  protected modalSolicitudSrv: ModalSolicitudesService = inject(
    ModalSolicitudesService
  );
  private readonly verificablesRespSrv: SolicitudResponsableService = inject(
    SolicitudResponsableService
  );
  protected readonly estadoSolicitudSrv: EstadoSolicitudUtil =
    inject(EstadoSolicitudUtil);
  private readonly modalFormFechaMaxSrv: ModalFormFechaMaxService = inject(
    ModalFormFechaMaxService
  );

  private readonly fileSrv: FileService = inject(FileService);
  private readonly alertsService: AlertsStateService = inject(AlertsStateService);
  private readonly modalConfirmSrv: ModalConfirmationService = inject(ModalConfirmationService);
  protected readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  
  protected verificables: Solicitud[] = [];
  protected isLoading = false;
  protected isEmpty = false;
  protected data: any | null = null;
  protected isLoadingFileMap: { [id: number]: boolean } = {};
  protected solicitudPendienteVigente: Solicitud | null = null;

  ngOnInit(): void {
    this.showVerificables();
  }

  constructor() {
    effect(() => {
      this.data = this.modalSolicitudSrv.getModalData();
      this.showVerificables();
    });
  }

  protected closeModal(): void {
    this.modalSolicitudSrv.closeModal();
    if (this.reloadCards) {
      this.reloadCards();
    }
  }

  private showVerificables(): void {
    if (!this.data || !this.data.arere_codigo || !this.data.codigo_per) {
      return;
    }

    this.isLoading = true;
    this.isEmpty = false;
    this.solicitudPendienteVigente = null;

    this.verificablesRespSrv
      .getSolicitudes(this.data.arere_codigo, this.data.codigo_per)
      .subscribe({
        next: (response) => {
          this.verificables = response.datos || [];
          this.isEmpty = this.verificables.length === 0;
          this.isLoading = false;

          const hoyStr = new Date().toISOString().split('T')[0];
          this.solicitudPendienteVigente = this.verificables.find((sol: Solicitud) => {
            const esPendiente = sol.asero_estado_aprob === '1' || sol.asero_estado_aprob === '2';
            if (!esPendiente) return false;
            if (!sol.areso_fecha_max_nue) return true;
            const fechaNueStr = String(sol.areso_fecha_max_nue).substring(0, 10);
            return fechaNueStr >= hoyStr;
          }) || null;
        },
        error: () => {
          this.isLoading = false;
        },
      });
  }

  protected openModalFormSolicitudes(event: Event) {
    event.preventDefault();

    if (this.solicitudPendienteVigente) {
      this.alertsService.showAlert(
        `Existe una solicitud de ampliación de plazo en trámite (Fecha solicitada: ${this.solicitudPendienteVigente.areso_fecha_max_nue}). Debe esperar a que sea procesada antes de realizar otra.`,
        'error'
      );
      return;
    }

    const estadoCodigo = this.data?.estado_individual?.arees_codigo ||
      this.data?.recomendaciones?.estado_individual?.arees_codigo ||
      this.data?.estado_seguimiento?.arees_codigo ||
      this.data?.recomendaciones?.estado_seguimiento?.arees_codigo ||
      this.data?.arees_codigo ||
      this.data?.recomendaciones?.arees_codigo;

    const estadoNombre = (
      this.data?.estado_individual?.arees_descripcion ||
      this.data?.recomendaciones?.estado_individual?.arees_descripcion ||
      this.data?.estado_seguimiento?.arees_descripcion ||
      this.data?.recomendaciones?.estado_seguimiento?.arees_descripcion ||
      ''
    ).toUpperCase();

    const plazo = this.data?.plazo_individual ??
      this.data?.recomendaciones?.plazo_individual ??
      this.data?.plazo ??
      this.data?.recomendaciones?.plazo;

    const esVencida = (plazo !== undefined && plazo !== null && plazo < 0) ||
      estadoCodigo === 3 ||
      estadoNombre.includes('NO CUMPLIDA') ||
      estadoNombre.includes('VENCID');

    const esEnProgreso = !esVencida && (
      estadoCodigo === 1 ||
      estadoNombre.includes('PROGRESO') ||
      estadoNombre.includes('VIGENTE') ||
      (plazo !== undefined && plazo !== null && plazo >= 0)
    );

    if (esEnProgreso) {
      const actionId = this.modalConfirmSrv.show({
        title: 'Ampliación de plazo',
        message: '<strong>NO SE REQUIERE SOLICITAR AMPLIACIÓN DE PLAZO PARA ESTA RECOMENDACIÓN.</strong><br><br>Si ya tiene sus verificables listos, puede subirlos en el botón <strong>"VERIFICABLES"</strong>, ya que esta acción es requerida únicamente si la recomendación se encuentra <strong>VENCIDA</strong>.<br><br>Sin embargo, si desea solicitar una ampliación de plazo, puede realizarlo a continuación.',
        confirmText: 'ENTENDIDO',
        cancelText: 'CANCELAR',
        confirmButtonType: 'primary'
      });
      this.modalConfirmSrv.onConfirmFor(actionId).subscribe(() => {
        this.abrirFormularioSolicitud();
      });
      return;
    }

    this.abrirFormularioSolicitud();
  }

  private abrirFormularioSolicitud(): void {
    this.closeModal();
    const modalData = { ...this.data };
    this.modalFormFechaMaxSrv.openModal(modalData, 'create');
  }

  protected openModalEditFormSolicitud(verificable?: Solicitud | null): void {
    const solToEdit = verificable || this.solicitudPendienteVigente;
    if (!solToEdit) return;

    this.closeModal();
    const modalData = {
      ...this.data,
      ...solToEdit,
      areso_codigo: solToEdit.areso_codigo,
      areso_descripcion: solToEdit.areso_descripcion,
      areso_adjunto: solToEdit.areso_adjunto,
      areso_fecha_max_ant: solToEdit.areso_fecha_max_ant,
      areso_fecha_max_nue: solToEdit.areso_fecha_max_nue,
      areso_memorando: solToEdit.areso_memorando
    };
    this.modalFormFechaMaxSrv.openModal(modalData, 'edit');
  }

  protected getFile(ruta: string, id: number) {
    this.isLoadingFileMap[id] = true;
    this.fileSrv.getFile(ruta).subscribe({
      next: (response: any) => {
        if (response && response.codigo === 1 && response.datos?.archivo) {
          const base64 = response.datos.archivo;
          const fileName = ruta.split('/').pop() || 'documento';
          this.downloadFile(base64, fileName, false);
        } else {
          this.alertsService.showAlert(
            response?.mensaje || 'Error al obtener el archivo. Consulte con el administrador del sistema.',
            'error'
          );
        }
        this.isLoadingFileMap[id] = false;
      },
      error: (error: any) => {
        console.error(error);
        const mensaje = error?.error?.mensaje || error?.message || 'Error al procesar la solicitud. Consulte con el administrador del sistema.';
        this.alertsService.showAlert(mensaje, 'error');
        this.isLoadingFileMap[id] = false;
      },
    });
  }

  protected canDeleteSolicitud(verificable: Solicitud): boolean {
    if (!verificable || !verificable.asero_estado_aprob) {
      return false;
    }

    const estado = String(verificable.asero_estado_aprob);

    // 1. Estado Pendiente ('1') -> Se permite eliminar a todos los usuarios
    if (estado === '1') {
      return true;
    }

    // 2. Estado Aprobado Parcial ('2') -> Se permite eliminar si el usuario tiene rol Director Departamental (5), Auditor Interno Jefe (2) o Administrador (1)
    if (estado === '2') {
      return this.auxiliarSrv.hasRole([1, 2, 5]);
    }

    return false;
  }

  protected deleteSolicitud(verificable: Solicitud) {
    if (!verificable?.areso_codigo) return;

    if (!this.canDeleteSolicitud(verificable)) {
      this.alertsService.showAlert('No tiene permisos para eliminar una solicitud en estado Aprobado Parcial.', 'error');
      return;
    }

    const actionId = this.modalConfirmSrv.show({
      title: 'Confirmación',
      message: '¿Estás seguro de eliminar esta solicitud de ampliación de plazo?',
      confirmText: 'ELIMINAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'error',
      cancelButtonType: 'ghost'
    });

    this.modalConfirmSrv.onConfirmFor(actionId).subscribe(() => {
      this.alertsService.showAlert('Eliminando solicitud...', 'info');

      this.verificablesRespSrv.deleteSolicitud(verificable.areso_codigo).subscribe({
        next: (response) => {
          this.alertsService.showAlert(response.mensaje || 'Solicitud eliminada correctamente', 'success');
          this.reloadVerificables();
          if (this.reloadCards) {
            this.reloadCards();
          }
        },
        error: (error) => {
          this.alertsService.showAlert(error, 'error');
        }
      });
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
            downloadButton.style.transition = 'all 0.3s ease';
            downloadButton.style.fontFamily = 'Arial, sans-serif';
            downloadButton.style.fontSize = '14px';
            downloadButton.style.fontWeight = 'bold';
            
            // Agregar efecto hover
            downloadButton.onmouseover = () => {
              downloadButton.style.backgroundColor = '#0056b3';
              downloadButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
              downloadButton.style.transform = 'translateY(-1px)';
            };
            downloadButton.onmouseout = () => {
              downloadButton.style.backgroundColor = '#007bff';
              downloadButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
              downloadButton.style.transform = 'translateY(0)';
            };
            
            // Agregar efecto click
            downloadButton.onmousedown = () => {
              downloadButton.style.transform = 'translateY(1px)';
            };
            downloadButton.onmouseup = () => {
              downloadButton.style.transform = 'translateY(-1px)';
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

  // private deleteVerificable(verificable: Verificable) {
  //   this.verificablesRespSrv
  //     .deleteVerificable(verificable.areve_codigo)
  //     .subscribe({
  //       next: () => {
  //         this.alertComponent.showAlert(
  //           'Verificable eliminado correctamente',
  //           'success'
  //         );
  //         setTimeout(() => {
  //           this.closeModal();
  //         }, 2500);
  //         this.reloadVerificables();
  //       },
  //       error: (error) => this.alertComponent.showAlert(error, 'error'),
  //     });
  // }

  // protected openModalConfDeleteVerf(verificable: Verificable) {
  //   this.verificableEliminar = verificable;
  //   this.modalConf.title = 'Confirmación';
  //   this.modalConf.message = '¿Estás seguro de eliminar el verificable?';
  //   this.modalConf.show();
  // }

  // protected onConfirmHandler() {
  //   this.deleteVerificable(this.verificableEliminar);
  //   this.modalConf.hide();
  // }

  reloadVerificables() {
    this.showVerificables();
  }
}
