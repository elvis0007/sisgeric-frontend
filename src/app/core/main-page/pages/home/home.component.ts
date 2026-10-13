import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ProfileUserComponent } from '@core/layouts/profile-user/profile-user.component';
import { ChartBarAnioComponent } from '@core/main-page/components/chart-bar-anio/chart-bar-anio.component';
import { ChartBarDptoComponent } from '@core/main-page/components/chart-bar-dpto/chart-bar-dpto.component';
import { ChartDonutComponent } from '@core/main-page/components/chart-donut/chart-donut.component';
import { ListDetalleAijefeComponent } from '@core/main-page/components/list-detalle-aijefe/list-detalle-aijefe.component';
import { ListDetalleRecomendComponent } from '@core/main-page/components/list-detalle-recomend/list-detalle-recomend.component';
import { MetricasResponsableComponent } from '@core/main-page/components/metricas-responsable/metricas-responsable.component';
import { MetricasDirectorComponent } from '@core/main-page/components/metricas-director/metricas-director.component';
import { AuxiliaryService } from '@shared/services/auxiliary.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterOutlet, 
    CommonModule, 
    ProfileUserComponent, 
    ChartDonutComponent, 
    ChartBarAnioComponent,
    ChartBarDptoComponent,
    ListDetalleRecomendComponent,
    MetricasResponsableComponent,
    MetricasDirectorComponent,
    ListDetalleAijefeComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  protected rutaHijaActiva: boolean = false;
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  protected readonly ROL_DIRECTOR = 5;
  protected readonly ROL_AUDITOR_JEFE = 2;
  protected readonly ROL_AUDITOR_OPERATIVO = 3;
  protected readonly ROL_RESPONSABLE = 4;

  ngOnInit(): void {
    this.checkIfChildRouteActive();
    console.log('[HOME] Ruta inicial:', this.router.url);
    console.log('[HOME] Usuario actual:', this.auxiliarySrv.getUserInfo());
    console.log('[HOME] Roles actuales:', this.auxiliarySrv.getUserInfo()?.roles);
    
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkIfChildRouteActive();
        console.log('[HOME] NavigationEnd -> ruta:', this.router.url, 'rutaHijaActiva:', this.rutaHijaActiva);
      });
  }

  private checkIfChildRouteActive(): void {
    let route = this.activatedRoute.firstChild;
    while (route?.firstChild) {
      route = route.firstChild;
    }
    this.rutaHijaActiva = route !== null && route.snapshot.url.length > 0;
    console.log('[HOME] Estado de ruta hija:', {
      rutaHijaActiva: this.rutaHijaActiva,
      childUrl: route?.snapshot?.url?.map((segment) => segment.path).join('/') || '',
    });
  }

  protected enActivacionRutaHija(): void {
    this.rutaHijaActiva = true;
  }
  
  protected enDesactivacionRutaHija(): void {
    this.rutaHijaActiva = false;
  }

  protected hasRole(roleIds: number[]): boolean {
    return this.auxiliarySrv.hasRole(roleIds);
  }
}
