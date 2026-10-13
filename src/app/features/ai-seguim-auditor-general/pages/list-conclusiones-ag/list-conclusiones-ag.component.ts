import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { TableConclusionesAgComponent } from '@features/ai-seguim-auditor-general/components/conclusiones-ag/table-conclusiones-ag/table-conclusiones-ag.component';
import {
  Conclusion,
  HallazgoConclusiones,
} from '@features/ai-seguim-auditor-general/models/conclusion-ag';
import { ConclusionesAgService } from '@features/ai-seguim-auditor-general/services/conclusiones-ag/conclusiones-ag.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-list-conclusiones-ag',
  standalone: true,
  imports: [
    CommonModule,
    TableConclusionesAgComponent,
    RouterOutlet,
    ReactiveFormsModule
  ],
  templateUrl: './list-conclusiones-ag.component.html',
  styleUrl: './list-conclusiones-ag.component.css',
})
export class ListConclusionesAgComponent implements OnInit, OnDestroy {
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly conclusionesSrv: ConclusionesAgService = inject(ConclusionesAgService);
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertService = inject(AlertsStateService);
  private readonly ngZone = inject(NgZone);

  protected rutaHijaActiva: boolean = false;
  protected idHal: number = 0;
  protected hallazgoTitle: string = '';
  protected ordenTrabajo: string = '';
  protected conclusiones: Conclusion[] = [];
  protected hallazgoConclusiones!: HallazgoConclusiones;
  protected isLoading = false;
  protected searchTermControl = new FormControl('');
  private subscriptions: Subscription[] = [];

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
        this.alertService.showAlert(
          'Error al obtener conclusiones.',
          'error'
        );
        this.isLoading = false;
      },
    });
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
}
