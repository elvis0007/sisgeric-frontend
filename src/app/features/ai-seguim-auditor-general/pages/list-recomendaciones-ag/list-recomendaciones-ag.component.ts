import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { ModalResponsablesAgComponent } from '@features/ai-seguim-auditor-general/components/recomendaciones-ag/modal-responsables-ag/modal-responsables-ag.component';
import { TableRecomendacionesAgComponent } from '@features/ai-seguim-auditor-general/components/recomendaciones-ag/table-recomendaciones-ag/table-recomendaciones-ag.component';
import {
  ConclusionRecomendaciones,
  Recomendacion,
} from '@features/ai-seguim-auditor-general/models/recomendacion-ag';
import { ModalResponsablesAgService } from '@features/ai-seguim-auditor-general/services/recomendaciones-ag/modal-responsables-ag.service';
import { RecomendacionesAgService } from '@features/ai-seguim-auditor-general/services/recomendaciones-ag/recomendaciones-ag.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-list-recomendaciones',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    TableRecomendacionesAgComponent,
    ModalResponsablesAgComponent,
    ReactiveFormsModule
],
  templateUrl: './list-recomendaciones-ag.component.html',
  styleUrl: './list-recomendaciones-ag.component.css',
})
export class ListRecomendacionesComponent implements OnInit, OnDestroy {
  private readonly auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly ruta: ActivatedRoute = inject(ActivatedRoute);
  private readonly recomendacionSrv: RecomendacionesAgService = inject(
    RecomendacionesAgService
  );
  protected readonly modalResponsableSrv: ModalResponsablesAgService = inject(
    ModalResponsablesAgService
  );
  protected readonly alertService = inject(AlertsStateService);

  protected recomendaciones: Recomendacion[] = [];
  protected conclusionRecomendacion!: ConclusionRecomendaciones;
  protected idCon: number = 0;
  protected conclusionTitle: string = '';
  protected ordenTrabajo: string = '';
  protected isLoading = false;
  protected searchTermControl = new FormControl('');
  private subscriptions: Subscription[] = [];

  protected get rutaHijaActiva(): boolean {
    return !!this.ruta.firstChild;
  }

  protected reloadTable(): void {
    this.getDataRecomendaciones();
  }

  ngOnInit(): void {
    this.auxiliarSrv.saveUrlParameter(
      this.ruta.snapshot.paramMap.get('id')!,
      'id_con'
    );
    this.getDataRecomendaciones();
    
    // Configurar el debounce para la búsqueda
    const subscription = this.searchTermControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        // No necesitamos hacer nada aquí, el valor se pasará automáticamente al componente hijo
      });
    
    this.subscriptions.push(subscription);
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private getDataRecomendaciones(): void {
    this.isLoading = true;
    const id: number = +atob(this.ruta.snapshot.paramMap.get('id')!);
    this.recomendacionSrv.getRecomendaciones(id).subscribe({
      next: (response: ResponseReadSimple<ConclusionRecomendaciones>) => {
        this.idCon = response.datos.areco_codigo;
        this.conclusionTitle = response.datos.areco_conclusion;
        this.conclusionRecomendacion = response.datos;
        this.recomendaciones = this.conclusionRecomendacion.recomendaciones;
        this.ordenTrabajo = this.conclusionRecomendacion.ainin_orden_trabajo;
        this.isLoading = false;
      },
      error: () => {
        this.alertService.showAlert(
          'Error al cargar recomendaciones',
          'error'
        );
        this.isLoading = false;
      },
    });
  }
}
