import { RxStomp } from '@stomp/rx-stomp';

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IMessage, StompHeaders } from '@stomp/stompjs';
import { environment } from '@environments/environment.development';
@Injectable({
  providedIn: 'root',
})
export class WebsocketService {
  private rxStomp:RxStomp;

  constructor() {
    this.rxStomp = new RxStomp();
    this.configure();
  }

  public get estado() : boolean {
    return this.rxStomp.connected();
  }

  private configure(): void {
    const serverUrl = `${environment.urlWebSocketSpring}ws`;
    this.rxStomp.configure({
      webSocketFactory: () => {
        try {
          return new WebSocket(serverUrl)
        } catch (error) {
          const e = error as any;
          throw error;
        }
      },
      reconnectDelay: 5000,
      debug:(e)=>console.log(e),
    });

    this.rxStomp.activate();
  }

  watch(destination: string): Observable<IMessage> {
    return this.rxStomp.watch(destination);
  }

  publish(destination: string, body: any, headers: StompHeaders = {}): void {
    this.rxStomp.publish({
      destination,
      headers,
      body: JSON.stringify(body)
    });
  }
}
