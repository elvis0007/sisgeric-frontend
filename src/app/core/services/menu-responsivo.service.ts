import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MenuResponsivoService {

  private _isOpen = signal(false);
  
  isOpen = this._isOpen.asReadonly();

  toggle() {
    this._isOpen.update(v => !v);
  }

  close() {
    this._isOpen.set(false);
  }
}
