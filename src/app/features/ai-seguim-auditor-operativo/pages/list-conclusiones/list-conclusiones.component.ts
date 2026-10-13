import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalFormComponent } from '@features/ai-seguim-auditor-operativo/components/conclusiones/modal-form/modal-form.component';
import { TableConclusionesComponent } from '@features/ai-seguim-auditor-operativo/components/conclusiones/table-conclusiones/table-conclusiones.component';
import {
  Conclusion,
  HallazgoConclusiones,
} from '@features/ai-seguim-auditor-operativo/models/conclusion';
import { ConclusionesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/conclusiones.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-list-conclusiones',
  standalone: true,
  imports: [
    CommonModule,
    TableConclusionesComponent,
    ModalFormComponent,
    RouterOutlet,
    ReactiveFormsModule
  ],
  templateUrl: './list-conclusiones.component.html',
  styleUrl: './list-conclusiones.component.css',
})
export class ListConclusionesComponent implements OnInit, OnDestroy {
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly conclusionesSrv: ConclusionesService = inject(ConclusionesService);
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private subscriptions: Subscription[] = [];
  
  protected rutaHijaActiva: boolean = false;
  protected idHal: number = 0;
  protected hallazgoTitle: string = '';
  protected ordenTrabajo: string = '';
  protected searchTermControl = new FormControl('');

  protected conclusiones: Conclusion[] = [];
  protected hallazgoConclusiones!: HallazgoConclusiones;

  protected isLoading = false;

  ngOnInit(): void {
    this.auxiliarSrv.saveUrlParameter(
      this.ruta.snapshot.paramMap.get('id')!,
      'id_hal'
    );
    this.idHal = +atob(this.ruta.snapshot.paramMap.get('id')!);
    this.getDataConclusiones();
    
    // Configurar el debounce para la búsqueda por recomendación
    const subscription = this.searchTermControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((term) => {
        this.getDataConclusiones(term || '');
      });
    
    this.subscriptions.push(subscription);
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private getDataConclusiones(termino?: string): void {
    this.isLoading = true;
    this.conclusionesSrv.getConclusiones(this.idHal, termino).subscribe({
      next: (response: ResponseReadSimple<HallazgoConclusiones>) => {
        this.hallazgoTitle = response.datos.areha_titulo;
        this.ordenTrabajo = response.datos.ainin_orden_trabajo;
        this.hallazgoConclusiones = response.datos;
        this.conclusiones = this.hallazgoConclusiones.conclusiones;
        this.isLoading = false;
      },
      error: () => {
        this.alertsService.showAlert(
          'Error al obtener conclusiones.',
          'error'
        );
        this.isLoading = false;
      },
    });
  }

  reloadTable(): void {
    this.getDataConclusiones();
  }

  protected enActivacionRutaHija(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.rutaHijaActiva = true;
      });
    });
  }

  protected enDesactivacionRutaHija(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.rutaHijaActiva = false;
      });
    });
  }

  protected redireccionPagina(): void {
    const idInf: number = this.auxiliarSrv.getUrlParameter('id_inf');
    this.router.navigate([
      'inicio/auditor-operativo/hallazgos', btoa(idInf.toString()), 'conclusiones', btoa(this.idHal.toString()), 'crear-conclusion'
    ]).catch(error => {
      console.error('Error en navegación', error);
    }) ;
  }

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarSrv.hasRole(roleIds);
  }
}
