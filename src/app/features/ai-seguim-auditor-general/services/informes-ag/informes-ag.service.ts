import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment.development';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Observable, tap } from 'rxjs';
import {
  ResponseReadMultiple,
  ResponseReadSimple,
} from '@shared/models/response-read';
import { ListaAuditorOp, Informe, UserRole } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { Auditoria } from '@shared/models/audit';
import { OrganismoControl } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { TipoInforme } from '@features/ai-seguim-auditor-general/models/informe-ag';
import { ResponseWrite } from '@shared/models/response-write';

@Injectable({
  providedIn: 'root',
})
export class InformesAgService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private apiUrl: string = `${environment.url}`;
  private urlFtp: string = `${environment.url}archivo`;
  private readonly host = this.auxiliarySrv.getHost();
  private readonly user = this.auxiliarySrv.getUserCuenta();
  private readonly audit: Auditoria = {
    host: this.host,
    usuario: this.user,
  };
  private currentData: Informe[] | null = null;

  getInformeByCod(informe: Informe): Observable<ResponseReadSimple<Informe>> {
    try {
      const response = this.http.get<ResponseReadSimple<Informe>>(
        `${this.apiUrl}informes/${informe.ainin_codigo}`
      );
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  getCurrentData(): Informe[] | null {
    return this.currentData;
  }

  getFilteredInformes(
    orgCtrl: number,
    tipInf: number,
    startDate: string,
    endDate: string,
    cuenta: string
  ): Observable<ResponseReadMultiple<Informe>> {
    return this.http
      .get<ResponseReadMultiple<Informe>>(
        `${this.apiUrl}informes/filtro-auditor-general?ainoc_organismo_control=${orgCtrl}&ainti_tipo_inf=${tipInf}&ainin_fecha_inicio=${startDate}&ainin_fecha_fin=${endDate}&ainin_usuario=${cuenta}`
      )
      .pipe(
        tap((response) => {
          this.currentData = response.datos;
        })
      );
  }

  getFile(rutaArchivo: string): Observable<ResponseReadSimple<any>> {
    try {
      const response = this.http.get<ResponseReadSimple<any>>(this.urlFtp, {
        params: { ruta: rutaArchivo },
      });

      return response;
    } catch (error) {
      return new Observable();
    }
  }

  getOrganismoControl(): Observable<ResponseReadMultiple<OrganismoControl>> {
    try {
      const response = this.http.get<ResponseReadMultiple<OrganismoControl>>(
        `${this.apiUrl}organismos`
      );
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  getTipoInforme(): Observable<ResponseReadMultiple<TipoInforme>> {
    try {
      const response = this.http.get<ResponseReadMultiple<TipoInforme>>(
        `${this.apiUrl}tipoInf`
      );
      return response;
    } catch (error) {
      return new Observable();
    }
  }

  getAuditores(): Observable<ResponseReadSimple<ListaAuditorOp>> {
    try {
      const role: UserRole = UserRole.AUDITOR_OP;
      const response = this.http.get<ResponseReadSimple<ListaAuditorOp>>(
        `${this.apiUrl}roles/usuario/${role}`
      );
      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  changeAuditor(infCodes: number[], cuenta: string): Observable<ResponseWrite> {
    try {
      const urlUpdate: string = `${this.apiUrl}informes/actualizar/usuario`;
      const options = {
        ainin_codigos: infCodes,
        aseru_cuenta: cuenta,
        auditoria: this.audit,
      };
      const response = this.http.put<ResponseWrite>(urlUpdate, options);

      return response;
    } catch (error) {
      console.error(error);
      return new Observable();
    }
  }

  notificar(codRec: number): Observable<ResponseWrite> {
    const url: string = `${this.apiUrl}email/notificar-informe/${codRec}`;
    const response = this.http.get<ResponseWrite>(url);
    return response;
  }
}
