import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationContentService {

  isContentOpen = signal(false);

  openContent() {
    this.isContentOpen.set(true);
  }

  closeContent() {
    this.isContentOpen.set(false);
  }
}
