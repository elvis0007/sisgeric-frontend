import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { Notification } from '@core/auth/models/notification';
import { ModalNotificationInfoService } from '@core/services/notification/modal-notification-info.service';
import { NotificationContentService } from '@core/services/notification/notification-content.service';
import { NotificationService } from '@core/services/notification/notification.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';

@Component({
  selector: 'app-notification-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-content.component.html',
  styleUrl: './notification-content.component.css',
})
export class NotificationContentComponent implements OnInit {
  @Input() notifications: Notification[] = [];
  @Output() notificationRead = new EventEmitter<void>();
  private allNotifications: Notification[] = [];
  protected filteredNotifications: Notification[] = [];
  protected showAll: boolean = false;

  protected notificationContentService: NotificationContentService = inject(
    NotificationContentService
  );
  protected notificationSrv: NotificationService = inject(NotificationService);
  protected readonly modalNotificationInfo: ModalNotificationInfoService = inject(ModalNotificationInfoService);
  protected readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  protected readonly modalConfirmSrv: ModalConfirmationService = inject(ModalConfirmationService);
  private readonly router: Router = inject(Router);

  ngOnInit() {
    // Inicialización inicial
    this.updateAllNotifications();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Detectar cambios en las notificaciones de entrada
    if (changes['notifications']) {
      this.updateAllNotifications();
    }
  }

  private updateAllNotifications(): void {
    this.allNotifications = [...this.notifications];
    // Por defecto, mostrar solo las no leídas
    this.showUnreadNotifications();
  }

  closeModal(): void {
    this.notificationContentService.closeContent();
  }

  protected getUnreadCount(): number {
    return this.allNotifications.filter(n => n.anotif_estado === 0).length;
  }

  protected canMarkAsRead(notification: Notification): boolean {
    const userCuenta = this.auxiliarySrv.getUserCuenta();
    if (!notification.anotif_auditor_asignado) {
      return true;
    }
    return notification.anotif_auditor_asignado === userCuenta;
  }

  protected updateNotification(codNotification: number, event?: Event): void {
    // Evitar propagación si viene de un evento (por ejemplo, del checkbox)
    if (event) {
      event.stopPropagation();
    }
    
    const notification = this.allNotifications.find(n => n.anotif_codigo === codNotification);
    if (!notification) {
      return;
    }

    // Verificar si el usuario tiene permiso para marcarla como leída
    if (!this.canMarkAsRead(notification)) {
      return;
    }

    if (notification.anotif_estado === 0) {
      notification.anotif_estado = 1;
      this.updateFilteredNotifications();
      this.notificationRead.emit();
    }

    this.notificationSrv
      .updateNotification(codNotification)
      .subscribe({
        next: (response) => {
          console.log(response.mensaje);
        },
        error: () => {
          notification.anotif_estado = 0;
          this.updateFilteredNotifications();
          this.notificationRead.emit();
        }
      });
  }

  private readonly TIPO_ROUTE_MAP: Record<string, (n: Notification) => string> = {
    'verificable-pendiente': (n) => this.routeForVerificable(n),
    'verificable-actualizado': (n) => this.routeForVerificable(n),
    'verificable-eliminado': (n) => this.routeForVerificable(n),
    'verificable-eliminado-auditor': (n) => this.routeForVerificable(n),
    'solicitud-nueva': (n) => this.routeForSolicitud(n),
    'solicitud-preaprobada-director': (n) => this.routeForSolicitud(n),
    'solicitud-preaprobada': (n) => this.routeForSolicitud(n),
    'solicitud-actualizada': (n) => this.routeForSolicitud(n),
    'solicitud-rechazada': (n) => this.routeForSolicitud(n),
    'solicitud-caducada': (n) => this.routeForSolicitud(n),
    'solicitud-eliminada': (n) => this.routeForSolicitud(n),
    'solicitud-eliminada-auditor': (n) => this.routeForSolicitud(n),
    'recomendacion-asignada': (n) => this.routeForRecomendacion(n),
    'recomendacion-reasignada': (n) => this.routeForRecomendacion(n),
    'recomendacion-vencer': (n) => this.routeForRecomendacion(n),
    'recomendacion-vencida': (n) => this.routeForRecomendacion(n),
    'recomendacion-cumplida': (n) => this.routeForRecomendacion(n),
    'recomendacion-fecha-cambiada': () => 'recomendaciones',
    'plan-accion-requerido': (n) => this.routeForPlanAccion(n),
    'plan-accion-recordatorio': (n) => this.routeForPlanAccion(n),
    'plan-accion-vencido': (n) => this.routeForPlanAccion(n),
  };

  private hasRole(roleCodes: number[]): boolean {
    return this.auxiliarySrv.hasRole(roleCodes);
  }

  private routeForSolicitud(notification: Notification): string {
    if (this.hasRole([3])) return 'auditor-solicitudes';
    if (this.hasRole([5])) return 'director-solicitudes';
    if (this.hasRole([4])) return 'evidencias-responsables';
    if (this.hasRole([2])) return 'report-prorrogas-aij';
    return 'inicio';
  }

  private routeForVerificable(notification: Notification): string {
    if (this.hasRole([3]) || this.hasRole([2])) return 'informes-verificables';
    if (this.hasRole([4])) return 'evidencias-responsables';
    if (this.hasRole([5])) return 'director-informes';
    return 'inicio';
  }

  private routeForRecomendacion(notification: Notification): string {
    if (this.hasRole([3]) || this.hasRole([2])) return 'recomendaciones';
    if (this.hasRole([4])) return 'evidencias-responsables';
    if (this.hasRole([5])) return 'director-informes';
    return 'inicio';
  }

  private routeForPlanAccion(notification: Notification): string {
    if (this.hasRole([4])) return 'plan-accion-responsables';
    if (this.hasRole([3]) || this.hasRole([2])) return 'recomendaciones';
    if (this.hasRole([5])) return 'director-informes';
    return 'plan-accion-responsables';
  }

  private resolveNotificationUrl(notification: Notification): string | null {
    if (this.isVerificableNotification(notification)) {
      return this.routeForVerificable(notification);
    }

    if (this.isSolicitudNotification(notification)) {
      return this.routeForSolicitud(notification);
    }

    // 1) Si existe anotif_tipo, usarlo como discriminador
    const tipo = notification.anotif_tipo;
    if (tipo && tipo.trim() !== '') {
      const matcher = this.TIPO_ROUTE_MAP[tipo];
      if (matcher) {
        return matcher(notification);
      }
    }

    // 2) Fallback: si anotif_url_sistema es una ruta válida (no "url")
    const url = notification.anotif_url_sistema;
    if (url && url.trim() !== '' && url.trim().toLowerCase() !== 'url') {
      return url.trim();
    }

    // 3) Fallback: pattern matching textual (backward compatibility)
    const titulo = (notification.anotif_titulo || '').toLowerCase();
    const mensaje = (notification.anotif_mensaje || '').toLowerCase();

    if (
      titulo.includes('plan de acción') || titulo.includes('plan de accion') ||
      mensaje.includes('plan de acción') || mensaje.includes('plan de accion')
    ) {
      return this.routeForPlanAccion(notification);
    }

    if (
      titulo.includes('vencidas') || titulo.includes('vencer') ||
      titulo.includes('vence') || titulo.includes('vencen') ||
      titulo.includes('vencimiento') || mensaje.includes('vencieron') ||
      mensaje.includes('vencer') || mensaje.includes('vence') ||
      mensaje.includes('vencen') || mensaje.includes('vencimiento')
    ) {
      return this.routeForRecomendacion(notification);
    }

    if (
      titulo.includes('solicitud') || mensaje.includes('solicitud') ||
      titulo.includes('prórroga') || mensaje.includes('prórroga') ||
      titulo.includes('preaprobada') || mensaje.includes('preaprobada')
    ) {
      return this.routeForSolicitud(notification);
    }

    if (
      titulo.includes('verificable') || mensaje.includes('verificable') ||
      mensaje.includes('subió un verificable') || titulo.includes('revisión') ||
      mensaje.includes('revisión')
    ) {
      return this.routeForVerificable(notification);
    }

    if (
      titulo.includes('recomendación') || titulo.includes('recomendacion') ||
      mensaje.includes('recomendación') || mensaje.includes('recomendacion')
    ) {
      return this.routeForRecomendacion(notification);
    }

    return 'inicio';
  }

  private extractSolicitudCodigo(notification: Notification): string | null {
    const text = `${notification.anotif_titulo || ''} ${notification.anotif_mensaje || ''}`;
    const match = text.match(/(?:(?:N\.?\s*solicitud|solicitud(?:\s*de\s*pr[oó]rroga)?)\s*(?:N[°º\.]*|n[uú]m(?:ero)?\.?|#)?\s*)(\d+)/i);
    return match ? match[1] : null;
  }

  protected onNotificationClick(notification: Notification, event: Event): void {
    const resolvedUrl = this.resolveNotificationUrl(notification);
    if (!resolvedUrl || resolvedUrl.trim() === '') {
      if (notification.anotif_estado === 0 && this.canMarkAsRead(notification)) {
        this.updateNotification(notification.anotif_codigo);
      }
      return;
    }

    const targetUrl = resolvedUrl.trim();
    const tipo = notification.anotif_tipo || '';
    const anio = notification.anotif_anio;

    // Caso A: Enlace externo o correo
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://') || targetUrl.startsWith('mailto:')) {
      const actionId = this.modalConfirmSrv.show({
        title: 'Notificación externa',
        message: 'Para ver esta acción debe dirigirse a su correo institucional.',
        confirmText: 'ENTENDIDO',
        cancelText: '',
        confirmButtonType: 'primary'
      });

      const confirmSub = this.modalConfirmSrv.onConfirmFor(actionId).subscribe(() => {
        if (notification.anotif_estado === 0 && this.canMarkAsRead(notification)) {
          this.updateNotification(notification.anotif_codigo);
        }
        if (targetUrl.startsWith('mailto:')) {
          window.location.href = targetUrl;
        } else {
          window.open(targetUrl, '_blank');
        }
        cleanup();
      });

      const cancelSub = this.modalConfirmSrv.onCancelFor(actionId).subscribe(() => {
        cleanup();
      });

      const cleanup = () => {
        confirmSub.unsubscribe();
        cancelSub.unsubscribe();
      };
      return;
    }

    // Caso B: Enlace interno del sistema
    if (notification.anotif_estado === 0 && this.canMarkAsRead(notification)) {
      this.updateNotification(notification.anotif_codigo);
    }

    let route = targetUrl;
    const hasAuditorOperativo = this.auxiliarySrv.hasRole([3]);
    const hasAuditorJefe = this.auxiliarySrv.hasRole([2]);
    const isAssignedAuditor = notification.anotif_auditor_asignado === this.auxiliarySrv.getUserCuenta();

    // Navegación especial: recomendacion-fecha-cambiada → auditor-general
    if (tipo === 'recomendacion-fecha-cambiada') {
      const aininId = notification.anotif_ainin_codigo;
      const arereId = notification.anotif_arere_codigo;
      if (aininId && arereId) {
        this.notificationSrv.getCadenaIds(arereId).subscribe({
          next: (res) => {
            if (res && res.datos && res.datos.areco_codigo && res.datos.areha_codigo) {
              const url = `/inicio/auditor-general/hallazgos-auditor-gen/${btoa(aininId.toString())}/conclusiones-auditor-gen/${btoa(res.datos.areha_codigo.toString())}/recomendaciones-auditor-gen/${btoa(res.datos.areco_codigo.toString())}`;
              this.router.navigateByUrl(url).catch(() => this.navigateToFallback(route, anio, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor, notification));
            } else {
              this.navigateToFallback(route, anio, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor, notification);
            }
          },
          error: () => this.navigateToFallback(route, anio, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor, notification)
        });
      } else {
        this.navigateToFallback(route, anio, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor, notification);
      }
      this.closeModal();
      return;
    }

    // Routes que soportan navegación específica con IDs + año
    const routesWithIds = ['informes-verificables', 'verificables-responsables', 'evidencias-responsables', 'recomendaciones', 'auditor-solicitudes', 'director-solicitudes', 'plan-accion-responsables'];

    if (routesWithIds.includes(route) && notification.anotif_arere_codigo) {
      const navigateWithIds = (ainin_codigo: number | null, arere_codigo: number | null) => {
        if (ainin_codigo && arere_codigo) {
          let specRoute: string;
          if (route === 'informes-verificables') {
            const encAinin = btoa(ainin_codigo.toString());
            const encArere = btoa(arere_codigo.toString());
            specRoute = `/inicio/informes-verificables/recomendaciones-verificables/${encAinin}/verificables/${encArere}`;
          } else if (route === 'verificables-responsables' || route === 'evidencias-responsables') {
            const isSolicitud = tipo.includes('solicitud');
            const paramName = isSolicitud ? 'openSolicitudes' : 'openVerificables';
            specRoute = `/inicio/evidencias-responsables?${paramName}=${arere_codigo}`;
            if (anio) specRoute += `&anio=${anio}`;
          } else if (route === 'plan-accion-responsables') {
            specRoute = `/inicio/plan-accion-responsables?arere=${arere_codigo}`;
            if (anio) specRoute += `&anio=${anio}`;
          } else if (route === 'recomendaciones') {
            specRoute = `/inicio/recomendaciones?ainin=${ainin_codigo}&arere=${arere_codigo}`;
            if (anio) specRoute += `&anio=${anio}`;
          } else {
            let targetRoute = route;
            if (hasAuditorJefe && (!hasAuditorOperativo || !isAssignedAuditor) && targetRoute === 'auditor-solicitudes') {
              targetRoute = 'report-prorrogas-aij';
            }
            specRoute = `/inicio/${targetRoute}`;
            const queryParts: string[] = [];
            if (anio) queryParts.push(`anio=${anio}`);
            const codSolicitud = this.extractSolicitudCodigo(notification);
            if (codSolicitud) {
              queryParts.push(`solicitud=${codSolicitud}`);
            }
            if (arere_codigo) {
              queryParts.push(`arere=${arere_codigo}`);
            }
            if (queryParts.length > 0) {
              specRoute += `?${queryParts.join('&')}`;
            }
          }

          this.router.navigateByUrl(specRoute).catch(err => {
            console.error('Failed to navigate to: ' + specRoute, err);
            this.navigateToFallback(route, anio, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor, notification);
          });
        } else {
          this.navigateToFallback(route, anio, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor, notification);
        }
      };

      const ainin_codigo = notification.anotif_ainin_codigo;
      const arere_codigo = notification.anotif_arere_codigo;

      if (ainin_codigo) {
        navigateWithIds(ainin_codigo, arere_codigo);
      } else {
        // Resolver el ainin_codigo a partir del arere_codigo
        this.notificationSrv.getCadenaIds(arere_codigo).subscribe({
          next: (res) => {
            const ids = res && res.datos ? res.datos : null;
            navigateWithIds(ids && ids.ainin_codigo ? ids.ainin_codigo : null, arere_codigo);
          },
          error: () => {
            this.navigateToFallback(route, anio, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor, notification);
          }
        });
      }
    } else {
      this.navigateToFallback(route, anio, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor, notification);
    }

    this.closeModal();
  }

  private navigateToFallback(
    route: string,
    anio: number | null,
    hasAuditorJefe: boolean,
    hasAuditorOperativo: boolean,
    isAssignedAuditor: boolean,
    notification?: Notification
  ): void {
    const queryParts: string[] = [];
    if (anio) {
      queryParts.push(`anio=${anio}`);
    }
    if (notification) {
      const codSol = this.extractSolicitudCodigo(notification);
      if (codSol) queryParts.push(`solicitud=${codSol}`);
      if (notification.anotif_arere_codigo) queryParts.push(`arere=${notification.anotif_arere_codigo}`);
    }
    if (queryParts.length > 0) {
      const separator = route.includes('?') ? '&' : '?';
      route = `${route}${separator}${queryParts.join('&')}`;
    }
    this.navigateInternally(route, hasAuditorJefe, hasAuditorOperativo, isAssignedAuditor);
  }

  private navigateInternally(route: string, hasAuditorJefe: boolean, hasAuditorOperativo: boolean, isAssignedAuditor: boolean): void {
    let finalRoute = route;

    if (hasAuditorJefe && (!hasAuditorOperativo || !isAssignedAuditor)) {
      if (finalRoute.includes('auditor-solicitudes')) {
        finalRoute = 'report-prorrogas-aij';
      } else if (finalRoute.includes('auditor-operativo')) {
        finalRoute = finalRoute
          .replace(/auditor-operativo\//g, 'auditor-general/')
          .replace(/auditor-operativo$/g, 'auditor-general')
          .replace(/hallazgos\//g, 'hallazgos-auditor-gen/')
          .replace(/conclusiones\//g, 'conclusiones-auditor-gen/')
          .replace(/recomendaciones\//g, 'recomendaciones-auditor-gen/');
      }
    }

    if (!finalRoute.startsWith('/inicio/') && !finalRoute.startsWith('inicio/')) {
      const cleanRoute = finalRoute.startsWith('/') ? finalRoute.slice(1) : finalRoute;
      finalRoute = '/inicio/' + cleanRoute;
    } else if (finalRoute.startsWith('inicio/')) {
      finalRoute = '/' + finalRoute;
    }

    this.router.navigateByUrl(finalRoute).catch(err => {
      console.error('Failed to navigate to path: ' + finalRoute, err);
    });
  }

  protected selectedCategory: 'all' | 'unread' | 'solicitudes' | 'verificables' | 'alertas' = 'unread';
  protected isTodayFilter: boolean = false;

  protected toggleTodayFilter(): void {
    this.isTodayFilter = !this.isTodayFilter;
    this.updateFilteredNotifications();
  }

  protected selectCategory(category: 'all' | 'unread' | 'solicitudes' | 'verificables' | 'alertas'): void {
    this.selectedCategory = category;
    this.updateFilteredNotifications();
  }

  private updateFilteredNotifications(): void {
    let list = [...this.allNotifications];

    if (this.selectedCategory === 'unread') {
      list = list.filter(n => n.anotif_estado === 0);
    } else if (this.selectedCategory === 'solicitudes') {
      list = list.filter(n => this.isSolicitudNotification(n));
    } else if (this.selectedCategory === 'verificables') {
      list = list.filter(n => this.isVerificableNotification(n));
    } else if (this.selectedCategory === 'alertas') {
      list = list.filter(n => this.isAlertNotification(n));
    }

    if (this.isTodayFilter) {
      list = list.filter(n => {
        if (!n.anotif_fecha_creacion) return false;
        const d = new Date(n.anotif_fecha_creacion);
        const now = new Date();
        return d.getDate() === now.getDate() &&
               d.getMonth() === now.getMonth() &&
               d.getFullYear() === now.getFullYear();
      });
    }

    this.filteredNotifications = this.sortNotifications(list);
  }

  private getSolicitudResolution(notification: Notification): 'APROBADA' | 'RECHAZADA' | null {
    const tit = (notification.anotif_titulo || '').toLowerCase();
    const msg = (notification.anotif_mensaje || '').toLowerCase();

    if (tit.includes('aprobada') || tit.includes('aprobado') || msg.includes('ha sido aprobada') || msg.includes('ha sido aprobado') || msg.includes('aprobada por el auditor')) {
      if (!tit.includes('preaprobad') && !msg.includes('preaprobad')) {
        return 'APROBADA';
      }
    }
    if (tit.includes('rechazada') || tit.includes('rechazado') || msg.includes('ha sido rechazada') || msg.includes('ha sido rechazado') || msg.includes('rechazada por el auditor')) {
      return 'RECHAZADA';
    }

    const solCod = this.extractSolicitudCodigo(notification);
    if (solCod && this.allNotifications && this.allNotifications.length > 0) {
      for (const other of this.allNotifications) {
        if (other.anotif_codigo === notification.anotif_codigo) continue;
        const otherSolCod = this.extractSolicitudCodigo(other);
        if (otherSolCod === solCod) {
          const oTit = (other.anotif_titulo || '').toLowerCase();
          const oMsg = (other.anotif_mensaje || '').toLowerCase();
          if (oTit.includes('aprobada') || oTit.includes('aprobado') || oMsg.includes('ha sido aprobada') || oMsg.includes('aprobada por el auditor')) {
            if (!oTit.includes('preaprobad') && !oMsg.includes('preaprobad')) {
              return 'APROBADA';
            }
          }
          if (oTit.includes('rechazada') || oTit.includes('rechazado') || oMsg.includes('ha sido rechazada') || oMsg.includes('rechazada por el auditor')) {
            return 'RECHAZADA';
          }
        }
      }
    }
    return null;
  }

  protected getBadgeClass(notification: Notification): string {
    const tit = (notification.anotif_titulo || '').toLowerCase();
    const msg = (notification.anotif_mensaje || '').toLowerCase();
    const tipo = (notification.anotif_tipo || '').toLowerCase().trim();

    // 0. ELIMINADAS: Info (Gris)
    if (
      tit.includes('eliminad') ||
      msg.includes('eliminó') ||
      msg.includes('elimino') ||
      tipo === 'solicitud-eliminada-auditor' ||
      tipo === 'verificable-eliminado' ||
      tipo === 'solicitud-eliminada'
    ) {
      return 'bg-slate-100 text-slate-700 border border-slate-300';
    }

    // 1. ATENDIDAS (Resolución realizada por el auditor)
    if (tit.includes('atendido:')) {
      if (tit.includes('no me') || tit.includes('no justifica') || tit.includes('no aprobada') || tit.includes('no aprobado') || tit.includes('rechazada') || tit.includes('rechazado')) {
        return 'bg-rose-100 text-rose-800 border border-rose-300';
      }
      if (tit.includes('pendiente')) {
        return 'bg-sky-100 text-sky-900 border border-sky-300';
      }
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    }

    if (tit.includes('cumplida')) {
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    }

    if (tit.includes('caducad') || msg.includes('caducad') || tipo === 'solicitud-caducada') {
      return 'bg-rose-100 text-rose-800 border border-rose-300';
    }

    if (tit.includes('vencida') || msg.includes('vencieron') || tipo === 'recomendacion-vencida') {
      return 'bg-rose-100 text-rose-800 border border-rose-300';
    }

    if (tit.includes('vencer') || tit.includes('vence') || tit.includes('vencimiento') || tipo === 'recomendacion-vencer') {
      return 'bg-amber-100 text-amber-900 border border-amber-300';
    }

    if (tipo === 'recomendacion-fecha-cambiada' || tit.includes('fecha cambiada')) {
      return 'bg-amber-100 text-amber-900 border border-amber-300';
    }

    if (tipo === 'recomendacion-reasignada' || tit.includes('reasignad')) {
      return 'bg-sky-100 text-sky-900 border border-sky-300';
    }

    if (tipo === 'recomendacion-asignada' || tit.includes('asignad')) {
      return 'bg-sky-100 text-sky-900 border border-sky-300';
    }

    if (tipo === 'plan-accion-vencido' || tit.includes('fuera de plazo')) {
      return 'bg-rose-100 text-rose-800 border border-rose-300';
    }

    if (tipo === 'plan-accion-recordatorio' || tit.includes('recordatorio plan')) {
      return 'bg-amber-100 text-amber-900 border border-amber-300';
    }

    if (
      tipo === 'plan-accion-requerido' ||
      tit.includes('plan de acción') ||
      tit.includes('plan de accion') ||
      msg.includes('plan de acción') ||
      msg.includes('plan de accion')
    ) {
      return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
    }

    const solRes = this.getSolicitudResolution(notification);
    if (solRes === 'APROBADA') return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    if (solRes === 'RECHAZADA') return 'bg-rose-100 text-rose-800 border border-rose-300';

    if ((tit.includes('aprobada') || tit.includes('aprobado')) && !tit.includes('preaprobad') && !tit.includes('pre-aprobad')) {
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    }

    if (tit.includes('rechazada') || tit.includes('rechazado') || tit.includes('no aprobada') || tit.includes('no aprobado')) {
      return 'bg-rose-100 text-rose-800 border border-rose-300';
    }

    // 2. EN REVISIÓN / LEÍDO SIN ATENDER (Ámbar)
    if (tit.includes('en revisión') || tit.includes('en revision') || msg.includes('(en revisión)') || msg.includes('(en revision)')) {
      return 'bg-amber-100 text-amber-900 border border-amber-300';
    }

    // 2.5 VERIFICABLE ACTUALIZADO (Índigo)
    if (
      tipo === 'verificable-actualizado' ||
      tit.includes('verificable actualizado') ||
      tit.includes('actualizado por responsable') ||
      msg.includes('actualizado su verificable')
    ) {
      return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
    }

    // 3. PENDIENTES (Acción no realizada en el sistema / Verificable no atendido)
    if (
      tit.includes('verificable pendiente') || tit.includes('verificable no atendido') ||
      msg.includes('subió un verificable') || msg.includes('no fue atendido') || msg.includes('sin atender') ||
      tit.includes('preaprobad') || msg.includes('preaprobad') || tit.includes('solicitud de prórroga') ||
      tipo === 'solicitud-nueva'
    ) {
      if (!tit.includes('actualizado por responsable') && !msg.includes('actualizado su verificable') && !tit.includes('atendido:')) {
        return 'bg-sky-100 text-sky-900 border border-sky-300';
      }
    }

    // 5. INFO / ALERTAS SISTEMA / ACTUALIZACIONES (Gris)
    return 'bg-slate-100 text-slate-700 border border-slate-300';
  }

  protected getBadgeLabel(notification: Notification): string {
    const tit = (notification.anotif_titulo || '').toLowerCase();
    const msg = (notification.anotif_mensaje || '').toLowerCase();
    const tipo = (notification.anotif_tipo || '').toLowerCase().trim();

    // 0. ELIMINADAS: Solicitudes o Verificables eliminados son informativos (INFO)
    if (
      tit.includes('eliminad') ||
      msg.includes('eliminó') ||
      msg.includes('elimino') ||
      tipo === 'solicitud-eliminada-auditor' ||
      tipo === 'verificable-eliminado' ||
      tipo === 'solicitud-eliminada'
    ) {
      return 'INFO';
    }

    // 1. ATENDIDAS: Acciones atendidas formalmente por auditor
    if (tit.includes('atendido:')) {
      if (tit.includes('no me') || tit.includes('no justifica')) return 'ATENDIDO: NO JUSTIFICA';
      if (tit.includes('justifica')) return 'ATENDIDO: JUSTIFICA';
      if (tit.includes('no aprobada') || tit.includes('no aprobado') || tit.includes('rechazada') || tit.includes('rechazado')) return 'ATENDIDO: NO APROBADA';
      if (tit.includes('aprobada') || tit.includes('aprobado') || tit.includes('aprobó') || tit.includes('aprobo')) return 'ATENDIDO: APROBADA';
      if (tit.includes('pendiente')) return 'ATENDIDO: PENDIENTE';
      return 'ATENDIDO';
    }

    if (tit.includes('cumplida')) return 'ATENDIDO: CUMPLIDA';

    if (tit.includes('caducad') || msg.includes('caducad') || tipo === 'solicitud-caducada') {
      return 'CADUCADA';
    }

    if (tit.includes('vencida') || msg.includes('vencieron') || tipo === 'recomendacion-vencida') {
      return 'VENCIDA';
    }

    if (tit.includes('vencer') || tit.includes('vence') || tit.includes('vencimiento') || tipo === 'recomendacion-vencer') {
      return 'POR VENCER';
    }

    if (tipo === 'recomendacion-fecha-cambiada' || tit.includes('fecha cambiada')) {
      return 'FECHA CAMBIADA';
    }

    if (tipo === 'recomendacion-reasignada' || tit.includes('reasignad')) {
      return 'REASIGNACIÓN';
    }

    if (tipo === 'recomendacion-asignada' || tit.includes('asignad')) {
      return 'ASIGNACIÓN';
    }

    if (tipo === 'plan-accion-vencido' || tit.includes('fuera de plazo')) {
      return 'PLAN FUERA DE PLAZO';
    }

    if (
      tipo === 'plan-accion-requerido' ||
      tipo === 'plan-accion-recordatorio' ||
      tit.includes('plan de acción') ||
      tit.includes('plan de accion') ||
      msg.includes('plan de acción') ||
      msg.includes('plan de accion')
    ) {
      return 'PLAN DE ACCIÓN';
    }

    const solRes = this.getSolicitudResolution(notification);
    if (solRes === 'APROBADA') return 'ATENDIDO: APROBADA';
    if (solRes === 'RECHAZADA') return 'ATENDIDO: NO APROBADA';

    if ((tit.includes('aprobada') || tit.includes('aprobado')) && !tit.includes('preaprobad') && !tit.includes('pre-aprobad')) return 'ATENDIDO: APROBADA';
    if (tit.includes('rechazada') || tit.includes('rechazado') || tit.includes('no aprobada') || tit.includes('no aprobado')) return 'ATENDIDO: NO APROBADA';

    // 2. EN REVISIÓN / LEÍDO SIN ATENDER
    if (tit.includes('en revisión') || tit.includes('en revision') || msg.includes('(en revisión)') || msg.includes('(en revision)')) {
      return 'LEÍDO SIN ATENDER';
    }

    // 2.5 VERIFICABLE ACTUALIZADO
    if (
      tipo === 'verificable-actualizado' ||
      tit.includes('verificable actualizado') ||
      tit.includes('actualizado por responsable') ||
      msg.includes('actualizado su verificable')
    ) {
      return 'VERIFICABLE ACTUALIZADO';
    }

    // 3. PENDIENTE: Verificables no atendidos, pendientes iniciales o solicitudes que aún no se han atendido en el sistema
    if (
      tit.includes('verificable pendiente') || tit.includes('verificable no atendido') ||
      msg.includes('subió un verificable') || msg.includes('no fue atendido') || msg.includes('sin atender') ||
      tit.includes('preaprobad') || msg.includes('preaprobad') || tit.includes('solicitud de prórroga') ||
      tipo === 'solicitud-nueva'
    ) {
      if (!tit.includes('actualizado por responsable') && !msg.includes('actualizado su verificable') && !tit.includes('atendido:')) {
        return 'PENDIENTE';
      }
    }

    // 4. INFO: Alertas del sistema y actualizaciones informativas del responsable
    return 'INFO';
  }

  protected getDisplayTitle(notification: Notification): string {
    const rawTit = notification.anotif_titulo || '';
    const titLower = rawTit.toLowerCase();

    const solRes = this.getSolicitudResolution(notification);
    if (solRes === 'APROBADA' && (titLower.includes('preaprobad') || titLower.includes('revisión') || titLower.includes('revision') || titLower.includes('nueva'))) {
      return 'Atendido: Solicitud aprobada';
    }
    if (solRes === 'RECHAZADA' && (titLower.includes('preaprobad') || titLower.includes('revisión') || titLower.includes('revision') || titLower.includes('nueva'))) {
      return 'Atendido: Solicitud no aprobada';
    }

    // Si fue catalogada erróneamente con título de verificable pero su contenido/tipo es de solicitud
    if (this.isSolicitudNotification(notification)) {
      if (titLower === 'verificable en revisión' || titLower === 'verificable en revision') {
        return 'Solicitud en revisión';
      }
      if (titLower.startsWith('verificable')) {
        return rawTit.replace(/verificable/gi, 'Solicitud');
      }
    }
    return rawTit;
  }

  protected isSolicitudNotification(n: Notification): boolean {
    const tit = (n.anotif_titulo || '').toLowerCase();
    const msg = (n.anotif_mensaje || '').toLowerCase();
    const tipo = (n.anotif_tipo || '').toLowerCase().trim();

    // 1. Las notificaciones eliminadas son informativas (Alertas / INFO), no pertenecen a Solicitudes activas
    if (
      tit.includes('eliminad') ||
      msg.includes('eliminó') ||
      msg.includes('elimino') ||
      tipo.includes('eliminad')
    ) {
      return false;
    }

    // 2. Si el mensaje o título trata explícitamente de un verificable (y no describe una solicitud)
    if (
      (tit.includes('verificable') || msg.startsWith('verificable')) &&
      !msg.startsWith('solicitud') &&
      !msg.includes('n. solicitud') &&
      !msg.includes('solicitud n°') &&
      !msg.includes('solicitud nº')
    ) {
      return false;
    }

    // 3. Inclusión en Solicitudes si el tipo, mensaje o título corresponde a solicitud
    if (
      tipo.startsWith('solicitud') ||
      msg.startsWith('solicitud') ||
      msg.includes('n. solicitud') ||
      msg.includes('solicitud n°') ||
      msg.includes('solicitud nº') ||
      msg.includes('solicitud de prórroga') ||
      msg.includes('solicitud de prorroga')
    ) {
      return true;
    }

    return tit.includes('solicitud') || tit.includes('prórroga');
  }

  protected isVerificableNotification(n: Notification): boolean {
    const tit = (n.anotif_titulo || '').toLowerCase();
    const msg = (n.anotif_mensaje || '').toLowerCase();
    const tipo = (n.anotif_tipo || '').toLowerCase().trim();

    // Las eliminadas van a INFO / Alertas
    if (
      tit.includes('eliminad') ||
      msg.includes('eliminó') ||
      msg.includes('elimino') ||
      tipo.includes('eliminad')
    ) {
      return false;
    }

    // Si el título o mensaje trata de un verificable, ES un verificable
    if (
      (tit.includes('verificable') || msg.startsWith('verificable') || tipo.startsWith('verificable')) &&
      !msg.startsWith('solicitud') &&
      !msg.includes('n. solicitud') &&
      !msg.includes('solicitud n°') &&
      !msg.includes('solicitud nº')
    ) {
      return true;
    }

    // Si fue catalogada como Solicitud, NO es verificable
    if (this.isSolicitudNotification(n)) {
      return false;
    }

    return tit.includes('verificable') || msg.includes('verificable');
  }

  private showUnreadNotifications(): void {
    this.selectedCategory = 'unread';
    this.isTodayFilter = false;
    this.updateFilteredNotifications();
  }

  protected showAllNotifications(): void {
    this.selectedCategory = 'all';
    this.isTodayFilter = false;
    this.updateFilteredNotifications();
  }

  protected clearReadNotifications(): void {
    this.showUnreadNotifications();
  }

  protected markMyNotificationsAsRead(): void {
    const unreadMine = this.allNotifications.filter(n => n.anotif_estado === 0 && this.canMarkAsRead(n));
    if (unreadMine.length === 0) {
      return;
    }

    unreadMine.forEach(n => {
      n.anotif_estado = 1;
      this.notificationSrv.updateNotification(n.anotif_codigo).subscribe({
        error: () => {
          n.anotif_estado = 0;
          this.updateFilteredNotifications();
          this.notificationRead.emit();
        }
      });
    });

    this.updateFilteredNotifications();
    this.notificationRead.emit();
  }

  private sortNotifications(notifications: Notification[]): Notification[] {
    // Ordenar primero por estado (no leídas primero)
    // Luego ordenar por fecha (más recientes primero)
    return notifications.sort((a, b) => {
      // Primero comparar por estado (0 = no leída, 1 = leída)
      if (a.anotif_estado !== b.anotif_estado) {
        return a.anotif_estado - b.anotif_estado;
      }
      
      // Si tienen el mismo estado, ordenar por fecha (más reciente primero)
      const dateA = new Date(a.anotif_fecha_creacion).getTime();
      const dateB = new Date(b.anotif_fecha_creacion).getTime();
      return dateB - dateA; // Orden descendente (más reciente primero)
    });
  }

  protected openModalNotifInfo(notification: Notification, event?: Event): void {
    // Evitar propagación del evento para que no se cierre el componente
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // Abrir el modal con la notificación seleccionada
    // YA NO marcar como leída automáticamente - solo se marca con el checkbox
    this.modalNotificationInfo.openModal(notification);
    
    // NO cerrar el contenedor de notificaciones para mantenerlo abierto
  }

  protected getDisplayMessage(notification: Notification): string {
    return this.cleanNotificationMessage(notification.anotif_mensaje);
  }

  protected isAlertNotification(n: Notification): boolean {
    return !this.isSolicitudNotification(n) && !this.isVerificableNotification(n);
  }

  protected isDeletionNotification(notification: Notification): boolean {
    const titulo = (notification.anotif_titulo || '').toLowerCase();
    const mensaje = (notification.anotif_mensaje || '').toLowerCase();
    return titulo.includes('eliminado') || mensaje.includes('eliminó');
  }

  protected isFechaCambiadaNotification(notification: Notification): boolean {
    return notification.anotif_tipo === 'recomendacion-fecha-cambiada';
  }

  protected getAuditorDisplay(notification: Notification): string | null {
    if (notification.anotif_auditor_asignado) {
      return notification.anotif_auditor_asignado;
    }

    return null;
  }

  private cleanNotificationMessage(message: string): string {
    if (!message) {
      return '';
    }

    const patterns = [
      /\s*\[\[\s*auditor_asignado\s*:\s*[^\]]+\]\]/gi,
      /\s*\(\s*auditor_asignado\s*:\s*[^\)]+\)/gi,
      /\s*\(auditor asignado\)\([^)]+\)/gi,
      /\s*\|\s*auditor_asignado\s*[:=]\s*[^|]+/gi,
    ];

    let cleanText = patterns.reduce((text, pattern) => text.replace(pattern, '').trim(), message);
    cleanText = cleanText.replace(/â€[”"™—]|—/g, '-');
    return cleanText;
  }
}
