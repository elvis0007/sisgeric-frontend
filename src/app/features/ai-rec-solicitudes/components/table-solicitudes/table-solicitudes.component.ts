import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import {
  EstadoAprobacion,
  OpcionEstado,
  Solicitud,
} from '@features/ai-rec-solicitudes/models/solicitud';
import { ModalAtenderAuditorService } from '@features/ai-rec-solicitudes/services/modal-atender.service';
import { SolicitudesAuditorService } from '@features/ai-rec-solicitudes/services/solicitudes.service';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { EstadoSolicitudUtil } from '@shared/utils/estado-solicitud';

@Component({
  selector: 'app-table-solicitudes',
  standalone: true,
  imports: [CommonModule, StatusColorPipe, PaginationComponent],
  templateUrl: './table-solicitudes.component.html',
  styleUrl: './table-solicitudes.component.css',
})
export class TableSolicitudesComponent implements OnChanges {
  @Input() solicitudes: Solicitud[] = [];
  @Input() reloadTable!: () => void;
  @Output() selectionChange = new EventEmitter<Solicitud[]>();

  private readonly solicitudesSrv: SolicitudesAuditorService =
    inject(SolicitudesAuditorService);
  private readonly modalAtenderSrv: ModalAtenderAuditorService =
    inject(ModalAtenderAuditorService);
  protected readonly estadoSolicitudSrv: EstadoSolicitudUtil =
    inject(EstadoSolicitudUtil);

  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedSolicitudes: Solicitud[] = [];
  protected isLoadingFileMap: { [key: string]: boolean } = {};
  protected ordenAscendente: boolean = false;

  protected estados_aprobacion: OpcionEstado[] = [
    { codigo: EstadoAprobacion.APROBADO, nombre: 'Aprobado' },
    { codigo: EstadoAprobacion.NO_APROBADO, nombre: 'No Aprobado' },
  ];

  protected ordenarPorFecha(): void {
    this.ordenAscendente = !this.ordenAscendente;
    this.solicitudes.sort((a, b) => {
      const fechaA = new Date(a.areso_fecha_carga).getTime();
      const fechaB = new Date(b.areso_fecha_carga).getTime();
      return this.ordenAscendente ? fechaA - fechaB : fechaB - fechaA;
    });
    this.updateDisplayedSolicitudes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['solicitudes'] && changes['solicitudes'].currentValue) {
      // Ordenar por fecha por defecto (más reciente primero)
      this.solicitudes.sort((a, b) => {
        const fechaA = new Date(a.areso_fecha_carga).getTime();
        const fechaB = new Date(b.areso_fecha_carga).getTime();
        return fechaB - fechaA;
      });
      this.updateDisplayedSolicitudes();
    }
  }

  public clearSelection() {
    this.solicitudes = [];
  }

  protected updateDisplayedSolicitudes(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedSolicitudes = this.solicitudes.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  public updateData(newData: Solicitud[]): void {
    this.solicitudes = newData;
    this.currentPage = 1;
    this.updateDisplayedSolicitudes();
  }

  protected getFile(ruta: string, codigo: number) {
    this.isLoadingFileMap[codigo] = true;
    let base64!: any;
    this.solicitudesSrv.getFile(ruta).subscribe({
      next: (response) => {
        base64 = response.datos;
        const fileName = ruta.split('/').pop() || 'documento';
        this.downloadFile(base64.archivo, fileName, false);
        this.isLoadingFileMap[codigo] = false;
      },
      error: () => {
        this.isLoadingFileMap[codigo] = false;
      }
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

  protected openModalAtender(event: Event, solicitud: Solicitud) {
    event.preventDefault();
    this.modalAtenderSrv.openModal(solicitud, 'edit');
  }

  protected convertEstadoAprob(estado_aprob: string): string {
    const respuesta = this.estados_aprobacion.find(
      (estado) => estado.codigo.toString() === estado_aprob
    );
    return respuesta ? respuesta.nombre.toLocaleUpperCase() : 'DESCONOCIDO'; // ✅ Retorna siempre un string
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedSolicitudes();
  }
  
  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedSolicitudes();
  }
}
