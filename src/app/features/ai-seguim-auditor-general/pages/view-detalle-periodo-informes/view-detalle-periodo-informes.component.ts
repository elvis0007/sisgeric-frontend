import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PeriodoEvaluacionService } from '../../services/periodo-evaluacion.service';
import { PeriodoEvaluacion, PeriodoInformeDetalle } from '../../models/periodo-evaluacion.model';
import { InformesAgService } from '../../services/informes-ag/informes-ag.service';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { ComponentCanDeactivate } from '@core/guards/pending-changes.guard';
import { forkJoin, Observable } from 'rxjs';
import { PaginationComponent } from '@core/ui/pagination/pagination.component';

export interface ResponsableTreeItem {
  arers_codigo: number;
  arere_codigo: number;
  nombre_completo: string;
  departamento: string;
  incluido: number;
}

export interface RecomendacionTreeItem {
  arere_codigo: number;
  ainin_codigo: number;
  numero_recomendacion: number;
  recomendacion_descripcion: string;
  incluido: number;
  expanded?: boolean;
  responsables: ResponsableTreeItem[];
}

export interface InformeTreeItem extends PeriodoInformeDetalle {
  expanded?: boolean;
  recomendaciones: RecomendacionTreeItem[];
}

@Component({
  selector: 'app-view-detalle-periodo-informes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule,  PaginationComponent],
  templateUrl: './view-detalle-periodo-informes.component.html',
  styleUrls: ['./view-detalle-periodo-informes.component.css'],
})
export class ViewDetallePeriodoInformesComponent implements OnInit, ComponentCanDeactivate {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly periodoSrv = inject(PeriodoEvaluacionService);
  private readonly informesSrv = inject(InformesAgService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly modalConfirmSrv = inject(ModalConfirmationService);
  private readonly avisoCambioInformeStorageKey = 'sisrec_no_mostrar_advertencia_cambio_informe_periodo';

  periodoId!: number;
  periodo: PeriodoEvaluacion | null = null;

  // Arbol Jerárquico: Informe -> Recomendaciones -> Responsables
  informesTree: InformeTreeItem[] = [];
  filteredTree: InformeTreeItem[] = [];

  isLoading = false;
  isSaving = false;
  searchTerm = '';
  hayCambiosPendientes = false;
  private informeConCambiosSinAvisar: number | null = null;

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.hayCambiosPendientes) {
      $event.preventDefault();
      $event.returnValue = true;
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (!this.hayCambiosPendientes) {
      return true;
    }

    return new Observable<boolean>((observer) => {
      const actionId = this.modalConfirmSrv.show({
        title: 'Cambios pendientes por guardar',
        message: 'Tiene cambios pendientes por guardar en este periodo de evaluación. ¿Está seguro de que desea salir sin guardar?',
        confirmText: 'SALIR SIN GUARDAR',
        cancelText: 'SEGUIR EDITANDO',
        confirmButtonType: 'primary',
        cancelButtonType: 'error',
      });

      const subConfirm = this.modalConfirmSrv.onConfirmFor(actionId).subscribe(() => {
        subConfirm.unsubscribe();
        subCancel.unsubscribe();
        this.hayCambiosPendientes = false;
        observer.next(true);
        observer.complete();
      });

      const subCancel = this.modalConfirmSrv.onCancelFor(actionId).subscribe(() => {
        subConfirm.unsubscribe();
        subCancel.unsubscribe();
        observer.next(false);
        observer.complete();
      });
    });
  }

  // Control para modal de añadir informe extraordinario
  isAddModalOpen = false;
  informeSearchTerm = '';
  todosLosInformesDisponibles: any[] = [];
  informesFiltradosDisponibles: any[] = [];

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      localStorage.removeItem(this.avisoCambioInformeStorageKey);
      this.periodoId = Number(params['id']);
      if (this.periodoId) {
        this.cargarDetalleCompleto();
      }
    });
  }

  cargarDetalleCompleto(): void {
    this.isLoading = true;

    forkJoin({
      periodoRes: this.periodoSrv.getPeriodoById(this.periodoId),
      informesRes: this.periodoSrv.getInformesPorPeriodo(this.periodoId),
      recsRes: this.periodoSrv.getRecomendacionesPorPeriodo(this.periodoId),
      respsRes: this.periodoSrv.getResponsablesPorPeriodo(this.periodoId)
    }).subscribe({
      next: (data) => {
        this.periodo = data.periodoRes.datos;
        const seenAinin = new Set<number>();
        const uniqueInformes: PeriodoInformeDetalle[] = (data.informesRes.datos || []).filter((inf: PeriodoInformeDetalle) => {
          const id = Number(inf.ainin_codigo);
          if (seenAinin.has(id)) return false;
          seenAinin.add(id);
          return true;
        });
        const rawRecs: any[] = data.recsRes.datos || [];
        const rawResps: any[] = data.respsRes.datos || [];

        // Construir Estructura Jerárquica: Informe -> Recomendaciones -> Responsables
        this.informesTree = uniqueInformes.map((inf) => {
          // Filtrar recomendaciones pertenecientes a este informe
          const recsDelInforme: RecomendacionTreeItem[] = rawRecs
            .filter((r) => Number(r.ainin_codigo) === Number(inf.ainin_codigo))
            .map((r) => {
              // Filtrar responsables asociados a esta recomendación
              const respsDeLaRec: ResponsableTreeItem[] = rawResps
                .filter((resp) => Number(resp.arere_codigo) === Number(r.arere_codigo))
                .map((resp) => ({
                  arers_codigo: Number(resp.arers_codigo),
                  arere_codigo: Number(resp.arere_codigo),
                  nombre_completo: resp.nombre_completo,
                  departamento: resp.departamento,
                  incluido: resp.incluido !== undefined ? Number(resp.incluido) : 1
                }));

              return {
                arere_codigo: Number(r.arere_codigo),
                ainin_codigo: Number(r.ainin_codigo),
                numero_recomendacion: r.numero_recomendacion,
                recomendacion_descripcion: r.recomendacion_descripcion,
                incluido: r.incluido !== undefined ? Number(r.incluido) : 1,
                expanded: false,
                responsables: respsDeLaRec
              };
            });

          return {
            ...inf,
            expanded: false,
            recomendaciones: recsDelInforme
          };
        });

        this.filtrar();
        this.hayCambiosPendientes = false;
        this.informeConCambiosSinAvisar = null;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar detalle del periodo:', err);
        this.alertsService.showAlert('No se pudo cargar el detalle del periodo de evaluación.', 'error');
        this.isLoading = false;
      }
    });
  }

  toggleExpandInforme(inf: InformeTreeItem): void {
    if (!inf.expanded) {
      this.avisarAlCambiarInforme(inf.ainin_codigo);
    }
    inf.expanded = !inf.expanded;
  }

  private avisarAlCambiarInforme(informeId: number): void {
    if (!this.hayCambiosPendientes || this.informeConCambiosSinAvisar === null ||
      this.informeConCambiosSinAvisar === informeId) {
      return;
    }

    this.informeConCambiosSinAvisar = null;
    if (localStorage.getItem(this.avisoCambioInformeStorageKey) === 'true') {
      return;
    }

    this.modalConfirmSrv.show({
      title: 'Cambios pendientes por guardar',
      message: 'El informe anterior tiene cambios sin guardar. Puede continuar trabajando en este informe; los cambios se conservarán pendientes hasta que presione GUARDAR CAMBIOS.',
      confirmText: 'ENTENDIDO',
      cancelText: '',
      confirmButtonType: 'primary',
      showDonotShowAgain: true,
      donotShowAgainStorageKey: this.avisoCambioInformeStorageKey,
    });
  }

  toggleExpandRecomendacion(rec: RecomendacionTreeItem): void {
    rec.expanded = !rec.expanded;
  }

  toggleRecomendacion(rec: RecomendacionTreeItem): void {
    this.avisarAlCambiarInforme(rec.ainin_codigo);
    rec.incluido = rec.incluido === 1 ? 0 : 1;
    this.hayCambiosPendientes = true;
    this.informeConCambiosSinAvisar = rec.ainin_codigo;
  }

  toggleResponsable(resp: ResponsableTreeItem, informeId: number): void {
    this.avisarAlCambiarInforme(informeId);
    resp.incluido = resp.incluido === 1 ? 0 : 1;
    this.hayCambiosPendientes = true;
    this.informeConCambiosSinAvisar = informeId;
  }

  expandirTodos(): void {
    this.filteredTree.forEach((inf) => {
      inf.expanded = true;
      inf.recomendaciones.forEach((rec) => rec.expanded = true);
    });
  }

  colapsarTodos(): void {
    this.filteredTree.forEach((inf) => {
      inf.expanded = false;
      inf.recomendaciones.forEach((rec) => rec.expanded = false);
    });
  }

  filtrar(): void {
    if (!this.searchTerm.trim()) {
      this.filteredTree = [...this.informesTree];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredTree = this.informesTree.filter((inf) => {
      const coincideInforme =
        (inf.ainin_titulo && inf.ainin_titulo.toLowerCase().includes(term)) ||
        (inf.ainin_memorando && inf.ainin_memorando.toLowerCase().includes(term)) ||
        (inf.organismo_control && inf.organismo_control.toLowerCase().includes(term));

      const coincideRec = inf.recomendaciones.some(
        (r) =>
          (r.recomendacion_descripcion && r.recomendacion_descripcion.toLowerCase().includes(term)) ||
          r.responsables.some((resp) => resp.nombre_completo && resp.nombre_completo.toLowerCase().includes(term))
      );

      return coincideInforme || coincideRec;
    });
  }

  removerInforme(informe: InformeTreeItem): void {
    const memoOtitulo = informe.ainin_memorando
      ? `"${informe.ainin_memorando}"`
      : (informe.ainin_titulo ? `"${informe.ainin_titulo}"` : 'este informe');

    const actionId = this.modalConfirmSrv.show({
      title: 'Confirmación',
      message: `¿Está seguro de que desea eliminar el informe ${memoOtitulo} del periodo al que pertenece?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'primary',
      cancelButtonType: 'error',
    });

    const sub = this.modalConfirmSrv.onConfirmFor(actionId).subscribe(() => {
      sub.unsubscribe();

      const remainingInformesIds = this.informesTree
        .filter((i) => i.ainin_codigo !== informe.ainin_codigo)
        .map((i) => i.ainin_codigo);

      this.isSaving = true;
      this.alertsService.showAlert('Eliminando informe del periodo...', 'info');

      this.periodoSrv.actualizarInformesPeriodo(this.periodoId, remainingInformesIds).subscribe({
        next: () => {
          this.informesTree = this.informesTree.filter((i) => i.ainin_codigo !== informe.ainin_codigo);
          this.filtrar();
          this.isSaving = false;
          this.alertsService.showAlert(`Informe ${informe.ainin_memorando || ''} eliminado del periodo exitosamente.`, 'success');
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error al eliminar informe del periodo:', err);
          this.alertsService.showAlert('Error al eliminar el informe del periodo.', 'error');
        }
      });
    });
  }

  openAddModal(): void {
    this.isAddModalOpen = true;
    this.cargarInformesDisponibles();
  }

  closeAddModal(): void {
    this.isAddModalOpen = false;
  }

  cargarInformesDisponibles(): void {
    this.informesSrv.getFilteredInformes(0, 0, '2000-01-01', '2100-12-31', '').subscribe({
      next: (res) => {
        const codigosExistentes = new Set(this.informesTree.map((i) => i.ainin_codigo));
        this.todosLosInformesDisponibles = (res.datos || []).map((inf: any) => ({
          ainin_codigo: inf.ainin_codigo,
          ainin_titulo: inf.ainin_titulo,
          ainin_memorando: inf.ainin_memorando || inf.ainin_memoAprobacion || 'MEMO-AI',
          ainin_fecha_emision: inf.ainin_fechaEmision || inf.ainin_fechaAprobacion,
          organismo_control: inf.organismoControl?.ainoc_descripcion || 'N/A'
        })).filter((inf: any) => !codigosExistentes.has(inf.ainin_codigo));
        this.informesFiltradosDisponibles = [...this.todosLosInformesDisponibles];
      },
      error: () => {
        this.todosLosInformesDisponibles = [];
        this.informesFiltradosDisponibles = [];
      }
    });
  }

  filtrarDisponibles(): void {
    if (!this.informeSearchTerm.trim()) {
      this.informesFiltradosDisponibles = [...this.todosLosInformesDisponibles];
      return;
    }
    const term = this.informeSearchTerm.toLowerCase();
    this.informesFiltradosDisponibles = this.todosLosInformesDisponibles.filter(
      (i) =>
        (i.ainin_titulo && i.ainin_titulo.toLowerCase().includes(term)) ||
        (i.ainin_memorando && i.ainin_memorando.toLowerCase().includes(term))
    );
  }

  agregarInformeManual(item: any): void {
    const nuevo: InformeTreeItem = {
      arcev_codigo: this.periodoId,
      ainin_codigo: item.ainin_codigo,
      ainin_titulo: item.ainin_titulo,
      ainin_memorando: item.ainin_memorando,
      ainin_fecha_emision: item.ainin_fecha_emision,
      organismo_control: item.organismo_control,
      arcei_es_manual: 1,
      expanded: true,
      recomendaciones: []
    };
    this.informesTree.push(nuevo);
    this.filtrar();
    this.alertsService.showAlert(`Informe ${item.ainin_memorando} agregado extraordinariamente. Recuerde guardar los cambios.`, 'info');
    this.closeAddModal();
    this.hayCambiosPendientes = true;
    this.informeConCambiosSinAvisar = nuevo.ainin_codigo;
  }

  guardarCambios(): void {
    this.isSaving = true;
    const informesIds = this.informesTree.map((i) => i.ainin_codigo);

    // Recolectar recomendaciones incluidas y excluidas de toda la jerarquía
    const recsIncluidasSet = new Set<number>();
    const recsExcluidasSet = new Set<number>();
    const respIncluidosSet = new Set<number>();
    const respExcluidosSet = new Set<number>();

    this.informesTree.forEach((inf) => {
      inf.recomendaciones.forEach((rec) => {
        if (rec.incluido === 1) {
          recsIncluidasSet.add(rec.arere_codigo);
        } else {
          recsExcluidasSet.add(rec.arere_codigo);
        }

        rec.responsables.forEach((resp) => {
          if (resp.incluido === 1) {
            respIncluidosSet.add(resp.arers_codigo);
          } else {
            respExcluidosSet.add(resp.arers_codigo);
          }
        });
      });
    });

    // 1. Guardar Informes
    this.periodoSrv.actualizarInformesPeriodo(this.periodoId, informesIds).subscribe({
      next: () => {
        // 2. Guardar Recomendaciones Excluidas/Incluidas
        this.periodoSrv.actualizarRecomendacionesPeriodo(
          this.periodoId,
          Array.from(recsIncluidasSet),
          Array.from(recsExcluidasSet)
        ).subscribe({
          next: () => {
            // 3. Guardar Responsables Excluidos/Incluidos
            this.periodoSrv.actualizarResponsablesPeriodo(
              this.periodoId,
              Array.from(respIncluidosSet),
              Array.from(respExcluidosSet)
            ).subscribe({
              next: () => {
                this.hayCambiosPendientes = false;
                this.isSaving = false;
                this.alertsService.showAlert('Jerarquía de informes del periodo guardada exitosamente.', 'success');
                this.volver();
              },
              error: (err) => {
                this.isSaving = false;
                console.error('Error al guardar responsables:', err);
                this.alertsService.showAlert('Error al guardar los responsables del periodo.', 'error');
              }
            });
          },
          error: (err) => {
            this.isSaving = false;
            console.error('Error al guardar recomendaciones:', err);
            this.alertsService.showAlert('Error al guardar las recomendaciones del periodo.', 'error');
          }
        });
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Error al guardar informes:', err);
        this.alertsService.showAlert('Error al guardar los informes del periodo.', 'error');
      },
    });
  }

  congelarSnapshot(): void {
    const fechaCorteStr = this.periodo?.arcev_fecha_corte ? new Date(this.periodo.arcev_fecha_corte).toLocaleDateString('es-EC') : 'la fecha límite';
    const actionId = this.modalConfirmSrv.show({
      title: 'Confirmación',
      message: `Esta opción guardará una fotografía fija del avance y los documentos de todas las recomendaciones al ${fechaCorteStr}.\n\nEsta copia servirá para sus reportes oficiales de auditoría y no se modificará aunque los responsables suban nuevos documentos después. ¿Desea congelar la fotografía ahora?`,
      confirmText: 'CONFIRMAR',
      cancelText: 'CANCELAR',
      confirmButtonType: 'secondary',
      cancelButtonType: 'ghost',
    });

    const sub = this.modalConfirmSrv.onConfirmFor(actionId).subscribe(() => {
      sub.unsubscribe();
      this.isSaving = true;
      this.alertsService.showAlert('Generando fotografía oficial del periodo...', 'info');
      this.periodoSrv.generarSnapshot(this.periodoId).subscribe({
        next: () => {
          this.isSaving = false;
          this.alertsService.showAlert('Fotografía oficial guardada exitosamente.', 'success');
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error al generar snapshot:', err);
          this.alertsService.showAlert('Error al guardar la fotografía oficial del periodo.', 'error');
        }
      });
    });
  }



  volver(): void {
    this.router.navigate(['/inicio/periodos-evaluacion']);
  }

  getTotalRecomendaciones(): number {
    return this.informesTree.reduce((acc, inf) => acc + inf.recomendaciones.length, 0);
  }

  getTotalRecomendacionesIncluidas(): number {
    return this.informesTree.reduce((acc, inf) => acc + inf.recomendaciones.filter(r => r.incluido === 1).length, 0);
  }

  getTotalResponsables(): number {
    return this.informesTree.reduce((acc, inf) => acc + inf.recomendaciones.reduce((rAcc, r) => rAcc + r.responsables.length, 0), 0);
  }

  getBadgeColor(tipo: string): string {
    return 'badge-primary text-white';
  }
  paginaInformes = 1;
  informesPorPagina = 10;

  get totalPaginasInformes(): number {
    return Math.max(
      1,
      Math.ceil(this.filteredTree.length / this.informesPorPagina)
    );
  }

  get paginaActualInformes(): number {
    return Math.min(this.paginaInformes, this.totalPaginasInformes);
  }

  get inicioInformes(): number {
    return (this.paginaActualInformes - 1) * this.informesPorPagina;
  }

  get finInformes(): number {
    return Math.min(
      this.inicioInformes + this.informesPorPagina,
      this.filteredTree.length
    );
  }

  get informesPaginados() {
    return this.filteredTree.slice(this.inicioInformes, this.finInformes);
  }

  cambiarPaginaInformes(pagina: number): void {
    this.paginaInformes = Math.max(
      1,
      Math.min(pagina, this.totalPaginasInformes)
    );
  }

  cambiarCantidadInformes(cantidad: number): void {
    this.informesPorPagina = Number(cantidad);
    this.paginaInformes = 1;
  }
}

