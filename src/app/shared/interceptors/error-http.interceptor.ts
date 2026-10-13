import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export function errorHttpInterceptor(
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let messageError = '';

      if (error.error instanceof ErrorEvent) {
        console.error(error.error.message);
        messageError = `${error.error.message}`;
      } else {
        switch (error.status) {
          case 0:
            messageError =
              'No se pudo completar la operación. Verifique su conexión o si el archivo subido excede el límite máximo permitido (50 MB).';
            break;
          case 400:
            messageError =
              error.error?.mensaje ||
              'Solicitud incorrecta. Verifica los datos enviados';
            break;
          case 413:
            messageError =
              error.error?.mensaje ||
              'El archivo subido excede el tamaño máximo permitido (50 MB).';
            break;
          case 401:
            messageError =
              'No autorizado. Por favor, inicia sesión nuevamente.';
            break;
          case 403:
            messageError =
              'Acceso denegado. No tienes permiso para realizar esta acción.';
            break;
          case 404:
            messageError = 'Recurso no encontrado.';
            break;
          case 500:
            messageError =
              'Error interno del servidor. Por favor intenta más tarde.';
            break;
          default:
            messageError =
              `Error del servidor: ${error.status}, ` +
              `mensaje: ${error.message}`;
            break;
        }
      }

      return throwError(() => new Error(messageError));
    })
  );
}
