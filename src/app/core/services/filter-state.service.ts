import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FilterStateService {
  private readonly PREFIX = 'sisrec_filter_';

  setFilters(key: string, value: any): void {
    try {
      sessionStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving filters to sessionStorage', e);
    }
  }

  getFilters(key: string): any | null {
    try {
      const data = sessionStorage.getItem(this.PREFIX + key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading filters from sessionStorage', e);
      return null;
    }
  }

  clearFilters(key: string): void {
    try {
      sessionStorage.removeItem(this.PREFIX + key);
    } catch (e) {
      console.error('Error clearing filters from sessionStorage', e);
    }
  }
}
