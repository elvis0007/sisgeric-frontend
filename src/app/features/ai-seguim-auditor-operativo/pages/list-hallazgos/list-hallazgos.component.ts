import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalFormComponent } from '@features/ai-seguim-auditor-operativo/components/hallazgos/modal-form/modal-form.component';
import { TableHallazgosComponent } from '@features/ai-seguim-auditor-operativo/components/hallazgos/table-hallazgos/table-hallazgos.component';
import {
  Hallazgo,
  InformeHallazgos,
} from '@features/ai-seguim-auditor-operativo/models/hallazgo';
import { HallazgosService } from '@features/ai-seguim-auditor-operativo/services/hallazgos/hallazgos.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ModalFormService } from '@features/ai-seguim-auditor-operativo/services/hallazgos/modal-form.service';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-list-hallazgos',
  standalone: true,
  imports: [
    TableHallazgosComponent,
    CommonModule,
    RouterOutlet,
    ModalFormComponent,
    ReactiveFormsModule
  ],
  templateUrl: './list-hallazgos.component.html',
  styleUrl: './list-hallazgos.component.css',
})
export class ListHallazgosComponent implements OnInit, OnDestroy {
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly hallazgosSrv: HallazgosService = inject(HallazgosService);
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  protected modalFormSrv: ModalFormService = inject(ModalFormService);
  private readonly alertsService = inject(AlertsStateService);
  private readonly ngZone = inject(NgZone);
  private subscriptions: Subscription[] = [];

  protected hallazgos: Hallazgo[] = [];
  protected informeHallazgos!: InformeHallazgos;
  protected rutaHijaActiva: boolean = false;
  protected idInf: number = 0;
  protected informeTitle: string = '';
  protected ordenTrabajo: string = '';
  protected searchTermControl = new FormControl('');

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
        this.alertsService.showAlert('Error al obtener hallazgos.', 'error');
        this.isLoading = false;
      },
    });
  }

  reloadTable(): void {
    this.getDataHallazgos();
  }

  protected openModalFormHallazgo() {
    this.modalFormSrv.openModal(null);
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

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarSrv.hasRole(roleIds);
  }
}
