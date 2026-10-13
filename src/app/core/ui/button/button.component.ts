import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [],
  templateUrl: './button.component.html',
  styleUrl: './button.component.css'
})
export class ButtonComponent {

  @Input() text: string = 'Button';
  @Input() loadingText: string = 'Cargando...';
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;

  @Output() buttonClick = new EventEmitter<void>();

  get buttonClasses(): string {
    return `btn btn-${this.size} text-white` ;
  }

  onClick() {
    if (!this.disabled && !this.loading) {
      this.buttonClick.emit();
    }
  }

}
