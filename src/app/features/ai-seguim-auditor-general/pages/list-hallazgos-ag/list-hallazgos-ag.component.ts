import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { TableHallazgosAgComponent } from '@features/ai-seguim-auditor-general/components/hallazgos-ag/table-hallazgos-ag/table-hallazgos-ag.component';
import {
  Hallazgo,
  InformeHallazgos,
} from '@features/ai-seguim-auditor-general/models/hallazgo-ag';
import { HallazgosAgService } from '@features/ai-seguim-auditor-general/services/hallazgos-ag/hallazgos-ag.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-list-hallazgos-ag',
  standalone: true,
  imports: [
    TableHallazgosAgComponent,
    CommonModule,
    RouterOutlet,
    ReactiveFormsModule
  ],
  templateUrl: './list-hallazgos-ag.component.html',
  styleUrl: './list-hallazgos-ag.component.css',
})
export class ListHallazgosAgComponent implements OnInit, OnDestroy {
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly hallazgosSrv: HallazgosAgService = inject(HallazgosAgService);
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly alertService = inject(AlertsStateService);
  private readonly ngZone = inject(NgZone);

  protected hallazgos: Hallazgo[] = [];
  protected informeHallazgos!: InformeHallazgos;
  protected rutaHijaActiva: boolean = false;
  protected idInf: number = 0;
  protected informeTitle: string = '';
  protected ordenTrabajo: string = '';
  protected searchTermControl = new FormControl('');
  private subscriptions: Subscription[] = [];
  protected isLoading = false;

  ngOnInit(): void {
    this.auxiliarSrv.saveUrlParameter(
      this.ruta.snapshot.paramMap.get('id')!,
      'id_inf'
    );
    this.idInf = +atob(this.ruta.snapshot.paramMap.get('id')!);
    this.getDataHallazgos();

    // Configurar el debounce para la búsqueda por recomendación
    const subscription = this.searchTermControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((term) => {
        this.getDataHallazgos(term || '');
      });
    
    this.subscriptions.push(subscription);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private getDataHallazgos(termino?: string): void {
    this.isLoading = true;
    this.hallazgosSrv.getHallazgos(this.idInf, termino).subscribe({
      next: (response: ResponseReadSimple<InformeHallazgos>) => {
        // Extrae directamente los datos
        this.informeTitle = response.datos.ainin_titulo;
        this.ordenTrabajo = response.datos.ainin_orden_trabajo;
        this.informeHallazgos = response.datos;
        this.hallazgos = this.informeHallazgos.hallazgos;
        this.isLoading = false;
      },
      error: () => {
        this.alertService.showAlert('Error al obtener hallazgos.', 'error');
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
