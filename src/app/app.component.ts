import { Component } from '@angular/core';
import { LayoutBaseComponent } from '@core/layouts/layout-base/layout-base.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LayoutBaseComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'sisrec';
}
