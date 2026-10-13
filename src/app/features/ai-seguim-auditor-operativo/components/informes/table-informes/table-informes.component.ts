import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Informe } from '@features/ai-seguim-auditor-operativo/models/informe';
import { InformesService } from '@features/ai-seguim-auditor-operativo/services/informes/informes.service';
import { ModalService } from '@features/ai-seguim-auditor-operativo/services/informes/modal.service';
import { ResponseWrite } from '@shared/models/response-write';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { Subscription } from 'rxjs';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-table-informes',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './table-informes.component.html',
  styleUrl: './table-informes.component.css',
})
export class TableInformesComponent implements OnInit, OnChanges, OnDestroy {
  ngOnInit(): void {
  }
  @Input() reloadTable!: () => void;
  @Input() informes: Informe[] = [];
  private readonly router = inject(Router);
  private readonly informesSrv: InformesService = inject(InformesService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly ModalSrv: ModalService = inject(ModalService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private subscriptionsConfDelete: Subscription[] = [];
  private subscriptionsConfNotificar: Subscription[] = [];
  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedInformes: Informe[] = [];
  private informeEliminar!: Informe;
  // Comenzamos con orden descendente
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  private originalOrder: Informe[] = [];
  protected isLoadingFileMap: { [id: number]: boolean } = {};
  protected notifiedMap: { [id: number]: boolean } = {};

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptionsConfDelete.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['informes'] && changes['informes'].currentValue) {
      // Solo ordenamos si estamos recibiendo un array de informes con datos
      if (this.informes && this.informes.length > 0) {
        this.informes.forEach(inf => {
          if (inf.ainin_notificado === '1') {
            this.notifiedMap[inf.ainin_codigo] = true;
          }
        });
        // Guardar una copia del orden original al recibir nuevos datos
        this.originalOrder = [...this.informes];
        // Aplicar el ordenamiento descendente por defecto
        this.ordenFecha = 'desc';
        this.aplicarOrdenamiento();
      }

      const savedState = this.filterStateService.getFilters('seguim_auditor_operativo');
      if (savedState && savedState.currentPage) {
        const maxPages = Math.ceil((this.informes?.length || 0) / this.itemsPerPage) || 1;
        this.currentPage = Math.min(savedState.currentPage, maxPages);
      }
      this.updateDisplayedInformes();
    }
  }

  protected ordenarPorFecha(): void {
    // Simplificar: solo alternar entre asc y desc
    this.ordenFecha = this.ordenFecha === 'desc' ? 'asc' : 'desc';    
    // Aplicar el ordenamiento basado en el nuevo estado
    this.aplicarOrdenamiento();
    
    // Actualizar la visualización
    this.currentPage = 1;
    this.updateDisplayedInformes();
  }

  public clearSelection() {
    this.informes = [];
  }

  private aplicarOrdenamiento(): void {
    // Solo ordenar si hay datos que ordenar
    if (!this.informes || this.informes.length === 0) return;

    // Ordenar los informes según el estado actual
    if (this.ordenFecha === 'asc') {
      // Ordenamiento ascendente (de más antiguo a más reciente)
      this.informes.sort((a, b) => {
        const fechaA = new Date(a.ainin_fechaEmision).getTime();
        const fechaB = new Date(b.ainin_fechaEmision).getTime();
        return fechaA - fechaB;
      });
    } else {
      // Ordenamiento descendente (de más reciente a más antiguo)
      this.informes.sort((a, b) => {
        const fechaA = new Date(a.ainin_fechaEmision).getTime();
        const fechaB = new Date(b.ainin_fechaEmision).getTime();
        return fechaB - fechaA;
      });
    }
  }

  protected openModalConf(informe: Informe) {
    this.informeEliminar = informe;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de eliminar el informe con orden de trabajo: ${informe.ainin_ordenTrabajo}?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteInforme(informe);
    });
    
    this.subscriptionsConfDelete.push(subscription);
  }

  protected openModalNotif(codRec: number) {
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de notificar a todos los responsables del informe?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.notificar(codRec);
    });
    
    this.subscriptionsConfNotificar.push(subscription);
  }

  protected redireccionPagina(id: number): void {
    this.router.navigate(['inicio/auditor-operativo/hallazgos', btoa(id.toString())]);
  }

  private deleteInforme(informe: Informe): void {
    this.informesSrv.deleteInforme(informe).subscribe({
      next: (data: ResponseWrite) => {
        this.alertsService.showAlert(
          'Informe eliminado correctamente',
          'success'
        );
        if (this.reloadTable) {
          this.reloadTable(); // Recargar tabla después de eliminar
        }
      },
      error: (error) => {
        // Eliminar "Error:" del mensaje si existe
        const errorMessage = error.toString().replace(/^Error:\s*/, '');
        this.alertsService.showAlert(errorMessage, 'error');
      },
    });
  }

  protected openModal(informe: Informe) {
    this.ModalSrv.openModal(informe);
  }

  protected getFile(ruta: string, id: number) {
    this.isLoadingFileMap[id] = true;
    this.informesSrv.getFile(ruta).subscribe({
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

  private downloadFile(base64: string, fileName: string = 'documento', forceDownload: boolean = false): void {
    const blob = new Uint8Array(
      atob(base64)
        .split('')
        .map((char) => char.charCodeAt(0))
    );

    const fileType = 'application/pdf';
    fileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    
    if (!forceDownload) {
      // Abrir PDF en nueva pestaña con botón de descarga
      const file = new Blob([blob], { type: fileType });
      const fileURL = URL.createObjectURL(file);
      const newWindow = window.open(fileURL, '_blank');
      
      if (newWindow) {
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

    // Descargar el archivo cuando se solicita explícitamente
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

  private readonly filterStateService = inject(FilterStateService);

  private updateDisplayedInformes(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedInformes = this.informes.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  public updateData(newData: Informe[]): void {
    this.informes = newData;
    if (this.informes) {
      this.informes.forEach(inf => {
        if (inf.ainin_notificado === '1') {
          this.notifiedMap[inf.ainin_codigo] = true;
        }
      });
    }
    const savedState = this.filterStateService.getFilters('seguim_auditor_operativo');
    if (savedState && savedState.currentPage) {
      const maxPages = Math.ceil((this.informes?.length || 0) / this.itemsPerPage) || 1;
      this.currentPage = Math.min(savedState.currentPage, maxPages);
    } else {
      this.currentPage = 1;
    }
    this.ordenFecha = 'desc';
    // Guardar una copia del orden original
    this.originalOrder = [...newData];
    
    // Aplicar ordenamiento por defecto a los nuevos datos
    this.aplicarOrdenamiento();
    this.updateDisplayedInformes();
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    const currentState = this.filterStateService.getFilters('seguim_auditor_operativo') || {};
    this.filterStateService.setFilters('seguim_auditor_operativo', { ...currentState, currentPage: page });
    this.updateDisplayedInformes();
  }

  protected isNotificado(informe: Informe): boolean {
    if (!informe) return false;
    const val = String(informe.ainin_notificado);
    return val === '1' || !!this.notifiedMap[informe.ainin_codigo];
  }

  protected debeDestellar(informe: Informe): boolean {
    if (!informe) return false;
    if (this.isNotificado(informe)) return false;
    const rawProgreso = informe.progreso !== undefined && informe.progreso !== null ? Number(informe.progreso) : 0;
    const pctProgreso = (rawProgreso > 0 && rawProgreso <= 1) ? rawProgreso * 100 : rawProgreso;
    return pctProgreso < 100;
  }

  protected notificar(codRec: number) {
    this.informesSrv.notificar(codRec).subscribe({
      next: (response: ResponseWrite) => {
        const mensaje = response.mensaje || 'Notificación enviada correctamente';
        this.alertsService.showAlert(mensaje, 'success');
        this.notifiedMap[codRec] = true;
        const inf = this.informes.find(i => i.ainin_codigo === codRec);
        if (inf) {
          inf.ainin_notificado = '1';
        }
      },
      error: (error) => {
        this.alertsService.showAlert(error, 'error');
      },
    }); 
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedInformes();
  }

  protected hasRole(roles: number[]): boolean {
    return this.auxiliarySrv.hasRole(roles);
  }

}
