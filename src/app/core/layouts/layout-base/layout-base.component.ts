import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { SidebarComponent } from '@core/layouts/sidebar/sidebar.component';
import { HeaderComponent } from '@core/layouts/header/header.component';
import { FooterComponent } from '@core/layouts/footer/footer.component';
import { MenuResponsivoComponent } from '@core/layouts/menu-responsivo/menu-responsivo.component';
import { AlertsStatesComponent } from '@core/ui/alerts-state/alerts-state.component';
import { WebsocketService } from '@shared/services/websocket.service';
import { Subscription } from 'rxjs';
import { AlertNotificationComponent } from '@core/ui/alert-notification/alert-notification.component';
import { ModalConfirmationComponent } from '@core/ui/modal-confirmation/modal-confirmation.component';
import { AuthenticationService } from '@core/auth/authentication.service';

@Component({
  selector: 'app-layout-base',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    SidebarComponent,
    HeaderComponent,
    FooterComponent,
    MenuResponsivoComponent,
    AlertsStatesComponent,
    AlertNotificationComponent,
    ModalConfirmationComponent
  ],
  templateUrl: './layout-base.component.html',
  styleUrl: './layout-base.component.css',
})
export class LayoutBaseComponent implements OnInit {
  //Inyección de un observador para el tamaño de pantalla
  private observadorTamanioPantalla: any = inject(BreakpointObserver);

  //Bandera que controla el tamaño de pantalla
  protected banderaTamanioPantalla: boolean = false;
  @ViewChild(AlertsStatesComponent) alertComponent!: AlertsStatesComponent;
  @ViewChild(AlertNotificationComponent) alertNotificationComponent!: AlertNotificationComponent;
  @ViewChild(HeaderComponent) headerComponent!: HeaderComponent;

  private readonly websocketSrv: WebsocketService = inject(WebsocketService);
  private subscription?: Subscription;
  private authenticationSrv: AuthenticationService = inject(AuthenticationService);
  public banderaRol: boolean = false;
  public isLoadingRole: boolean = true;
  public currentUser: string = '';
  public authenticationCompleted: boolean = false;
  constructor() {
    //Observa el tamaño de la pantalla y controla el valor de la bandera
    this.observadorTamanioPantalla
      .observe(['(max-width: 768px)'])
      .subscribe((resultado: BreakpointState) => {
        if (resultado.matches) {
          this.banderaTamanioPantalla = true;
        } else {
          this.banderaTamanioPantalla = false;
        }
      });
  }

  ngOnInit(): void {
    //this.websocketSrv.connect();

    // Suscribirse al evento de usuario autenticado
    this.authenticationSrv.eventUser.subscribe((user) => {
      if (user) {
        // El usuario se ha autenticado exitosamente
        this.currentUser = user.dsgus_cuenta || 'No identificado';
        this.authenticationCompleted = true;
        
        // Ahora sí verificar el rol después de que la autenticación esté completa
        this.existeRol();
        
        // Configurar websocket después de la autenticación
        this.setupWebSocket();
      }
    });

    // Verificar si ya hay un usuario autenticado (por si ya está logueado)
    // Solo hacer esto después de un breve delay para permitir que la autenticación se complete
    setTimeout(() => {
      const existingUser = localStorage.getItem("DSGUS_CUE");
      const userInfo = localStorage.getItem("SEG_SE_USUARIO_AUDITORIA");
      
      if (existingUser && userInfo && !this.authenticationCompleted) {
        // Ya hay datos de autenticación completos
        this.currentUser = existingUser;
        this.authenticationCompleted = true;
        this.existeRol();
        this.setupWebSocket();
      }
    }, 100);
  }

  private setupWebSocket(): void {
    const usuario = localStorage.getItem("DSGUS_CUE");
    if (!usuario) {
      return;
    }
    this.subscription = this.websocketSrv
      .watch(`/topic/notificacion/${usuario}`)
      .subscribe((message: any) => {
        if (message) {
          let textoNotificacion = '';
          if (typeof message.body === 'string') {
            try {
              const parsed = JSON.parse(message.body);
              textoNotificacion = parsed.mensaje || parsed.body || message.body;
            } catch (e) {
              textoNotificacion = message.body;
            }
          } else if (message.mensaje) {
            textoNotificacion = message.mensaje;
          }

          textoNotificacion = (textoNotificacion || '').trim();

          // Mostrar alerta emergente solo si hay texto y no es un comando de actualización silenciosa
          if (textoNotificacion && textoNotificacion.toLowerCase() !== 'refresh' && this.alertNotificationComponent) {
            this.alertNotificationComponent.showNotification(textoNotificacion);
          }
          // Recargar las notificaciones en el header
          this.updateNotifications();
        }
      });
  }

  /**
   * Actualiza el contador de notificaciones en el componente de header
   */
  public updateNotifications(): void {
    if (this.headerComponent) {
      this.headerComponent.getNotifications();
    }
  }

  public existeRol(): void{
    // Solo ejecutar si la autenticación está completa
    if (!this.authenticationCompleted) {
      return;
    }
    
    const usuario = localStorage.getItem("DSGUS_CUE");
    if (!usuario) {
      this.banderaRol = false;
      this.isLoadingRole = false;
      return;
    }
    
    this.authenticationSrv.existeRol(usuario).subscribe({
      next: (response: boolean) => {
        this.banderaRol = response;
        this.isLoadingRole = false;
      },
      error: (error) => {
        this.banderaRol = false;
        this.isLoadingRole = false;
      }
    });
  }
}
