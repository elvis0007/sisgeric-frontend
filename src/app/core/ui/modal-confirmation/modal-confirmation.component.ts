import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  inject,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@core/ui/button/button.component';
import { ModalConfirmationService } from '@core/services/modal-confirmation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-modal-confirmation',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './modal-confirmation.component.html',
  styleUrl: './modal-confirmation.component.css',
})
export class ModalConfirmationComponent implements OnInit, OnDestroy {
  @Input() title: string = '¿Estas seguro?';
  @Input() message: string = '¿Quieres eliminar el elemento?';
  @Input() confirmText: string = 'CONFIRMAR';
  @Input() cancelText: string = 'CANCELAR';
  @Input() confirmButtonType: 'primary' | 'secondary' | 'accent' | 'ghost' | 'error' =
    'primary';
  @Input() cancelButtonType: 'primary' | 'secondary' | 'accent' | 'ghost' | 'error' =
    'error';
  @Input() titleClass: string = '';
  @Input() iconType: 'warning' | 'info' | 'question' | 'success' | 'error' | 'none' = 'question';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  
  @ViewChild('modal') modalElement!: ElementRef<HTMLDialogElement>;

  private modalService = inject(ModalConfirmationService);
  private subscriptions: Subscription[] = [];
  private currentActionId: string | null = null;

  protected showDonotShowAgain = false;
  protected donotShowAgainChecked = false;
  protected donotShowAgainStorageKey = 'sisrec_no_mostrar_advertencia_solicitud';

  protected get confirmButtonClass(): string {
    switch (this.confirmButtonType) {
      case 'error':
        return 'btn-error text-white';
      case 'secondary':
        return 'btn-secondary text-white';
      case 'accent':
        return 'btn-accent text-white';
      case 'ghost':
        return 'btn-ghost text-base-content';
      case 'primary':
      default:
        return 'btn-primary text-white';
    }
  }

  protected get cancelButtonClass(): string {
    switch (this.cancelButtonType) {
      case 'primary':
        return 'btn-primary text-white';
      case 'secondary':
        return 'btn-secondary text-white';
      case 'accent':
        return 'btn-accent text-white';
      case 'ghost':
        return 'btn-ghost text-base-content';
      case 'error':
      default:
        return 'btn-error text-white';
    }
  }

  ngOnInit() {
    // Suscribirse para detectar cuándo mostrar el modal
    this.subscriptions.push(
      this.modalService.onShowModal.subscribe(config => {
        if (config.title) this.title = config.title;
        if (config.message) this.message = config.message;
        if (config.confirmText !== undefined) this.confirmText = config.confirmText;
        if (config.cancelText !== undefined) this.cancelText = config.cancelText;
        this.confirmButtonType = config.confirmButtonType || 'primary';
        this.cancelButtonType = config.cancelButtonType || 'error';
        this.titleClass = config.titleClass || '';

        if (config.iconType) {
          this.iconType = config.iconType;
        } else if (this.confirmButtonType === 'error' || this.cancelButtonType === 'error' && !config.cancelText) {
          this.iconType = 'warning';
        } else {
          this.iconType = 'question';
        }

        this.showDonotShowAgain = !!config.showDonotShowAgain;
        this.donotShowAgainStorageKey = config.donotShowAgainStorageKey || 'sisrec_no_mostrar_advertencia_solicitud';
        this.donotShowAgainChecked = false;

        this.show();
      }),
      
      this.modalService.currentAction.subscribe(actionId => {
        this.currentActionId = actionId;
      })
    );
  }

  ngOnDestroy() {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  protected toggleDonotShowAgain(): void {
    this.donotShowAgainChecked = !this.donotShowAgainChecked;
  }

  protected onCheckboxChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.donotShowAgainChecked = input.checked;
  }

  onConfirm() {
    if (this.showDonotShowAgain) {
      if (this.donotShowAgainChecked) {
        localStorage.setItem(this.donotShowAgainStorageKey, 'true');
      } else {
        localStorage.removeItem(this.donotShowAgainStorageKey);
      }
    }
    this.confirm.emit();
    this.modalService.confirm();
    this.hide();
  }

  onCancel() {
    this.cancel.emit();
    this.modalService.cancel();
    this.hide();
  }

  show() {
    const modalElement = document.getElementById(
      'modal_confirm'
    ) as HTMLDialogElement;
    if (modalElement) {
      modalElement.showModal();
    }
  }

  hide() {
    const modalElement = document.getElementById(
      'modal_confirm'
    ) as HTMLDialogElement;
    if (modalElement) {
      modalElement.close();
    }
  }
}
