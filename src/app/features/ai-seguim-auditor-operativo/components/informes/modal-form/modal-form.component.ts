import { CommonModule } from '@angular/common';
import {
  Component,
  effect,
  inject,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ModalService } from '@features/ai-seguim-auditor-operativo/services/informes/modal.service';
import { FormCreateEditComponent } from '@features/ai-seguim-auditor-operativo/components/informes/form-create-edit/form-create-edit.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Informe } from '@features/ai-seguim-auditor-operativo/models/informe';
import { InformesService } from '@features/ai-seguim-auditor-operativo/services/informes/informes.service';
import { ResponseReadSimple } from '@shared/models/response-read';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-modal-form',
  standalone: true,
  imports: [CommonModule, FormCreateEditComponent],
  templateUrl: './modal-form.component.html',
  styleUrl: './modal-form.component.css',
})
export class ModalFormComponent implements OnInit {
  @Input() reloadTable!: () => void;
  @ViewChild(FormCreateEditComponent) formComponent!: FormCreateEditComponent;
  protected modalService: ModalService = inject(ModalService);
  protected readonly informeSrv: InformesService = inject(InformesService);
  protected readonly alertsService: AlertsStateService = inject(AlertsStateService);
  protected formInforme!: FormGroup;
  protected informe!: Informe;
  protected data!: Informe;
  protected isEditMode = false;

  protected isLoading = false;

  ngOnInit(): void {
    this.initForm();
  }

  constructor() {
    effect(() => {
      this.informe = this.modalService.modalData();
      if (this.informe) {
        this.isLoading = true; // Activamos loading antes de cargar datos
        this.getInforme(this.informe);
      }
    });
  }

  private getInforme(informe: Informe): void {
    this.informeSrv.getInformeByCod(informe).subscribe({
      next: (response: ResponseReadSimple<Informe>) => {
        this.data = response.datos;
        this.isEditMode = !!informe;
        this.initForm();
        this.isLoading = false; // Desactivamos loading cuando termine
      },
      error: (err) => {
        console.error('Error loading informe:', err);
        this.isLoading = false; // Desactivamos loading en caso de error
        this.alertsService.showAlert('Error al cargar el informe', 'error');
      },
    });
  }

  protected closeModal(): void {
    this.modalService.closeModal();
    this.isEditMode = false;
    this.formComponent.resetForm();
  }

  private initForm() {
    this.formInforme = new FormGroup({
      ainin_codigo: new FormControl(this.data?.ainin_codigo || null),
      ainin_titulo: new FormControl((this.data?.ainin_titulo || '').toUpperCase(), [
        Validators.required,
      ]),
      ainin_otnum: new FormControl(this.data?.ainin_otnum || '', [
        Validators.required,
      ]),
      ainin_otanio: new FormControl(
        this.data?.ainin_otanio || new Date().getFullYear(),
        [Validators.required]
      ),

      ainin_infAdjunto: new FormControl(this.data?.ainin_infAdjunto || '', 
        this.isEditMode ? [] : [Validators.required]
      ),
      ainin_archivo: new FormControl(this.data?.ainin_infAdjunto || ''),
      ainin_fechaEmision: new FormControl(
        this.formatDate(this.data?.ainin_fechaEmision),
        [Validators.required]
      ),
      ainin_memoAprobacion: new FormControl(
        (this.data?.ainin_memoAprobacion || '').toUpperCase(), 
        [Validators.required]
      ),
      ainin_fechaAprobacion: new FormControl(
        this.formatDate(this.data?.ainin_fechaAprobacion) || '',
        [Validators.required]
      ),
      ainin_memorando: new FormControl((this.data?.ainin_memorando || '').toUpperCase(), [
        Validators.required,
      ]),
      ainin_fechaMemo: new FormControl(this.data?.ainin_fechaMemo || '', [
        Validators.required,
      ]),
      ainti_tipoInf: new FormControl(this.data?.tipoInf.ainti_codigo || '', [
        Validators.required,
      ]),
      ainoc_organismoControl: new FormControl(
        this.data?.organismoControl.ainoc_codigo || '',
        [Validators.required]
      ),
      urlArchivo: new FormControl(this.data?.urlArchivo || ''),
      nombreArchivo: new FormControl(
        this.getFileName(this.data?.urlArchivo) || ''
      ),
    });
  }

  private formatDate(dateString: string): string | null {
    if (!dateString) return null;
    return dateString.split(' ')[0]; // Esto toma solo la parte de la fecha "YYYY-MM-DD"
  }

  private getFileName(urlFile: string): string {
    if (!urlFile) return '';
    return urlFile.split('/').pop() || '';
  }
}
