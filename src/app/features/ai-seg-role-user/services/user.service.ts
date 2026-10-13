import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import {
  ResponseReadMultipeEeasa,
  ResponseReadMultiple,
} from '@shared/models/response-read';
import { Observable } from 'rxjs';
import { PersonalInfoListado, UsuarioListado } from '@features/ai-seg-role-user/models/user';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http: HttpClient = inject(HttpClient);
  private url: string = `${environment.url}personal/usuario`;
  private url_sisgerh: string = `${environment.url_sisgerh}selectListaPersonalEEASA?inEstadoPersona=ACTIVO`;

  getUsers(): Observable<ResponseReadMultiple<UsuarioListado>> {
    const response = this.http.get<ResponseReadMultiple<UsuarioListado>>(
      this.url
    );
    return response;
  }

  getPersonalInfo(): Observable<ResponseReadMultipeEeasa<PersonalInfoListado>> {
    try {
      const response = this.http.get<
        ResponseReadMultipeEeasa<PersonalInfoListado>
      >(`${this.url_sisgerh}`);
      return response;
    } catch (error) {
      return new Observable();
    }
  }
}
