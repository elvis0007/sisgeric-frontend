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
import { AlertsStateService } from '@core/services/alerts-state.service';
import { FilterStateService } from '@core/services/filter-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';
import { Verificable } from '@features/ai-rec-verificables/models/Verificable';
import { ModalFormVerificableService } from '@features/ai-rec-verificables/services/verificables/modal-form-verificable.service';
import { ModalValidarVerificableService } from '@features/ai-rec-verificables/services/verificables/modal-validar-verificable.service';
import { ModalFormFechaMaxService } from '@features/ai-rec-verificables/services/recomendaciones/modal-form-fecha-max.service';
import { VerificablesService } from '@features/ai-rec-verificables/services/verificables/verificables.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ResponseWrite } from '@shared/models/response-write';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import { Subscription } from 'rxjs';

import { PlanAccionService } from '@features/ai-plan-accion-respon/services/plan-accion.service';
import { ActividadPlanAccion } from '@features/ai-plan-accion-respon/models/plan-accion.model';

export interface ResponsableGroupView {
  responsable: any;
  plan: ActividadPlanAccion[];
  verificables: Verificable[];
  listaEvidencias: string[];
  checklist: { [evidencia: string]: boolean };
  isPlanExpanded: boolean;
  isChecklistExpanded: boolean;
}

@Component({
  selector: 'app-table-verificables',
  standalone: true,
  imports: [CommonModule, StatusColorPipe, PaginationComponent],
  templateUrl: './table-verificables.component.html',
  styleUrl: './table-verificables.component.css',
})
export class TableVerificablesComponent implements OnChanges, OnInit, OnDestroy {
  @Input() reloadTable!: () => void;
  @Input() verificables: Verificable[] = [];
  @Input() recomendaciones?: any;
  @Input() selectedResponsableId: string = '0';
  @Input() isCumplida: boolean = false;

  private readonly verificableSrv: VerificablesService =
    inject(VerificablesService);
  protected readonly modalFormSrv: ModalValidarVerificableService = inject(
    ModalValidarVerificableService
  );
  protected readonly modalFormVerSrv: ModalFormVerificableService = inject(
    ModalFormVerificableService
  );
  protected readonly modalFormRecFechaSrv: ModalFormFechaMaxService = inject(
    ModalFormFechaMaxService
  );
  protected readonly planAccionSrv = inject(PlanAccionService);
  private readonly auxiliarySrv = inject(AuxiliaryService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmationService = inject(ModalConfirmationService);
  private readonly filterStateService = inject(FilterStateService);
  private subscriptions: Subscription[] = [];
  
  protected currentPage: number = 1;
  protected itemsPerPage: number = 2;
  protected displayedVerificables: Verificable[] = [];
  protected displayedResponsablesGroups: ResponsableGroupView[] = [];
  private verificableEliminar!: Verificable;
  protected isLoadingFileMap: { [id: number]: boolean } = {};
  protected responsablesGroups: ResponsableGroupView[] = [];

  ngOnInit(): void {
    this.updateResponsablesGroups();
  }

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['verificables'] || changes['selectedResponsableId'] || changes['recomendaciones']) {
      this.updateResponsablesGroups();
    }
  }

  protected getFile(ruta: string, id: number) {
    this.isLoadingFileMap[id] = true;
    this.verificableSrv.getFile(ruta).subscribe({
      next: (response: any) => {
        if (response && response.codigo === 1 && response.datos?.archivo) {
          const base64 = response.datos;
          const fileName = ruta.split('/').pop() || 'documento';
          this.downloadFile(base64.archivo, fileName, false);
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

  protected openModalConf(verificable: Verificable) {
    if (this.isEditOrDeleteDisabled(verificable)) {
      return;
    }
    this.verificableEliminar = verificable;
    const actionId = this.modalConfirmationService.show({
      title: 'Confirmación',
      message: `¿Estás seguro de eliminar el verificable con fecha de registro ${verificable.areve_fecha_carga} ?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR'
    });
    
    // Suscribirse a la confirmación específica para este actionId
    const subscription = this.modalConfirmationService.onConfirmFor(actionId).subscribe(() => {
      this.deleteVerificable(verificable);
    });
    
    this.subscriptions.push(subscription);
  }

  protected isEditOrDeleteDisabled(verificable: Verificable): boolean {
    // El Auditor Interno Jefe (Rol 2) tiene acceso para validar y rectificar verificables en JUSTIFICA
    if (this.hasRole([2])) {
      return false;
    }
    const estado = verificable?.estado_seguimiento?.areev_descripcion?.toUpperCase()?.trim();
    return estado === 'JUSTIFICA';
  }

  protected canEditVerificable(verificable: Verificable): boolean {
    // Si fue subido directamente por el responsable, el auditor no puede editarlo
    if (verificable.subido_por_responsable === true) {
      return false;
    }
    if (verificable.puede_editar === false) {
      return false;
    }
    // Verificación directa comparando usuarios (usuario de carga vs usuario del responsable)
    const usuarioCarga = verificable.areve_usuario?.trim().toLowerCase();
    const usuarioResp = verificable.responsable?.arers_usuario?.trim().toLowerCase();
    if (usuarioCarga && usuarioResp && usuarioCarga === usuarioResp) {
      return false;
    }
    if (verificable.puede_editar === true) {
      return true;
    }
    return true;
  }

  private deleteVerificable(verificable: Verificable): void {
    this.verificableSrv.deleteVerificable(verificable).subscribe({
      next: (data: ResponseWrite) => {
        this.alertsService.showAlert(
          'Verificable eliminado correctamente',
          'success'
        );
        if (this.reloadTable) {
          this.reloadTable(); // Recargar tabla después de eliminar
        }
      },
      error: () => {
        this.alertsService.showAlert('Error al eliminar verificable', 'error');
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
        const win = window.open(fileURL, '_blank');
        
        if (win) {
          // Crear botón de descarga en la nueva ventana
          win.onload = () => {
            const downloadButton = win.document.createElement('button');
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
            
            downloadButton.onclick = () => {
              this.downloadFile(base64, fileName, true);
            };
            
            win.document.body.appendChild(downloadButton);
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

  private updateDisplayedVerificables(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedVerificables = this.verificables.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  public updateData(newData: Verificable[], selectedRespId?: string, recomendaciones?: any): void {
    if (selectedRespId !== undefined) {
      this.selectedResponsableId = selectedRespId;
    }
    if (recomendaciones) {
      this.recomendaciones = recomendaciones;
    }
    this.verificables = newData;
    this.currentPage = 1;
    this.updateResponsablesGroups();
  }

  protected updateDisplayedResponsables(): void {
    const total = this.responsablesGroups?.length || 0;
    const maxPages = Math.ceil(total / this.itemsPerPage) || 1;
    if (this.currentPage > maxPages) {
      this.currentPage = maxPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.displayedResponsablesGroups = this.responsablesGroups.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedResponsables();
  }

  protected onItemsPerPageChange(items: number): void {
    this.itemsPerPage = items;
    this.currentPage = 1;
    this.updateDisplayedResponsables();
  }

  protected validarVerificable(hallazgo: Verificable): void {
    if (this.isEditOrDeleteDisabled(hallazgo)) {
      return;
    }
    const arereCodigo = this.recomendaciones?.arere_codigo
      || (hallazgo as any).arere_codigo
      || Number(this.auxiliarySrv.getUrlParameter('id_det_rec'))
      || 0;
    (hallazgo as any).arere_codigo = arereCodigo;
    (hallazgo as any).ainin_memorando = this.recomendaciones?.ainin_memorando || (hallazgo as any).ainin_memorando;
    (hallazgo as any).ainin_titulo = this.recomendaciones?.ainin_titulo || (hallazgo as any).ainin_titulo;
    (hallazgo as any).arere_descripcion = this.recomendaciones?.arere_descripcion || (hallazgo as any).arere_descripcion;
    this.modalFormSrv.openModal(hallazgo, 'edit');
  }

  protected openModalEditVerificable(event: Event, verifiacble: Verificable) {
    if (this.isEditOrDeleteDisabled(verifiacble)) {
      return;
    }
    const arereCodigo = this.recomendaciones?.arere_codigo
      || (verifiacble as any).arere_codigo
      || Number(this.auxiliarySrv.getUrlParameter('id_det_rec'))
      || 0;
    (verifiacble as any).arere_codigo = arereCodigo;
    (verifiacble as any).ainin_memorando = this.recomendaciones?.ainin_memorando || (verifiacble as any).ainin_memorando;
    (verifiacble as any).ainin_titulo = this.recomendaciones?.ainin_titulo || (verifiacble as any).ainin_titulo;
    (verifiacble as any).arere_descripcion = this.recomendaciones?.arere_descripcion || (verifiacble as any).arere_descripcion;
    this.modalFormVerSrv.openModal(verifiacble, 'edit');
  }

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarySrv.hasRole(roleIds);
  }

  protected openModalFechaMax(event: Event, verificable: Verificable): void {
    event.preventDefault();
    if (this.isEditOrDeleteDisabled(verificable)) {
      return;
    }
    const arereCodigo = this.recomendaciones?.arere_codigo
      || (verificable as any).arere_codigo
      || Number(this.auxiliarySrv.getUrlParameter('id_det_rec'))
      || 0;
    const initialFecha = (verificable as any).aredr_fecha_maxima 
      || (verificable as any).arere_fecha_maxima 
      || (verificable.responsable as any)?.aredr_fecha_maxima 
      || this.recomendaciones?.arere_fecha_maxima
      || '';
    const modalObj = {
      arere_codigo: arereCodigo,
      arers_codigo: (verificable.responsable as any)?.arers_codigo,
      aredr_codigo: (verificable as any).aredr_codigo,
      arere_fecha_maxima: initialFecha,
      ainin_memorando: this.recomendaciones?.ainin_memorando || '',
      ainin_titulo: this.recomendaciones?.ainin_titulo || '',
      arere_descripcion: this.recomendaciones?.arere_descripcion || '',
      arere_evidencia_requerida: this.recomendaciones?.arere_evidencia_requerida || '',
      detalleRecomendacion: {
        ainin_memorando: this.recomendaciones?.ainin_memorando || '',
        ainin_titulo: this.recomendaciones?.ainin_titulo || '',
        ainin_memo_aprobacion: (this.recomendaciones as any)?.ainin_memo_aprobacion || '',
        recomendaciones: {
          arere_codigo: arereCodigo,
          arere_descripcion: this.recomendaciones?.arere_descripcion || '',
          arere_fecha_maxima: initialFecha,
          plazo: (this.recomendaciones as any)?.plazo || 0
        }
      }
    };
    this.modalFormRecFechaSrv.openModal(modalObj as any, 'edit');
  }

  protected openPlanAccion(verificable?: Verificable): void {
    let arereCodigo = Number(this.auxiliarySrv.getUrlParameter('id_det_rec')) || 0;
    if ((!arereCodigo || isNaN(arereCodigo)) && this.recomendaciones?.arere_codigo) {
      arereCodigo = Number(this.recomendaciones.arere_codigo);
    }
    const recObj = {
      arere_codigo: arereCodigo,
      ainin_memorando: (this.recomendaciones as any)?.ainin_memorando || '',
      ainin_titulo: (this.recomendaciones as any)?.ainin_titulo || '',
      recomendaciones: {
        arere_codigo: arereCodigo,
        arere_num_rec: this.recomendaciones?.arere_num_rec || (verificable as any)?.arere_num_rec || '',
        arere_descripcion: this.recomendaciones?.arere_descripcion || (verificable as any)?.arere_descripcion || '',
        arere_evidencia_requerida: this.recomendaciones?.arere_evidencia_requerida || (verificable as any)?.arere_evidencia_requerida || '',
        arere_fecha_maxima: (verificable as any)?.aredr_fecha_maxima || (verificable as any)?.arere_fecha_maxima || ''
      }
    };
    this.planAccionSrv.openModal(recObj as any, true); // true = solo lectura para auditor
  }

  protected descargarPlanExcel(group: ResponsableGroupView, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!group.plan || group.plan.length === 0) {
      this.alertsService.showAlert('No hay actividades registradas en el plan de acción para este responsable.', 'warning');
      return;
    }
    const fMaxInd = group.responsable?.aredr_fecha_maxima
      || (group.verificables && group.verificables[0]?.aredr_fecha_maxima)
      || (this.recomendaciones as any)?.fecha_maxima_individual
      || (this.recomendaciones as any)?.arere_fecha_maxima
      || '';

    let estadoInd = group.responsable?.estado_individual?.arees_descripcion
      || group.responsable?.estado_individual
      || group.responsable?.estado_plazo
      || group.responsable?.areev_descripcion
      || (group.verificables && group.verificables[0]?.estado_seguimiento?.areev_descripcion)
      || this.recomendaciones?.estado_seguimiento?.arees_descripcion
      || 'EN PROCESO';

    if (group.responsable?.estado_plazo === 'CUMPLIDO' || this.isRecomendacionCumplida(group)) {
      estadoInd = 'CUMPLIDA';
    }

    try {
      this.planAccionSrv.exportarExcelAuditor({
        recomendacion: this.recomendaciones,
        responsable: group.responsable,
        actividades: group.plan,
        memorando: this.recomendaciones?.ainin_memorando,
        tituloInforme: this.recomendaciones?.ainin_titulo,
        fechaMaximaIndividual: fMaxInd,
        estadoIndividual: estadoInd,
        listaEvidencias: group.listaEvidencias
      });
      this.alertsService.showAlert('Plan de acción descargado exitosamente en formato Excel (.xlsx).', 'success');
    } catch (err: any) {
      this.alertsService.showAlert(err?.message || 'Error al descargar el plan en Excel.', 'error');
    }
  }

  protected isRecomendacionCumplida(group?: ResponsableGroupView): boolean {
    if (this.isCumplida) return true;
    const estado = this.recomendaciones?.estado_seguimiento?.arees_descripcion?.toUpperCase()?.trim();
    const codigo = this.recomendaciones?.estado_seguimiento?.arees_codigo;
    if (codigo === 2 || estado === 'CUMPLIDA') return true;
    if (group?.responsable?.estado_plazo === 'CUMPLIDO') return true;
    return false;
  }

  public getFechaMaxima(group: ResponsableGroupView): string {
    const f = group.responsable?.aredr_fecha_maxima
      || (group.verificables && group.verificables[0]?.aredr_fecha_maxima)
      || (this.recomendaciones as any)?.fecha_maxima_individual
      || (this.recomendaciones as any)?.arere_fecha_maxima
      || '';
    return f ? this.planAccionSrv.normalizeDateToDdmmyyyy(f) || f : '';
  }

  public getPlazoDias(group: ResponsableGroupView): number | null {
    if (group.responsable?.plazo !== undefined && group.responsable?.plazo !== null) {
      return group.responsable.plazo;
    }
    const fStr = this.getFechaMaxima(group);
    if (!fStr) return null;
    const parts = fStr.split('/');
    if (parts.length === 3) {
      const target = new Date(+parts[2], +parts[1] - 1, +parts[0]);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - hoy.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return null;
  }

  public getEstadoPlazo(group: ResponsableGroupView): string {
    if (this.isRecomendacionCumplida(group)) {
      return 'CUMPLIDO';
    }
    if (group.responsable?.estado_plazo) {
      return group.responsable.estado_plazo;
    }
    const plazo = this.getPlazoDias(group);
    if (plazo === null) return '';
    return plazo < 0 ? 'VENCIDO' : 'EN PLAZO';
  }

  public getPlazoTexto(group: ResponsableGroupView): string {
    if (this.getEstadoPlazo(group) === 'CUMPLIDO') {
      return 'Cumplido';
    }
    const dias = this.getPlazoDias(group);
    if (dias === null) {
      return 'Sin plazo';
    }
    if (dias < 0) {
      return `Vencido (${dias} d)`;
    }
    if (dias === 0) {
      return 'Vence hoy (0 d)';
    }
    return `En Plazo (+${dias} d)`;
  }

  protected openModalAgregar(group: ResponsableGroupView): void {
    const dataInit: any = {
      responsable: group.responsable,
      arers_codigo_per: group.responsable?.arers_codigo_per
    };
    this.modalFormVerSrv.openModal(dataInit, 'create');
  }

  protected openModalAdicional(group: ResponsableGroupView): void {
    const dataInit: any = {
      responsable: group.responsable,
      arers_codigo_per: group.responsable?.arers_codigo_per
    };
    this.modalFormVerSrv.openModal(dataInit, 'adicional');
  }

  // Agrupamiento de información por Responsable
  public updateResponsablesGroups(): void {
    let arereCodigo = Number(this.auxiliarySrv.getUrlParameter('id_det_rec')) || 0;
    if ((!arereCodigo || isNaN(arereCodigo)) && this.recomendaciones?.arere_codigo) {
      arereCodigo = Number(this.recomendaciones.arere_codigo);
    }
    const allVerif = this.verificables || [];

    const savedFilter = this.filterStateService.getFilters('rec_verificables_verificables');
    const filterResp = (this.selectedResponsableId && this.selectedResponsableId !== '0')
      ? String(this.selectedResponsableId).trim()
      : (savedFilter?.arers_codigo_per && savedFilter.arers_codigo_per !== '0' ? String(savedFilter.arers_codigo_per).trim() : null);

    const isRespMatchingFilter = (resp: any): boolean => {
      if (!filterResp || filterResp === '0') return true;
      const codPer = String(resp?.arers_codigo_per || '').trim();
      const cod = String(resp?.arers_codigo || '').trim();
      const codDr = String(resp?.aredr_codigo || '').trim();
      return codPer === filterResp || cod === filterResp || codDr === filterResp;
    };

    const groupsMap: { [key: string]: ResponsableGroupView } = {};
    const getKey = (item: any) => item?.responsable?.arers_codigo_per || item?.responsable?.aredr_codigo || item?.aredr_codigo || (item?.responsable?.nombre_completo || 'default');

    allVerif.forEach((v) => {
      if (!isRespMatchingFilter(v.responsable)) {
        return;
      }
      const key = getKey(v);
      if (!groupsMap[key]) {
        const respObj: any = v.responsable ? { ...v.responsable } : { nombre_completo: 'Responsable Asignado' };
        if (v.aredr_codigo && !respObj.aredr_codigo) {
          respObj.aredr_codigo = v.aredr_codigo;
        }
        if (v.aredr_fecha_maxima && !respObj.aredr_fecha_maxima) {
          respObj.aredr_fecha_maxima = v.aredr_fecha_maxima;
        }
        groupsMap[key] = {
          responsable: respObj,
          verificables: [],
          plan: [],
          listaEvidencias: [],
          checklist: {},
          isPlanExpanded: false,
          isChecklistExpanded: false
        };
      } else {
        if (v.aredr_codigo && !(groupsMap[key].responsable as any)?.aredr_codigo) {
          (groupsMap[key].responsable as any).aredr_codigo = v.aredr_codigo;
        }
        if (v.aredr_fecha_maxima && !(groupsMap[key].responsable as any)?.aredr_fecha_maxima) {
          (groupsMap[key].responsable as any).aredr_fecha_maxima = v.aredr_fecha_maxima;
        }
      }
      groupsMap[key].verificables.push(v);
    });

    if (arereCodigo) {
      this.verificableSrv.getResposablesForFilter(String(arereCodigo)).subscribe({
        next: (respFilter) => {
          const listResp = respFilter.datos || [];
          listResp.forEach((r: any) => {
            if (!isRespMatchingFilter(r)) {
              return;
            }
            const rKey = r.arers_codigo_per || r.aredr_codigo || r.nombre_completo;
            if (!groupsMap[rKey]) {
              groupsMap[rKey] = {
                responsable: r,
                verificables: [],
                plan: [],
                listaEvidencias: [],
                checklist: {},
                isPlanExpanded: false,
                isChecklistExpanded: false
              };
            } else {
              groupsMap[rKey].responsable = {
                ...r,
                ...groupsMap[rKey].responsable,
                aredr_fecha_maxima: r.aredr_fecha_maxima || (groupsMap[rKey].responsable as any)?.aredr_fecha_maxima,
                plazo: r.plazo !== undefined && r.plazo !== null ? r.plazo : (groupsMap[rKey].responsable as any)?.plazo,
                estado_plazo: r.estado_plazo || (groupsMap[rKey].responsable as any)?.estado_plazo,
              };
            }
          });
          if (Object.keys(groupsMap).length === 0) {
            groupsMap['default'] = {
              responsable: { nombre_completo: 'Responsable Asignado' },
              verificables: [],
              plan: [],
              listaEvidencias: [],
              checklist: {},
              isPlanExpanded: false,
              isChecklistExpanded: false
            };
          }
          this.finalizarConfiguracionGrupos(groupsMap, arereCodigo, filterResp);
        },
        error: () => {
          if (Object.keys(groupsMap).length === 0) {
            groupsMap['default'] = {
              responsable: { nombre_completo: 'Responsable Asignado' },
              verificables: [],
              plan: [],
              listaEvidencias: [],
              checklist: {},
              isPlanExpanded: false,
              isChecklistExpanded: false
            };
          }
          this.finalizarConfiguracionGrupos(groupsMap, arereCodigo, filterResp);
        }
      });
    } else {
      if (Object.keys(groupsMap).length === 0) {
        groupsMap['default'] = {
          responsable: { nombre_completo: 'Responsable Asignado' },
          verificables: [],
          plan: [],
          listaEvidencias: [],
          checklist: {},
          isPlanExpanded: false,
          isChecklistExpanded: false
        };
      }
      this.finalizarConfiguracionGrupos(groupsMap, arereCodigo, filterResp);
    }
  }

  private finalizarConfiguracionGrupos(groupsMap: { [key: string]: ResponsableGroupView }, arereCodigo: number, filterResp: string | null): void {
    const rawEvidencias = this.recomendaciones?.arere_evidencia_requerida
      || (this.verificables[0] as any)?.arere_evidencia_requerida;
    const listaGeneral = this.planAccionSrv.parseListaEvidencias(rawEvidencias);

    const configurarGruposConEvidencias = (evidenciasList: string[]) => {
      Object.values(groupsMap).forEach((grp) => {
        const aredrCodigo = grp.responsable?.aredr_codigo;
        const aredrNum = aredrCodigo && !isNaN(Number(aredrCodigo)) && Number(aredrCodigo) > 0 ? Number(aredrCodigo) : null;
        grp.plan = aredrNum ? (this.planAccionSrv.getActividades(arereCodigo, undefined, aredrNum) || []) : [];
        grp.listaEvidencias = evidenciasList.length > 0 ? [...evidenciasList] : [];
        grp.checklist = {};

        // Inicializar cada evidencia en false (sin datos de prueba ni suposiciones)
        grp.listaEvidencias.forEach((ev: string) => {
          grp.checklist[ev] = false;
        });

        // Intentar cargar cotejo y plan guardados en backend si tenemos aredrCodigo válido
        if (arereCodigo && aredrNum) {
          this.planAccionSrv.obtenerCotejoEvidenciasApi(arereCodigo, aredrNum).subscribe({
            next: (resp) => {
              if (resp && resp.datos && Array.isArray(resp.datos) && resp.datos.length > 0) {
                resp.datos.forEach((item: any) => {
                  if (item.arer_descripcion) {
                    grp.checklist[item.arer_descripcion] = !!item.cumple;
                  }
                });
              }
            },
            error: () => {}
          });

          this.planAccionSrv.obtenerPlanAccionApi(arereCodigo, aredrNum).subscribe({
            next: (resp) => {
              if (resp && resp.datos && Array.isArray(resp.datos.actividades) && resp.datos.actividades.length > 0) {
                grp.plan = resp.datos.actividades.map((a: any, idx: number) => ({
                  id: `${arereCodigo}-${a.arpac_codigo || idx + 1}`,
                  num_actividad: a.num_actividad || idx + 1,
                  actividad: a.actividad || '',
                  fecha_ejecucion: a.fecha_ejecucion || '',
                  entregable_esperado: a.entregable_esperado || '',
                  arpac_codigo: a.arpac_codigo,
                  arer_codigo: a.arer_codigo
                }));
              } else {
                grp.plan = [];
              }
            },
            error: () => {
              grp.plan = [];
            }
          });
        } else {
          grp.plan = [];
        }
      });

      let groups = Object.values(groupsMap);
      if (filterResp && filterResp !== '0') {
        groups = groups.filter(grp => {
          const codPer = String(grp.responsable?.arers_codigo_per || '').trim();
          const cod = String(grp.responsable?.arers_codigo || '').trim();
          const codDr = String(grp.responsable?.aredr_codigo || '').trim();
          return codPer === filterResp || cod === filterResp || codDr === filterResp;
        });
      }
      this.responsablesGroups = groups;
      this.updateDisplayedResponsables();
    };

    if (listaGeneral.length > 0) {
      configurarGruposConEvidencias(listaGeneral);
    }

    if (arereCodigo) {
      this.planAccionSrv.obtenerEvidenciasRequeridasApi(arereCodigo).subscribe({
        next: (resp) => {
          if (resp && resp.datos && Array.isArray(resp.datos) && resp.datos.length > 0) {
            let listaBackend = resp.datos.map(d => d.arer_descripcion).filter(Boolean);
            if (listaBackend.length === 1 && (listaBackend[0].includes(';') || listaBackend[0].length > 100)) {
              listaBackend = this.planAccionSrv.parseListaEvidencias(listaBackend[0]);
            }
            listaBackend = Array.from(new Set(listaBackend.map(s => s.trim())));
            configurarGruposConEvidencias(listaBackend.length > 0 ? listaBackend : listaGeneral);
          } else if (listaGeneral.length === 0) {
            configurarGruposConEvidencias(listaGeneral);
          }
        },
        error: () => {
          if (listaGeneral.length === 0) {
            configurarGruposConEvidencias(listaGeneral);
          }
        }
      });
    } else if (listaGeneral.length === 0) {
      configurarGruposConEvidencias(listaGeneral);
    }
  }

  protected toggleCheckEvidencia(ev: string, group: ResponsableGroupView): void {
    group.checklist[ev] = !group.checklist[ev];
  }

  protected marcarTodasEvidencias(cumple: boolean, group: ResponsableGroupView): void {
    group.listaEvidencias.forEach((ev: string) => {
      group.checklist[ev] = cumple;
    });
  }

  protected guardarCotejoEvidencias(group: ResponsableGroupView): void {
    const arereCodigo = Number(this.auxiliarySrv.getUrlParameter('id_det_rec')) || this.recomendaciones?.arere_codigo || 0;
    const aredrCodigo = group.responsable?.aredr_codigo || group.responsable?.arers_codigo_per;
    if (arereCodigo && aredrCodigo) {
      this.planAccionSrv.guardarCotejoEvidenciasApi({
        arere_codigo: arereCodigo,
        aredr_codigo: Number(aredrCodigo),
        checklist: group.checklist
      }).subscribe({
        next: () => {
          this.alertsService.showAlert('Cotejo de evidencias guardado exitosamente', 'success');
        },
        error: (err) => {
          console.warn('Error al guardar cotejo en el servidor:', err);
        }
      });
    }

    if (arereCodigo && group.plan?.length > 0) {
      const actualizadas = group.plan.map(act => {
        const cumple = act.entregable_esperado && group.checklist[act.entregable_esperado];
        return {
          ...act,
          estado_cumplimiento: (cumple ? 'CUMPLE' : act.estado_cumplimiento || 'PENDIENTE') as any
        };
      });
      this.planAccionSrv.saveActividades(arereCodigo, actualizadas, undefined, aredrCodigo);
      this.alertsService.showAlert('Cotejo de evidencias sincronizado con el Plan de Acción', 'success');
    } else {
      this.alertsService.showAlert('Cotejo de evidencias registrado para este responsable', 'success');
    }
  }

  protected getTotalEvidencias(group: ResponsableGroupView): number {
    return group.listaEvidencias ? group.listaEvidencias.length : 0;
  }

  protected getEvidenciasCumplidas(group: ResponsableGroupView): number {
    return group.listaEvidencias ? group.listaEvidencias.filter((ev: string) => group.checklist[ev]).length : 0;
  }

  protected getPorcentajeCumplimiento(group: ResponsableGroupView): number {
    const tot = this.getTotalEvidencias(group);
    return tot > 0 ? Math.round((this.getEvidenciasCumplidas(group) / tot) * 100) : 0;
  }

  protected getFileName(ruta?: string): string {
    if (!ruta) return 'Documento adjunto';
    return String(ruta).split('/').pop() || 'Documento adjunto';
  }
}
