import {
  HttpInterceptorFn,
  HttpRequest,
  HttpEvent,
  HttpHandlerFn,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '@core/auth/models/authentication';
import { ObjectEncryptor } from '@shared/utils/object-encryptor';

export function interceptorJWT(encryptor: ObjectEncryptor): HttpInterceptorFn {
  return (
    request: HttpRequest<any>,
    next: HttpHandlerFn
  ): Observable<HttpEvent<any>> => {
    const urlsWithoutToken: Array<string> = [
      'security/validarUsuario',
      'security/getUsuarioInformacion',
      '/selectListaPersonalEEASA?inEstadoPersona=ACTIVO',
    ];

    const urlsWithNotJson: Array<string> = [
      '/informes',
      '/verificables',
      '/solicitudes',
    ];
    const urlsWithBothTokens: Array<string> = [
      '/roles/usuario/',
      '/responsables/recomendacion/',
    ];
    
    let json = localStorage.getItem('SEG_SE_USUARIO_AUDITORIA');
    let userLocalStorage: User | null = null;
    try {
      userLocalStorage = json
        ? JSON.parse(encryptor.decryptObject(json))
        : null;
    } catch (error) {
      localStorage.removeItem('SEG_SE_USUARIO_AUDITORIA');
    }

    if (userLocalStorage) {
      const isLoggedIn = userLocalStorage && userLocalStorage.token;
      let addToken = true;
      let customToken = ''; // Para el token personalizado
      let customTokenSisgerh = '';
      let customTokenFormData = false;

      urlsWithoutToken.forEach((url) => {
        if (request.url.includes(url)) {
          customTokenSisgerh = userLocalStorage.token_sisgerh;
          addToken = false;
          return;
        }
      });

      urlsWithBothTokens.forEach((url) => {
        if (request.url.includes(url)) {
          addToken = true;
          customToken = userLocalStorage.token_sisgerh; // Asigna aquí tu token personalizado
          return;
        }
      });

      urlsWithoutToken.forEach((url) => {
        if (request.url.includes(url)) {
          return;
        }
      });

      urlsWithNotJson.forEach((url) => {
        //agregar encabezado content-type multipart/form-data
        if (request.url.includes(url)) {
          customTokenFormData = true;
          return;
        }
      });

      if (isLoggedIn) {
        if (customTokenSisgerh) {
          request = request.clone({
            setHeaders: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${customTokenSisgerh}`,
            },
          });
        } else if (customTokenFormData) {
          request = request.clone({
            setHeaders: {
              Authorization: `Bearer ${userLocalStorage.token}`,
            },
          });
        } else if (addToken && customToken) {
          request = request.clone({
            setHeaders: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userLocalStorage.token}`,
              'X-SISGERH-TOKEN': `${userLocalStorage.token_sisgerh}`,
            },
          });
        } else if (addToken) {
          request = request.clone({
            setHeaders: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userLocalStorage.token}`,
            },
          });
        } else {
          request = request.clone({
            setHeaders: {
              'Content-Type': 'application/json',
            },
          });
        }
      }
    }
    return next(request);
  };
}
