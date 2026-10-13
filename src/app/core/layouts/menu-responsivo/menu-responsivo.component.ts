import {
  Component,
  ElementRef,
  inject,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { MenuResponsivoService } from '@core/services/menu-responsivo.service';
import { Router, RouterModule } from '@angular/router';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu-responsivo',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './menu-responsivo.component.html',
  styleUrl: './menu-responsivo.component.css',
})
export class MenuResponsivoComponent {
  protected menuSrv: MenuResponsivoService = inject(MenuResponsivoService);

  @ViewChildren('details') detailsElements!: QueryList<
    ElementRef<HTMLDetailsElement>
  >;
  private readonly router = inject(Router);
  private readonly auxiliarySrv: AuxiliaryService = inject(AuxiliaryService);

  protected ADMINISTRADOR = 1;
  protected AUDITOR_JEFE= 2;
  protected AUDITOR_OPERATIVO = 3;
  protected RESPONSABLE = 4;
  protected DIRECTOR = 5;

  protected hasRole(roleIds: number[]): boolean {
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
