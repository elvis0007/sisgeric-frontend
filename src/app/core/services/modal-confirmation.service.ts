import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';


export interface ModalConfirmationConfig {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonType?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'error';
  cancelButtonType?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'error';
  titleClass?: string;
  actionId?: string; // Identificador único para cada acción
  showDonotShowAgain?: boolean;
  donotShowAgainStorageKey?: string;
  iconType?: 'warning' | 'info' | 'question' | 'success' | 'error' | 'none';
}

interface ModalConfirmationAction {
  config: ModalConfirmationConfig;
  actionId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalConfirmationService {
  private showModalSubject = new Subject<ModalConfirmationAction>();
  private confirmActionSubject = new Subject<string>();
  private cancelActionSubject = new Subject<string>();
  private currentActionId: string | null = null;

  constructor() { }

  // Observable para que el componente sepa cuándo mostrar el modal
  get onShowModal() {
    return this.showModalSubject.asObservable().pipe(
      map(action => action.config)
    );
  }

  // Observable para obtener el ID de acción actual
  get currentAction() {
    return this.showModalSubject.asObservable().pipe(
      map(action => action.actionId)
    );
  }

  // Observable para recibir la confirmación con filtro por actionId
  onConfirmFor(actionId: string): Observable<void> {
    return this.confirmActionSubject.asObservable().pipe(
      filter(id => id === actionId),
      map(() => undefined)
    );
  }

  // Observable para recibir la cancelación con filtro por actionId
  onCancelFor(actionId: string): Observable<void> {
    return this.cancelActionSubject.asObservable().pipe(
      filter(id => id === actionId),
      map(() => undefined)
    );
  }

  // Para compatibilidad con el código existente
  get onConfirm() {
    return this.confirmActionSubject.asObservable().pipe(
      map(() => undefined)
    );
  }

  // Para compatibilidad con el código existente
  get onCancel() {
    return this.cancelActionSubject.asObservable().pipe(
      map(() => undefined)
    );
  }

  // Método para mostrar el modal
  show(config: ModalConfirmationConfig = {}) {
    const actionId = config.actionId || this.generateActionId();
    this.currentActionId = actionId;
    
    this.showModalSubject.next({
      config,
      actionId
    });
    
    return actionId;
  }

  // Método para emitir confirmación
  confirm() {
    if (this.currentActionId) {
      this.confirmActionSubject.next(this.currentActionId);
    }
  }

  // Método para emitir cancelación
  cancel() {
    if (this.currentActionId) {
      this.cancelActionSubject.next(this.currentActionId);
    }
  }

  // Genera un ID único para cada acción
  private generateActionId(): string {
    return 'action_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
