import { HttpClient } from '@angular/common/http';
import { EventEmitter, inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment.development';
import { ObjectEncryptor } from '@shared/utils/object-encryptor';
import { User } from '@core/auth/models/authentication';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  public eventUser: EventEmitter<User> = new EventEmitter<User>();
  private user: User | null = null;
  private url: string = environment.securityUrl;
  private router = inject(Router);

  constructor(
    private httpClient: HttpClient,
    private encryptor: ObjectEncryptor
  ) {
    let user = localStorage.getItem('usuario');
    if (user) {
      this.login(user);
    } else {
      // Evitar bucle de redirección en entornos de desarrollo/pruebas
      const host = window.location.hostname;
      if (host === 'localhost' || host === '172.20.35.209') {
        console.log('[AUTH] Entorno de pruebas detectado. Autologin con mguevara.');
        this.login('cerazo'); // Cambiar a 'arodriguez' para pruebas
      } else {
        window.location.href = 'https://app.eeasa.com.ec/intranet#/inicio';
      }
    }

  }

  public get getUser(): User | null {
    return this.user;
  }

  login(dsgus_account: string) {
    console.log('[AUTH] Iniciando login para:', dsgus_account);
    return this.getInformationUser(dsgus_account).subscribe({
      next: (response) => {
        console.log('[AUTH] Respuesta cruda del backend:', response);
        if (response?.token) {
          // Convierte la imagen recibida a un formato compatible (data URL)
          const base64Image = `data:image/jpeg;base64,${response.fotografia}`;
          this.handleSuccessfulLogin(response, base64Image);
        } else {
          this.handleFailedLogin();
        }
      },
      error: (err) => {
        console.error('Error al obtener la información del usuario:', err);
        this.handleFailedLogin();
      },
    });
  }

  private handleSuccessfulLogin(response: any, base64Image: string): void {
    console.log('[AUTH] Login exitoso. Usuario normalizado:', {
      dsgus_cuenta: response?.dsgus_cuenta,
      codigo_per: response?.codigo_per,
      departamento: response?.departamento,
      roles: response?.roles,
      token: response?.token ? 'SI' : 'NO',
    });
    localStorage.setItem(
      'SEG_SE_USUARIO_AUDITORIA',
      this.encryptor.encryptObject(JSON.stringify(response))
    );
    localStorage.setItem(
      "DSGUS_CUE", response.dsgus_cuenta);

    // Emitimos el usuario y la imagen decodificada
    this.eventUser.emit({ ...response, fotografia: base64Image });
    this.user = response;
    //console.log('Usuario logueado:', this.user);
  }

  private handleFailedLogin(): void {
    console.warn('[AUTH] Login fallido o sin token. Se limpia la sesión y se redirige a intranet.');
    localStorage.removeItem('SEG_SE_USUARIO_AUDITORIA');
    this.router.navigate(['intranet']);
  }

  private getInformationUser(dsgus_account: string | null) {
    console.log('[AUTH] Consultando información del usuario en:', this.url, 'cuenta:', dsgus_account);
    return this.httpClient.get<User>(
      this.url + '?DSGUS_CUENTA=' + dsgus_account
    );
  }

  public existeRol(usuario: string): Observable<boolean> {
    return this.httpClient.get<boolean>(
      this.url + '/existe-rol?DSGUS_CUE=' + usuario
    );
  }
}
