import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Informe } from '@features/ai-director-informes/models/Informe';
import { InformesService } from '@features/ai-seguim-auditor-operativo/services/informes/informes.service';
import { RoundPipe } from '@shared/pipe/round.pipe';

@Component({
  selector: 'app-table-informes',
  standalone: true,
  imports: [CommonModule, RoundPipe, PaginationComponent],
  templateUrl: './table-informes.component.html',
  styleUrl: './table-informes.component.css',
})
export class TableInformesComponent implements OnChanges {
  @Input() reloadTable!: () => void;
  @Input() informes: Informe[] = [];
  private readonly router = inject(Router);

  protected currentPage: number = 1;
  protected itemsPerPage: number = 5;
  protected displayedInformes: Informe[] = [];
  // Comenzamos con orden descendente
  protected ordenFecha: 'asc' | 'desc' = 'desc';
  // Guardar el orden original si es necesario
  private originalOrder: Informe[] = [];
  protected isLoadingFileMap: { [id: number]: boolean } = {};
  private readonly informesSrv: InformesService = inject(InformesService);
  private readonly alertsService = inject(AlertsStateService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['informes'] && changes['informes'].currentValue) {
      // Solo ordenamos si estamos recibiendo un array de informes con datos
      if (this.informes && this.informes.length > 0) {
        // Guardar una copia del orden original al recibir nuevos datos
        this.originalOrder = [...this.informes];
        // Aplicar el ordenamiento descendente por defecto
        this.ordenFecha = 'desc';
        this.aplicarOrdenamiento();
      }
      this.updateDisplayedInformes();
    }
  }

  public clearSelection() {
    this.informes = [];
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

  protected redireccionPagina(id: number): void {
    this.router.navigate([
      'inicio/director-informes/recomendaciones-director',
      btoa(id.toString()),
    ]);
  }

  private updateDisplayedInformes(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedInformes = this.informes.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  public updateData(newData: Informe[]): void {
    this.informes = newData;
    // Resetear a la configuración inicial
    this.currentPage = 1;
    this.ordenFecha = 'desc';
    // Guardar una copia del orden original
    this.originalOrder = [...newData];
    
    // Aplicar ordenamiento por defecto a los nuevos datos
    this.aplicarOrdenamiento();
    this.updateDisplayedInformes();
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedInformes();
  }
  
  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1; // Resetear a la primera página cuando cambia el número de items por página
    this.updateDisplayedInformes();
  }

  protected getFile(ruta: string, id: number) {
    this.isLoadingFileMap[id] = true;
    this.informesSrv.getFile(ruta).subscribe({
      next: (response) => {
        const base64 = response.datos.archivo;
        const fileName = ruta.split('/').pop() || 'documento';
        this.downloadFile(base64, fileName, false);
        this.isLoadingFileMap[id] = false;
      },
      error: () => {
        this.isLoadingFileMap[id] = false;
        this.alertsService.showAlert('Error al obtener el archivo', 'error');
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
}
