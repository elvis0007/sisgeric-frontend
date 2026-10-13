import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NavegacionStateService {
  private selectedState = signal<number | null>(null);
  private onlyPendingJustify = signal<boolean>(false);
  private onlyShowJustified = signal<boolean>(false);
  private onlyPendingRequests = signal<boolean>(false);

  setSelectedState(state: number): void {
    this.selectedState.set(state);
  }

  getSelectedState(): number | null {
    return this.selectedState();
  }

  setOnlyPendingJustify(val: boolean): void {
    this.onlyPendingJustify.set(val);
  }

  getOnlyPendingJustify(): boolean {
    return this.onlyPendingJustify();
  }

  setOnlyShowJustified(val: boolean): void {
    this.onlyShowJustified.set(val);
  }

  getOnlyShowJustified(): boolean {
    return this.onlyShowJustified();
  }

  setOnlyPendingRequests(val: boolean): void {
    this.onlyPendingRequests.set(val);
  }

  getOnlyPendingRequests(): boolean {
    return this.onlyPendingRequests();
  }

  selectedState$ = this.selectedState.asReadonly();

  clearState(): void {
    this.selectedState.set(null);
    this.onlyPendingJustify.set(false);
    this.onlyShowJustified.set(false);
    this.onlyPendingRequests.set(false);
  }
}
