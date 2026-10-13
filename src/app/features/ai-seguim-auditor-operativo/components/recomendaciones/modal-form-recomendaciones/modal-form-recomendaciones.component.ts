import { ModalAddResponsablesComponent } from '@features/ai-seguim-auditor-operativo/components/conclusiones/modal-add-responsables/modal-add-responsables.component';
import { ModalAddResponsablesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/modal-add-responsables.service';
import { ConclusionesService } from '@features/ai-seguim-auditor-operativo/services/conclusiones/conclusiones.service';
import { ResponsableInfo } from '@features/ai-seguim-auditor-operativo/models/responsable';
import { CommonModule } from '@angular/common';
import { Component, effect, ElementRef, inject, Input, OnInit, ViewChild } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  Recomendacion,
  RecomendacionWrite,
  ResponsableView,
} from '@features/ai-seguim-auditor-operativo/models/recomendacion';
import { ModalFormRecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/modal-form-recomendaciones.service';
import { RecomendacionesService } from '@features/ai-seguim-auditor-operativo/services/recomendaciones/recomendaciones.service';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-modal-form-recomendaciones',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, ModalAddResponsablesComponent],
  providers: [ModalAddResponsablesService],
  templateUrl: './modal-form-recomendaciones.component.html',
  styleUrl: './modal-form-recomendaciones.component.css',
})
export class ModalFormRecomendacionesComponent implements OnInit {
  @ViewChild('listaEvidencias') private listaEvidencias?: ElementRef<HTMLOListElement>;
  @Input() reloadTable!: () => void;
  protected readonly alertsService = inject(AlertsStateService);
  protected numRecomendacion: number = 0;
  protected showNumRecError: boolean = false;
  protected recommendationText: string = ''; // Vinculado al campo de recomendación
  protected recommendationDate: string = ''; // Vinculado al campo de fecha máxima
  protected defaultDate: string = ''; // Fecha predeterminada
  private originalFechaMaxima: string = ''; // Para almacenar la fecha original
  private fechaInicioControl: string = ''; // Para almacenar la fecha de inicio de control

  private numConclusion!: number;
  protected modalFormRecomendacionSrv: ModalFormRecomendacionesService = inject(
    ModalFormRecomendacionesService
  );

  protected readonly auxiliarSrv = inject(AuxiliaryService);
  protected readonly recomendacionSrv: RecomendacionesService = inject(
    RecomendacionesService
  );

  private readonly conclusionesSrv = inject(ConclusionesService);
  protected personalDisponible: ResponsableInfo[] = [];
  protected responsablesSeleccionados: ResponsableInfo[] = [];
  protected busquedaResponsable = '';
  private readonly modalAddResponsSrv = inject(ModalAddResponsablesService);
  protected personalParaSeleccionar: ResponsableInfo[] = [];
  protected cargandoPersonal = false;

  protected get personalFiltrado(): ResponsableInfo[] {
    const texto = this.busquedaResponsable.trim().toLowerCase();
    return this.personalDisponible.filter(p => `${p.NOMBRES} ${p.APELLIDOS} ${p.DEPARTAMENTO} ${p.CARGO}`.toLowerCase().includes(texto));
  }

  protected estaSeleccionado(persona: ResponsableInfo): boolean {
    return this.responsablesSeleccionados.some(p => p.CODIGO === persona.CODIGO);
  }

  protected alternarResponsable(persona: ResponsableInfo): void {
    if (this.isLoadingSubmint) return;
    this.responsablesSeleccionados = this.estaSeleccionado(persona)
      ? this.responsablesSeleccionados.filter(p => p.CODIGO !== persona.CODIGO)
      : [...this.responsablesSeleccionados, persona];
  }

  protected abrirSelectorResponsables(): void {
    if (this.isLoadingSubmint || this.cargandoPersonal) return;
    this.personalParaSeleccionar = this.personalDisponible.map(persona => ({
      ...persona,
      isAssigned: this.estaSeleccionado(persona),
      selected: this.estaSeleccionado(persona),
    }));
    if (!this.personalParaSeleccionar.length) {
      this.cargarPersonal();
      this.alertsService.showAlert('El personal no esta disponible. Intente nuevamente.', 'info');
      return;
    }
    this.modalAddResponsSrv.openModal(null, 'assing');
  }

  protected recibirResponsables(personas: ResponsableInfo[]): void {
    const seleccion = new Map(this.responsablesSeleccionados.map(p => [p.CODIGO, p]));
    personas.forEach(p => seleccion.set(p.CODIGO, p));
    this.responsablesSeleccionados = [...seleccion.values()];
  }

  private cargarPersonal(): void {
    if (this.personalDisponible.length || this.cargandoPersonal) return;
    this.cargandoPersonal = true;
    this.conclusionesSrv.getPersonalInfo().subscribe({
      next: res => { this.personalDisponible = res.DATA || []; this.cargandoPersonal = false; },
      error: () => { this.cargandoPersonal = false; this.alertsService.showAlert('No se pudo cargar el personal', 'error'); }
    });
  }

  protected isLoadingSubmint = false;
  protected formRecomendacion!: FormGroup;

  private evidenciaIds = new WeakMap<FormControl<string>, number>();

  protected get evidencias(): FormArray<FormControl<string>> {
    return this.formRecomendacion.get('evidencias') as FormArray<FormControl<string>>;
  }

  protected get evidenciaTexto(): string {
    return this.evidencias.controls.map(control => control.value.trim())
      .filter(Boolean).map((texto, index) => `${index + 1}. ${texto}`).join('\n');
  }

  protected agregarEvidencia(): void {
    if (this.isLoadingSubmint) return;
    this.evidencias.push(new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }));
    setTimeout(() => {
      const lista = this.listaEvidencias?.nativeElement;
      const input = lista?.querySelector<HTMLInputElement>('li:last-child input');
      input?.focus({ preventScroll: true });
      if (lista) lista.scrollTop = lista.scrollHeight;
    });
  }

  protected quitarEvidencia(index: number): void {
    if (!this.isLoadingSubmint && this.evidencias.length > 1) this.evidencias.removeAt(index);
  }

  protected data!: Recomendacion;
  protected isEditMode = false;
  protected formSubmitted = false;
  protected showRecommendationError: boolean = false; // Controla el mensaje de error para recomendación

  // Responsables para edición individual de fecha
  protected responsablesActivos: ResponsableView[] = [];
  protected isLoadingResponsables = false;
  protected selectedResponsableCodigo: number | null = null;
  protected selectedResponsable: ResponsableView | null = null;

  ngOnInit(): void {
    this.numConclusion = parseInt(
      this.auxiliarSrv.getUrlParameter('id_con').toString()
    );
    this.initForm();
  }

  constructor() {
    effect(() => {
      const modalData = this.modalFormRecomendacionSrv.modalData();
      const operationType = this.modalFormRecomendacionSrv.getOperationType();

      if (modalData) {
        this.isEditMode = operationType === 'edit';
        this.data = modalData;

        if (this.isEditMode) {
          // Para editar: usar fecha máxima original y fecha inicio de la recomendación
          this.originalFechaMaxima = this.formatDateForInput(this.data.arere_fecha_maxima);
          this.fechaInicioControl = this.data.arere_fecha_inicio_control;
          this.loadResponsables(this.data.arere_codigo);
        } else {
          this.modalAddResponsSrv.closeModal();
          this.responsablesSeleccionados = [];
          this.busquedaResponsable = '';
          this.cargarPersonal();
          this.responsablesActivos = [];
          this.selectedResponsableCodigo = null;
          this.selectedResponsable = null;
          // Para agregar: usar fecha inicio del modal data y calcular fecha máxima
          this.fechaInicioControl = this.data.arere_fecha_inicio_control;
          this.setDefaultDateFromFechaInicio();
        }

        this.initForm(); // Reinitialize the form with the new data
      }
    });
  }

  protected formatDateForInput(d: string | null | undefined): string {
    if (!d) return '';
    const clean = d.split(' ')[0].split('T')[0].trim();
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        // Formato DD/MM/YYYY -> YYYY-MM-DD
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return clean;
  }

  private loadResponsables(codRec: number): void {
    this.isLoadingResponsables = true;
    this.recomendacionSrv.getResponsables(codRec).subscribe({
      next: (response) => {
        this.responsablesActivos = (response.datos || []).filter(
          (r) => r.arers_estado !== '0'
        );
        this.isLoadingResponsables = false;

        if (this.responsablesActivos.length === 1) {
          this.onSelectResponsable(this.responsablesActivos[0].arers_codigo);
        } else if (this.responsablesActivos.length > 1) {
          this.selectedResponsableCodigo = null;
          this.selectedResponsable = null;
          const fechaBase = this.formatDateForInput(this.data.arere_fecha_maxima);
          this.originalFechaMaxima = fechaBase;
          this.formRecomendacion.patchValue({
            arere_fecha_maxima: fechaBase,
          });
        } else {
          this.selectedResponsableCodigo = null;
          this.selectedResponsable = null;
          const fechaBase = this.formatDateForInput(this.data.arere_fecha_maxima);
          this.originalFechaMaxima = fechaBase;
          this.formRecomendacion.patchValue({
            arere_fecha_maxima: fechaBase,
          });
        }
      },
      error: () => {
        this.isLoadingResponsables = false;
        this.responsablesActivos = [];
      },
    });
  }

  protected onSelectResponsable(cod: any): void {
    if (cod === null || cod === '' || cod === 'TODOS') {
      this.selectedResponsableCodigo = null;
      this.selectedResponsable = null;
      const fechaBase = this.formatDateForInput(this.data.arere_fecha_maxima);
      this.originalFechaMaxima = fechaBase;
      this.formRecomendacion.patchValue({
        arere_fecha_maxima: fechaBase,
      });
    } else {
      const numCod = Number(cod);
      this.selectedResponsableCodigo = numCod;
      this.selectedResponsable =
        this.responsablesActivos.find((r) => r.arers_codigo === numCod) || null;
      const fechaResp = this.formatDateForInput(
        this.selectedResponsable?.aredr_fecha_maxima ||
          this.data.arere_fecha_maxima
      );
      this.originalFechaMaxima = fechaResp;
      this.formRecomendacion.patchValue({
        arere_fecha_maxima: fechaResp,
      });
    }
  }

  protected getFechaGlobal(): string {
    return this.formatDateForInput(this.data?.arere_fecha_maxima);
  }

  protected getFechaGlobalFormateada(): string {
    const fecha = this.getFechaGlobal();
    if (!fecha) return '';
    const parts = fecha.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fecha;
  }

  protected getMinDate(): string {
    if (this.isEditMode) {
      return this.getFechaGlobal();
    }
    if (this.fechaInicioControl) {
      return this.formatDateForInput(this.fechaInicioControl);
    }
    return '';
  }

  protected isFechaMenorOGlobal(): boolean {
    if (!this.isEditMode) return false;
    const nuevaFecha = this.formRecomendacion.get('arere_fecha_maxima')?.value;
    const fechaGlobal = this.getFechaGlobal();
    if (!nuevaFecha || !fechaGlobal) return false;
    return nuevaFecha < fechaGlobal;
  }

  protected toSend() {
    if (this.isLoadingSubmint) return;
    this.formSubmitted = true;
    this.formRecomendacion.get('arere_evidencia_requerida')?.setValue(this.evidenciaTexto);
    if (this.formRecomendacion.invalid) {
      this.markFormGroupTouched(this.formRecomendacion);
      this.alertsService.showAlert(
        'Por favor complete los campos requeridos correctamente',
        'error'
      );
      return;
    }

    if (this.isEditMode && this.isFechaMenorOGlobal()) {
      this.alertsService.showAlert(
        `La fecha no puede ser anterior a la fecha global (${this.getFechaGlobalFormateada()}). Debe ser posterior.`,
        'error'
      );
      return;
    }

    const codigo = this.formRecomendacion.get('arere_codigo')?.value;
    codigo ? this.editRecomendacion() : this.registerRecomendacion();
  }

  protected onRecomendacionInput(): void {
    if (this.recommendationText.trim()) {
      this.showRecommendationError = false;
    }
  }

  protected onNumRecomendacionInput(): void {
    if (this.numRecomendacion === 0) {
      this.showNumRecError = false;
    }
  }

  // Verifica si la fecha ha cambiado respecto a la fecha original del seleccionado
  private isFechaModificada(): boolean {
    const nuevaFecha = this.formRecomendacion.get('arere_fecha_maxima')?.value;
    return !!nuevaFecha && nuevaFecha !== this.originalFechaMaxima;
  }

  private editRecomendacion(): void {
    this.isLoadingSubmint = true;

    const recomendacionData: RecomendacionWrite = {
      arere_codigo: this.formRecomendacion.get('arere_codigo')?.value,
      arere_descripcion: this.formRecomendacion.get('arere_descripcion')?.value,
      arere_fecha_inicio_control: this.fechaInicioControl, // Mantener fecha inicio original
      arere_fecha_maxima: this.formRecomendacion.get('arere_fecha_maxima')?.value,
      arere_num_rec: this.formRecomendacion.get('arere_num_rec')?.value,
      arers_codigo: this.selectedResponsableCodigo,
      arere_evidencia_requerida: this.evidenciaTexto,
      arere_evidencias_requeridas: this.evidencias.controls.map(c => ({ arer_codigo: this.evidenciaIds.get(c), arer_descripcion: c.value.trim() })),
      arere_riesgo_verificado: this.formRecomendacion.get('arere_riesgo_verificado')?.value,
    };

    const codRec = recomendacionData.arere_codigo;
    const codResp = this.selectedResponsableCodigo;

    this.recomendacionSrv.editRecomendacion(recomendacionData).subscribe({
      next: () => {
        // Solo notificar si la fecha fue modificada
        if (this.isFechaModificada()) {
          this.notificarCambioFecha(codRec, codResp);
        } else {
          this.alertsService.showAlert('Recomendación editada correctamente', 'success');
          this.isLoadingSubmint = false;
          this.modalFormRecomendacionSrv.closeModal();
          this.resetForm();
          this.reloadTable();
        }
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  private notificarCambioFecha(codRec: number, codResp?: number | null): void {
    this.recomendacionSrv.notificarCambioFecha(codRec, codResp).subscribe({
      next: (response) => {
        this.handleSuccess(response);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  private handleSuccess(response: any): void {
    const mensaje = response.mensaje || 'Notificación de cambio de fecha enviada correctamente';
    this.alertsService.showAlert(mensaje, 'success');
    this.isLoadingSubmint = false;
    this.modalFormRecomendacionSrv.closeModal();
    this.resetForm();
    this.reloadTable();
  }

  private handleError(err: any): void {
    const mensajeError = err.message || 'Error al procesar la operación';
    this.alertsService.showAlert(mensajeError, 'error');
    this.isLoadingSubmint = false;
  }

  private registerRecomendacion(): void {
    this.isLoadingSubmint = true;
    const recomendacionData: RecomendacionWrite = {
      arere_codigo: this.formRecomendacion.get('arere_codigo')?.value,
      arere_descripcion: this.formRecomendacion.get('arere_descripcion')?.value,
      arere_fecha_inicio_control: this.fechaInicioControl, // Usar fecha inicio consistente
      arere_fecha_maxima: this.formRecomendacion.get('arere_fecha_maxima')?.value,
      arere_num_rec: this.formRecomendacion.get('arere_num_rec')?.value,
      arere_riesgo_verificado: this.formRecomendacion.get('arere_riesgo_verificado')?.value,
      arere_evidencia_requerida: this.formRecomendacion.get('arere_evidencia_requerida')?.value.trim(),
      arere_evidencias_requeridas: this.evidencias.controls.map(c => ({ arer_descripcion: c.value.trim() })),
      responsables: this.responsablesSeleccionados.map(p => ({
        arers_codigo_per: p.CODIGO, arers_nombre: p.NOMBRES, arers_apellido: p.APELLIDOS,
        arers_correo: p.EMAIL, arers_seccion: p.SECCION, arers_cargo: p.CARGO,
        arers_departamento: p.DEPARTAMENTO, arers_departamento_abrev: p.DEPARTAMENTO_ABREV,
        arers_num_rol: p.ROL, arers_usuario_per: p.USUARIO,
      })),
    };

    this.recomendacionSrv
      .registerRecomendacion(recomendacionData, this.numConclusion)
      .subscribe({
        next: (response) => {
          this.alertsService.showAlert(response.mensaje, 'success');
          this.isLoadingSubmint = false;
          this.modalFormRecomendacionSrv.closeModal();
          this.resetForm();
          this.reloadTable();
        },
        error: (err) => {
          this.alertsService.showAlert(err.message, 'error');
          this.isLoadingSubmint = false;
        },
      });
  }

  protected onDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.recommendationDate = target.value;
  }

  // Calcular fecha máxima por defecto basada en fecha_inicio_control + 30 días (1 mes)
  private setDefaultDateFromFechaInicio(): void {
    if (this.fechaInicioControl) {
      const cleanDateStr = this.fechaInicioControl.split(' ')[0].split('T')[0];
      const [anio, mes, dia] = cleanDateStr.split('-').map(Number);
      const futureDate = new Date(anio, mes - 1, dia);
      futureDate.setDate(futureDate.getDate() + 30); // Adds 30 days (1 month)
      const a = futureDate.getFullYear();
      const m = String(futureDate.getMonth() + 1).padStart(2, '0');
      const d = String(futureDate.getDate()).padStart(2, '0');
      const formattedDate = `${a}-${m}-${d}`;
      this.recommendationDate = formattedDate; // Set the default date
      this.defaultDate = formattedDate;
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private desglosarEvidencias(texto: string): string[] {
    const contenido = texto.trim();
    return /^1[.)]\s+/.test(contenido)
      ? contenido.split(/(?:\r?\n)+(?=\d+[.)]\s+)/).map(item => item.replace(/^\d+[.)]\s+/, ''))
      : [contenido];
  }

  private initForm() {
    let fecha_maxima: string;

    if (this.isEditMode) {
      // Para editar: usar la fecha máxima existente
      fecha_maxima = this.formatDateForInput(this.data?.arere_fecha_maxima);
    } else {
      // Para agregar: usar la fecha calculada desde fecha_inicio_control
      fecha_maxima = this.recommendationDate || this.defaultDate;
    }

    this.evidenciaIds = new WeakMap();
    this.formSubmitted = false;
    this.formRecomendacion = new FormGroup({
      evidencias: new FormArray<FormControl<string>>(
        this.desglosarEvidencias(this.isEditMode ? this.data?.arere_evidencia_requerida || '' : '')
          .map(texto => new FormControl(texto, {
            nonNullable: true,
            validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
          }))
      ),
      arere_evidencia_requerida: new FormControl(this.data?.arere_evidencia_requerida || '',
        [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2000)]),
      arere_riesgo_verificado: new FormControl(this.data?.arere_riesgo_verificado || '',
        [Validators.required, Validators.pattern(/^(ALTO|MODERADO|BAJO)$/)]),
      arere_codigo: new FormControl(this.data?.arere_codigo || null),
      arere_fecha_maxima: new FormControl(fecha_maxima || '', [
        Validators.required,
      ]),
      arere_descripcion: new FormControl(this.data?.arere_descripcion || '', [
        Validators.required,
      ]),
      arere_num_rec: new FormControl(this.data?.arere_num_rec || '', [
        Validators.required,
      ]),
    });
    if (this.isEditMode && this.data?.arere_evidencias_requeridas?.length) {
      this.evidencias.clear();
      this.data.arere_evidencias_requeridas.forEach(e => {
        const control = new FormControl(e.arer_descripcion, { nonNullable: true,
          validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)] });
        this.evidencias.push(control);
        if (e.arer_codigo != null) this.evidenciaIds.set(control, e.arer_codigo);
      });
    }
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formRecomendacion.get(fieldName);
    return !!(field?.invalid && this.formSubmitted);
  }

  protected closeModal() {
    this.modalFormRecomendacionSrv.closeModal();
    this.resetForm();
    this.isEditMode = false;
    this.formSubmitted = false;
  }

  public resetForm(): void {
    this.modalAddResponsSrv.closeModal();
    this.responsablesSeleccionados = [];
    this.busquedaResponsable = '';
    this.formRecomendacion.reset({
      arere_evidencia_requerida: '',
      arere_riesgo_verificado: '',
      arere_codigo: null,
      arere_descripcion: '',
      arere_fecha_maxima: this.defaultDate,
    });
    this.evidencias.clear();
    this.evidencias.push(new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }));
    this.formSubmitted = false;
    this.originalFechaMaxima = '';
    this.fechaInicioControl = '';
    this.responsablesActivos = [];
    this.selectedResponsableCodigo = null;
    this.selectedResponsable = null;
    this.isLoadingResponsables = false;
  }
}
