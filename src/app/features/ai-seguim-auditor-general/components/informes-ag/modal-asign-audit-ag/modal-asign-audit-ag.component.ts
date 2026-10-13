import { CommonModule } from '@angular/common';
import {
  Component,
  effect,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule
} from '@angular/forms'
import { AlertsStateService } from '@core/services/alerts-state.service';
import {
  ListaAuditorOp,
  Informe,
} from '@features/ai-seguim-auditor-general/models/informe-ag';
import { InformesAgService } from '@features/ai-seguim-auditor-general/services/informes-ag/informes-ag.service';
import { ModalAsignAuditAgService } from '@features/ai-seguim-auditor-general/services/informes-ag/modal-asign-audit-ag.service';

@Component({
  selector: 'app-modal-asign-audit-ag',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-asign-audit-ag.component.html',
  styleUrl: './modal-asign-audit-ag.component.css',
})
export class ModalAsignAuditAgComponent implements OnInit {
  @Output() resetSelected = new EventEmitter<void>();
  @Input() reloadTable!: () => void;
  protected modalSrvAsignAud: ModalAsignAuditAgService = inject(
    ModalAsignAuditAgService
  );
  protected informeSrv: InformesAgService = inject(InformesAgService);
  protected readonly alertService = inject(AlertsStateService);

  protected isLoadingBoton = false;
  protected isEmpty = false;
  protected informes: Informe[] = [];
  protected auditorOperativos?: ListaAuditorOp;
  protected selectedAuditor: any = '';
  protected formAuditor!: FormGroup;

  ngOnInit(): void {
    this.getAuditoresOperativos();
    this.initForm();
  }

  constructor() {
    effect(() => {
      this.informes = this.modalSrvAsignAud.modalData() || [];
      this.isEmpty = this.informes.length === 0;
      this.initForm();
    });
  }

  private initForm(): void {
    this.formAuditor = new FormGroup({
      aseru_cuenta: new FormControl(''),
    });
  }

  private getAuditoresOperativos(): void {
    // Carga la lista de auditores operativos
    this.informeSrv.getAuditores().subscribe({
      next: (response) => {
        this.auditorOperativos = response.datos;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  // Método para confirmar la asignación
  confirmAssignment(): void {
    this.isLoadingBoton = true;
    // Extrae los códigos de los informes seleccionados
    const infCodes = this.informes.map((inf) => inf.ainin_codigo);
    const cuenta = this.formAuditor.get('aseru_cuenta')?.value;
    // Llama al servicio para cambiar el auditor
    this.informeSrv.changeAuditor(infCodes, cuenta).subscribe({
      next: (res) => {
        this.alertService.showAlert(res.mensaje, 'success');
        this.isLoadingBoton = false;
        this.modalSrvAsignAud.closeModal();
        this.reloadTable();
        this.resetSelected.emit();
      },
      error: () => {
        this.isLoadingBoton = false;
        this.alertService.showAlert('Error al cambiar auditor', 'error');
      },
    });
  }

  protected closeModal(event: Event): void {
    event.preventDefault();
    this.modalSrvAsignAud.closeModal();
  }
}
