import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '@core/auth/authentication.service';
import { ModalProfileUserService } from '@core/services/modal-profile-user.service';
import { themeChange } from 'theme-change';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { MenuResponsivoService } from '@core/services/menu-responsivo.service';
import { NotificationContentComponent } from '@core/layouts/notification-content/notification-content.component';
import { NotificationContentService } from '@core/services/notification/notification-content.service';
import { NotificationService } from '@core/services/notification/notification.service';
import { Notification } from '@core/auth/models/notification';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, NotificationContentComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit {
  @Input() userPhotoUrl: string =
    'sisrec/assets/images/avatar_profile.png'; // URL por defecto
  systemPrefersDark = window.matchMedia('(prefers-color-scheme: light)')
    .matches;
  currentTheme: string = localStorage.getItem('theme') || (this.systemPrefersDark ? 'dark' : 'light');
  private readonly router = inject(Router);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  protected modalProfileUser: ModalProfileUserService = inject(
    ModalProfileUserService
  );
  protected notificationContentSrv: NotificationContentService = inject(
    NotificationContentService
  );
  protected menuSrv: MenuResponsivoService = inject(
    MenuResponsivoService
  );
  protected notificationSrv: NotificationService = inject(
    NotificationService
  );
  protected isLoading: boolean = false;
  protected notifications: Notification[] = [];
  protected unreadNotificationsCount: number = 0;
  protected ADMINISTRADOR = 1;

  constructor(
    private authService: AuthenticationService
  ) {}

  ngOnInit(): void {
    // Configura el tema según la preferencia guardada o del sistema
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    themeChange(false); // Activa el cambio de tema sin recargar la página

    // Establece isLoading a true mientras se carga la información del usuario
    this.isLoading = true;
    
    // Suscribirse al evento para obtener la URL de la foto del usuario
    this.authService.eventUser.subscribe((user) => {
      if (user.fotografia) {
        this.userPhotoUrl = user.fotografia;
      }
      this.isLoading = false;
      
      // Ejecuta getNotifications solo si auxiliarySrv no es null
      if (this.auxiliarySrv) {
        this.getNotifications();
      }
    });
  }

  protected logout(): void {
    localStorage.removeItem('SEG_SE_USUARIO_AUDITORIA');
    this.router.navigate(['/intranet']);
  }

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarySrv.hasRole(roleIds);
  }

  protected onThemeChange(event: any): void {
    const theme = event.target.checked ? 'dark' : 'light';
    this.currentTheme = theme;
    // Guardar el tema en localStorage
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  protected navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  protected openProfileModal(): void {
    this.modalProfileUser.openModal();
  }

  protected openNotificationContent(): void {
    this.notificationContentSrv.openContent();
  }

  public getNotifications(): void {
    // Verificar que auxiliarySrv no sea null antes de continuar
    if (!this.auxiliarySrv) return;
    
    const cuenta = this.auxiliarySrv.getUserInfo().dsgus_cuenta;
    this.isLoading = true; // Activar indicador de carga
    
    this.notificationSrv.getNotifications(cuenta).subscribe({
      next: (response) => {
        this.notifications = response.datos.map(notification => ({
          ...notification,
          anotif_usuario_per: notification.anotif_usuario_per ?? null,
          anotif_auditor_asignado: notification.anotif_auditor_asignado ?? null,
          checked: notification.anotif_estado === 1
        }));
        this.unreadNotificationsCount = this.notifications.filter(n => n.anotif_estado === 0).length;
        this.isLoading = false; // Desactivar indicador de carga al completar
      },
      error: (error) => {
        console.error('Error al cargar notificaciones:', error);
        this.isLoading = false; // Desactivar indicador de carga en caso de error
      }
    });
  }

  protected onNotificationRead(): void {
    // Actualizar el contador de notificaciones no leídas
    this.unreadNotificationsCount = this.notifications.filter(n => n.anotif_estado === 0).length;
  }
}
