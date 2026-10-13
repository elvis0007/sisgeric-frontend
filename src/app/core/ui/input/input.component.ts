import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.css'
})
export class InputComponent {

  @Input() type: 'text' | 'password' | 'email' | 'search' | 'number' = 'text';
  @Input() placeholder: string = '';
  @Input() disabled: boolean = false;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  value: string = '';
  onChange: any = () => {};
  onTouched: any = () => {};

  get inputClasses(): string {
    const baseClasses = `w-full input-${this.size}`;
    return this.type === 'search' ? `${baseClasses} search-input` : baseClasses;
  }
  
  writeValue(value: string): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value = value;
    this.onChange(value);
  }

  onBlur(): void {
    this.onTouched();
  }

}
