import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule, UrlTree } from '@angular/router';
import { BreadcrumbComponent } from 'xng-breadcrumb';


@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterModule, BreadcrumbComponent],
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.css']
})
export class BreadcrumbsComponent {
  private readonly router = inject(Router);

  protected get destinoVolver(): UrlTree | null {
    let route = this.router.routerState.root;
    while (route.firstChild) route = route.firstChild;
    if (!route.parent || route.routeConfig?.path === 'inicio') return null;
    return this.router.createUrlTree(['.'], { relativeTo: route.parent });
  }
}
