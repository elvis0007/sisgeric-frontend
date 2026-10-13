import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  inject,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  @ViewChildren('details') detailsElements!: QueryList<
    ElementRef<HTMLDetailsElement>
  >;
  private readonly router = inject(Router);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);
  // Definición de constantes de roles basadas en la información del usuario
  protected ADMINISTRADOR = 1;
  protected AUDITOR_JEFE = 2;      // 'AUDITOR INTERNO JEFE'
  protected AUDITOR_OPERATIVO = 3;
  protected RESPONSABLE = 4;       // 'RESPONSABLE'
  protected DIRECTOR = 5;

  protected hasRole(roleIds: number[]): boolean {
    // Usamos el servicio para verificar si el usuario tiene alguno de los roles especificados
    return this.auxiliarySrv.hasRole(roleIds);
  }

  ngAfterViewInit() {
    this.detailsElements.forEach((details) => {
      details.nativeElement.addEventListener('toggle', (event) => {
        if ((event.target as HTMLDetailsElement).open) {
          this.closeOtherDetails(details.nativeElement);
        }
      });
    });
  }

  private closeOtherDetails(openedDetails: HTMLDetailsElement) {
    this.detailsElements.forEach((details) => {
      if (details.nativeElement !== openedDetails) {
        details.nativeElement.open = false;
      }
    });
  }

  protected navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
