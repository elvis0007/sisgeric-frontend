import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input, OnInit, ElementRef, ViewChild, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { User } from '@core/auth/models/authentication';
import { ModalFormFechaMaxService } from '@features/ai-verificables-respon/services/solicitud/modal-form-fecha-max.service';
import { SolicitudResponsableService } from '@features/ai-verificables-respon/services/solicitud/solicitud-responsable.service';
import { SolicitudesAuditorService } from '@features/ai-rec-solicitudes/services/solicitudes.service';
import { SolicitudPdfGeneratorService, SolicitudPdfPayload } from '@features/ai-rec-solicitudes/services/solicitud-pdf-generator.service';
import { SolicitudDetalle } from '@features/ai-verificables-respon/models/solicitud_rec';
import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';
import { AbsPipe } from '@shared/pipe/abs.pipe';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { FileUtils } from '@shared/utils/file-utils';
import { AlertsStateService } from '@core/services/alerts-state.service';

@Component({
  selector: 'app-modal-form-fecha-max',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AbsPipe],
  templateUrl: './modal-form-fecha-max.component.html',
  styleUrl: './modal-form-fecha-max.component.css',
})
export class ModalFormFechaMaxComponent implements OnInit {
  @Input() reloadCards!: () => void;
  @ViewChild('adjuntoInput') private adjuntoInput?: ElementRef<HTMLInputElement>;

  protected readonly auxiliarSrv = inject(AuxiliaryService);
  protected readonly verificablesRespSrv = inject(VerificablesResponsablesService);
  protected readonly modalFormSrv = inject(ModalFormFechaMaxService);
  protected readonly solicitudSrv = inject(SolicitudResponsableService);
  protected readonly solicitudesAudSrv = inject(SolicitudesAuditorService);
  protected readonly pdfGenSrv = inject(SolicitudPdfGeneratorService);
  private readonly sanitizer: DomSanitizer = inject(DomSanitizer);
  protected readonly fileUtils = inject(FileUtils);
  protected readonly alertsService = inject(AlertsStateService);

  protected formSolicitud!: FormGroup;
  protected isEditMode = false;
  protected formSubmitted = false;
  protected fileName: string = '';
  protected archivoAdjunto: File | null = null;
  protected user: User | null = this.auxiliarSrv.getUserInfo();
  protected solicitudDetalle: SolicitudDetalle | null = null;
  protected modalData: any = null;
  protected isLoading = false;
  protected isLoadingSubmint = false;

  // Signals para datos automáticos institucionales
  protected numeroSolicitud = signal<string | number>('Cargando...');
  protected nombreDirector = signal<string>('Cargando...');
  protected departamento = signal<string>('');
  protected correoDirector = signal<string>('');
  protected cargoResponsable = signal<string>('');
  protected fechaSolicitud = signal<string>('');

  // Control del visualizador
  protected activeTab: 'form' | 'preview' = 'form';
  protected previewMode: 'document' | 'pdf' = 'document';
  protected safePdfUrl: SafeResourceUrl | null = null;
  protected pdfBlobUrl: string | null = null;
  protected isGeneratingPdf: boolean = false;

  private lastLoadedArereCode: number | null = null;

  ngOnInit(): void {
    this.user = this.auxiliarSrv.getUserInfo();
    this.initForm();
  }

  constructor() {
    effect(() => {
      this.modalData = this.modalFormSrv.modalData();
      const operationType = this.modalFormSrv.getOperationType();

      if (this.modalData) {
        const arereCode = this.modalData?.arere_codigo ||
          this.modalData?.codRec ||
          this.modalData?.arere_codigo_rec ||
          this.modalData?.recomendaciones?.arere_codigo ||
          this.modalData?.recomendacion?.arere_codigo;

        const codeNum = arereCode ? +arereCode : null;

        this.clearFileState();
        this.solicitudDetalle = null;
        this.isEditMode = operationType === 'edit';
        this.activeTab = 'form';
        this.previewMode = 'document';

        const today = new Date().toISOString().split('T')[0];
        this.fechaSolicitud.set(today);

        if (codeNum && (this.lastLoadedArereCode !== codeNum || !this.modalData.memorandoInforme || !this.modalData.tituloInforme)) {
          this.lastLoadedArereCode = codeNum;
          this.isLoading = true;

          // Carga completa mediante el servicio de verificables de la recomendación
          this.verificablesRespSrv.getRecomendacionDetalle(codeNum).subscribe({
            next: (res) => {
              if (res && res.datos) {
                this.modalData = {
                  ...this.modalData,
                  arere_codigo: codeNum,
                  tituloInforme: res.datos.ainin_titulo || this.modalData?.tituloInforme || '',
                  memorandoInforme: res.datos.ainin_memorando || this.modalData?.memorandoInforme || '',
                  memorandoAprobacion: res.datos.ainin_memo_aprobacion || this.modalData?.memorandoAprobacion || '',
                  descripcionRecomendacion: res.datos.recomendaciones?.arere_descripcion ||
                    res.datos.arere_descripcion || this.modalData?.descripcionRecomendacion || '',
                  fechaMaximaActual: this.modalData?.fechaMaximaActual ||
                    res.datos.recomendaciones?.arere_fecha_maxima ||
                    res.datos.arere_fecha_maxima ||
                    this.modalData?.areso_fecha_max_ant || '',
                  plazo: this.modalData?.plazo ?? res.datos.plazo ?? res.datos.recomendaciones?.plazo,
                  plazo_individual: this.modalData?.plazo_individual ?? res.datos.plazo_individual ?? res.datos.recomendaciones?.plazo_individual
                };
              }
              this.initForm();
              this.cargarDatosDirector();
              if (this.previewMode === 'pdf') {
                this.updatePdfPreview();
              }

              if (this.isEditMode && this.modalData?.areso_codigo) {
                this.getSolicitudDetalle(this.modalData.areso_codigo);
              } else if (this.isEditMode && this.modalData?.areso_descripcion) {
                const justif = this.extractJustificacion(this.modalData.areso_descripcion);
                if (justif) {
                  this.formSolicitud.patchValue({ justificacion: justif });
                }
                this.isLoading = false;
              } else {
                this.isLoading = false;
              }
            },
            error: (err) => {
              console.error('Error al cargar detalle de recomendación:', err);
              this.initForm();
              this.cargarDatosDirector();
              this.isLoading = false;
            }
          });
        } else {
          this.initForm();
          this.cargarDatosDirector();
          if (this.isEditMode && this.modalData?.areso_codigo) {
            this.getSolicitudDetalle(this.modalData.areso_codigo);
          } else {
            this.isLoading = false;
          }
        }
      }
    }, { allowSignalWrites: true });
  }

  public getDefaultDetalleText(): string {
    const memorando = this.modalData?.memorandoInforme ||
      this.modalData?.ainin_memorando ||
      this.modalData?.memorando || '';

    const memorandoAprobacion = this.modalData?.memorandoAprobacion ||
      this.modalData?.ainin_memo_aprobacion ||
      this.modalData?.memo_aprobacion || '';

    const recomendacion = this.modalData?.descripcionRecomendacion ||
      this.modalData?.arere_descripcion ||
      this.modalData?.recomendaciones?.arere_descripcion ||
      this.modalData?.recomendacion || '';

    let texto = 'Por medio del presente, se solicita la ampliación del plazo para dar atención a la recomendación';

    if (recomendacion) {
      texto += ` ${recomendacion.trim()}`;
    }

    if (memorando && memorandoAprobacion && memorando.trim() !== memorandoAprobacion.trim()) {
      texto += `, correspondiente al Informe remitido con memorandos ${memorando.trim()} y ${memorandoAprobacion.trim()}`;
    } else if (memorando) {
      texto += `, correspondiente al Informe remitido con memorando ${memorando.trim()}`;
    } else if (memorandoAprobacion) {
      texto += `, correspondiente al Informe remitido con memorando ${memorandoAprobacion.trim()}`;
    }

    texto += ', en virtud de ';
    return texto;
  }

  private extractJustificacion(descripcion: string): string {
    if (!descripcion) return '';
    const prefix = this.getDefaultDetalleText();
    if (descripcion.startsWith(prefix)) {
      return descripcion.substring(prefix.length).trim();
    }
    if (descripcion.includes(', en virtud de :')) {
      return descripcion.substring(descripcion.indexOf(', en virtud de :') + ', en virtud de :'.length).trim();
    }
    if (descripcion.includes('en virtud de :')) {
      return descripcion.substring(descripcion.indexOf('en virtud de :') + 'en virtud de :'.length).trim();
    }
    if (descripcion.includes(', en virtud de')) {
      return descripcion.substring(descripcion.indexOf(', en virtud de') + ', en virtud de'.length).trim();
    }
    if (descripcion.includes('debido a que')) {
      return descripcion.substring(descripcion.indexOf('debido a que') + 'debido a que'.length).trim();
    }
    if (descripcion !== 'Solicitud de ampliación de plazo') {
      return descripcion.trim();
    }
    return '';
  }

  private cargarDatosDirector(): void {
    this.numeroSolicitud.set('Cargando...');
    this.nombreDirector.set('Cargando...');
    this.cargoResponsable.set('');
    this.departamento.set('');
    this.correoDirector.set('');

    const rolesArray = this.user?.roles || [];
    const tieneRol4 = rolesArray.some((r: any) =>
      r === '4' || r === 4 || r?.asero_codigo === 4 || r?.codigo === 4
    );
    const tieneRol2 = rolesArray.some((r: any) =>
      r === '2' || r === 2 || r?.asero_codigo === 2 || r?.codigo === 2
    );
    const tieneRol5 = rolesArray.some((r: any) =>
      r === '5' || r === 5 || r?.asero_codigo === 5 || r?.codigo === 5
    );
    const esDirectorEquivalente = tieneRol5 || tieneRol2;

    if (esDirectorEquivalente) {
      this.cargarAuditor();
    } else if (tieneRol4) {
      this.cargarDirector();
    } else {
      this.cargarDirector();
    }
  }

  private cargarDirector(): void {
    const codigoPer = this.user?.codigo_per;
    const departamento = this.user?.departamento;

    if (!codigoPer) {
      this.numeroSolicitud.set('Error');
      this.nombreDirector.set('Error');
      return;
    }

    this.solicitudesAudSrv.obtenerDirectorYNumeroSolicitud(codigoPer, departamento).subscribe({
      next: (response: any) => {
        if (response?.codigo === 1 && response?.datos) {
          const datos = response.datos;
          this.numeroSolicitud.set(datos.numeroSolicitud || 'No disponible');
          this.nombreDirector.set(datos.nombreDirector || 'No disponible');
          this.departamento.set(datos.departamento || '');
          this.correoDirector.set(datos.correoDirector || '');
          this.cargoResponsable.set(datos.cargoResponsable || '');
          if (this.previewMode === 'pdf') {
            this.updatePdfPreview();
          }
        } else {
          this.numeroSolicitud.set('Error');
          this.nombreDirector.set('Error');
        }
      },
      error: () => {
        this.numeroSolicitud.set('Error');
        this.nombreDirector.set('Error');
      }
    });
  }

  private cargarAuditor(): void {
    const arereCode = this.modalData?.arere_codigo ||
      this.modalData?.codRec ||
      this.modalData?.arere_codigo_rec ||
      this.modalData?.recomendaciones?.arere_codigo ||
      this.modalData?.recomendacion?.arere_codigo;

    if (!arereCode) {
      this.numeroSolicitud.set('Error');
      this.nombreDirector.set('Error');
      return;
    }

    this.solicitudesAudSrv.obtenerAuditorYNumeroSolicitud(arereCode).subscribe({
      next: (response: any) => {
        if (response?.codigo === 1 && response?.datos) {
          const datos = response.datos;
          this.numeroSolicitud.set(datos.numeroSolicitud || 'No disponible');
          this.nombreDirector.set(datos.nombreDirector || 'No disponible');
          this.departamento.set(datos.departamento || '');
          this.correoDirector.set(datos.correoDirector || '');
          this.cargoResponsable.set(datos.cargoResponsable || '');
          if (this.previewMode === 'pdf') {
            this.updatePdfPreview();
          }
        } else {
          this.numeroSolicitud.set('Error');
          this.nombreDirector.set('Error');
        }
      },
      error: () => {
        this.numeroSolicitud.set('Error');
        this.nombreDirector.set('Error');
      }
    });
  }

  private getSolicitudDetalle(areso_codigo: any): void {
    this.solicitudSrv.getSolicitudDetalle(areso_codigo).subscribe({
      next: (response) => {
        this.solicitudDetalle = response.datos;
        if (this.solicitudDetalle?.areso_descripcion) {
          const justif = this.extractJustificacion(this.solicitudDetalle.areso_descripcion);
          if (justif) {
            this.formSolicitud.patchValue({ justificacion: justif });
          }
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      },
    });
  }

  protected getFechaMaxima(): string {
    return this.modalData?.fechaMaximaActual ||
      this.modalData?.arere_fecha_maxima ||
      this.modalData?.aredr_fecha_maxima ||
      this.modalData?.recomendaciones?.arere_fecha_maxima ||
      '-';
  }

  public getPlazo(): number {
    const raw = this.modalData?.plazo_individual ??
      this.modalData?.plazo ??
      this.modalData?.recomendaciones?.plazo_individual ??
      this.modalData?.recomendaciones?.plazo;
    if (raw !== undefined && raw !== null && !isNaN(Number(raw)) && Number(raw) !== 0) {
      return Number(raw);
    }
    const fMax = this.getFechaMaxima();
    if (fMax && fMax !== '-') {
      return this.calcularDiasLaborables(fMax);
    }
    return typeof raw === 'number' ? raw : 0;
  }

  private calcularDiasLaborables(fechaStr: string): number {
    try {
      const parts = fechaStr.trim().split(/[-/]/);
      let target: Date;
      if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY-MM-DD
          target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else { // DD-MM-YYYY
          target = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      } else {
        target = new Date(fechaStr);
      }
      if (isNaN(target.getTime())) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);

      if (today.getTime() === target.getTime()) return 0;

      const isVencido = target.getTime() < today.getTime();
      const start = new Date(isVencido ? target : today);
      const end = new Date(isVencido ? today : target);

      let workDays = 0;
      const cur = new Date(start);
      while (cur < end) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) { // 0=Domingo, 6=Sábado
          workDays++;
        }
        cur.setDate(cur.getDate() + 1);
      }

      return isVencido ? -workDays : workDays;
    } catch {
      return 0;
    }
  }

  protected getEstadoPlazo(): string {
    const plazo = this.getPlazo();
    const plazoAbs = Math.abs(plazo);
    return `${plazoAbs} ${plazo < 0 ? 'días vencidos' : 'días vigentes'}`;
  }

  public getJustificacionLength(): number {
    return (this.formSolicitud?.get('justificacion')?.value || '').trim().length;
  }

  protected setPreviewMode(mode: 'document' | 'pdf'): void {
    this.previewMode = mode;
    if (mode === 'pdf') {
      this.updatePdfPreview();
    }
  }

  protected setActiveTab(tab: 'form' | 'preview'): void {
    this.activeTab = tab;
    if (tab === 'preview' && this.previewMode === 'pdf') {
      this.updatePdfPreview();
    }
  }

  public buildPdfPayload(): SolicitudPdfPayload | null {
    const justificacion = (this.formSolicitud?.get('justificacion')?.value || '').trim();
    const prefix = this.getDefaultDetalleText();
    let fullDetalle = prefix;
    if (justificacion) {
      if (justificacion.startsWith(':')) {
        fullDetalle = prefix.trimEnd().replace(/:$/, '').trimEnd() + ' ' + justificacion;
      } else {
        fullDetalle = prefix + justificacion;
      }
    }

    const fechaCumplimiento = this.formSolicitud?.get('areso_fecha_max_nue')?.value || '';
    const rawFechaActual = this.formSolicitud?.get('areso_fecha_max_ant')?.value || this.getFechaMaxima();
    const fechaActual = (rawFechaActual && rawFechaActual !== '-') ? rawFechaActual : '';

    const numSol = this.numeroSolicitud();
    const nroSolicitudFinal = (numSol && numSol !== 'Cargando...' && numSol !== 'Error')
      ? numSol.toString()
      : (this.modalData?.numeroSolicitud?.toString() || this.modalData?.nroSolicitud?.toString() || this.modalData?.areso_codigo?.toString() || '');

    const dir = this.nombreDirector();
    const paraFinal = (dir && dir !== 'Cargando...' && dir !== 'Error')
      ? dir
      : (this.modalData?.nombreDirector || this.modalData?.para || 'Director');

    return {
      nroSolicitud: nroSolicitudFinal,
      para: paraFinal,
      fecha: this.formSolicitud?.get('fecha')?.value || this.fechaSolicitud(),
      fechaMaximaActual: fechaActual,
      fechaCumplimiento: fechaCumplimiento,
      detalle: fullDetalle,
      remitente: this.user?.nombre_completo || 'Firma del remitente',
      cargoRemitente: this.cargoResponsable() || '',
      departamento: this.departamento() || this.user?.departamento || ''
    };
  }

  public async updatePdfPreview(): Promise<void> {
    const payload = this.buildPdfPayload();
    if (!payload) return;
    this.isGeneratingPdf = true;
    try {
      const result = await this.pdfGenSrv.generatePdf(payload);
      if (this.pdfBlobUrl) {
        URL.revokeObjectURL(this.pdfBlobUrl);
      }
      this.pdfBlobUrl = result.blobUrl;
      this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(result.blobUrl);
    } catch (e) {
      console.error('Error generando preview de PDF:', e);
    } finally {
      this.isGeneratingPdf = false;
    }
  }

  public async openPdfInNewTab(): Promise<void> {
    const payload = this.buildPdfPayload();
    if (!payload) return;

    if (this.pdfBlobUrl) {
      window.open(this.pdfBlobUrl, '_blank');
      return;
    }

    const newWin = window.open('', '_blank');
    if (newWin) {
      newWin.document.write('<html><head><title>Generando PDF...</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;"><p style="color:#334155;font-weight:600;font-size:14px;">Generando documento PDF institucional, por favor espere...</p></body></html>');
    }

    this.isGeneratingPdf = true;
    try {
      const result = await this.pdfGenSrv.generatePdf(payload);
      if (this.pdfBlobUrl) {
        URL.revokeObjectURL(this.pdfBlobUrl);
      }
      this.pdfBlobUrl = result.blobUrl;
      this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(result.blobUrl);

      if (newWin) {
        newWin.location.href = result.blobUrl;
      } else {
        window.open(result.blobUrl, '_blank');
      }
    } catch (e) {
      if (newWin) {
        newWin.close();
      }
      this.alertsService.showAlert('No se pudo abrir el PDF', 'error');
    } finally {
      this.isGeneratingPdf = false;
    }
  }

  protected async toSend(): Promise<void> {
    this.formSubmitted = true;

    if (this.formSolicitud.invalid) {
      this.markFormGroupTouched(this.formSolicitud);
      this.alertsService.showAlert(
        'Por favor complete todos los campos requeridos. La justificación debe contener al menos 100 caracteres.',
        'error'
      );
      return;
    }

    this.isLoadingSubmint = true;

    try {
      const payload = this.buildPdfPayload();
      if (!payload) {
        this.isLoadingSubmint = false;
        return;
      }

      // Generar el archivo PDF oficial
      const { file } = await this.pdfGenSrv.generatePdf(payload);
      this.archivoAdjunto = file;

      const formData = new FormData();
      const arereCodigo = this.modalData?.arere_codigo ||
        this.modalData?.recomendacion?.arere_codigo ||
        this.modalData?.recomendaciones?.arere_codigo ||
        this.modalData?.codRec;

      formData.append('arere_codigo', String(arereCodigo));
      formData.append('arers_codigo_per', this.user?.codigo_per || '');
      formData.append('areso_fecha_max_ant', this.formSolicitud.get('areso_fecha_max_ant')?.value || '');
      formData.append('areso_fecha_max_nue', this.formSolicitud.get('areso_fecha_max_nue')?.value || '');
      formData.append('areso_descripcion', payload.detalle);

      const memo = this.formSolicitud.get('areso_memorando')?.value;
      if (memo) {
        formData.append('areso_memorando', memo);
      }

      const tipoCambio = this.formSolicitud.get('areso_tipo_cambio')?.value;
      if (tipoCambio) {
        formData.append('areso_tipo_cambio', tipoCambio);
      }

      if (this.modalData?.areso_codigo) {
        formData.append('areso_codigo', String(this.modalData.areso_codigo));
      }

      formData.append('areso_adjunto', file);

      this.solicitudSrv.updateFechaMax(formData).subscribe({
        next: (response) => {
          const numeroSolicitud = response.datos?.numeroSolicitud ?? 'No disponible';
          this.alertsService.showAlert(
            `${response.mensaje} Número de solicitud: ${numeroSolicitud}`,
            'success'
          );
          this.isLoadingSubmint = false;
          this.closeModal();
          if (this.reloadCards) {
            this.reloadCards();
          }
        },
        error: (error: any) => {
          this.alertsService.showAlert(`${error}`, 'error');
          this.isLoadingSubmint = false;
        }
      });
    } catch (err) {
      console.error('Error al generar PDF y registrar solicitud:', err);
      this.alertsService.showAlert('Error al generar el PDF de la solicitud', 'error');
      this.isLoadingSubmint = false;
    }
  }

  protected closeModal(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
    }
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
      this.pdfBlobUrl = null;
    }
    this.safePdfUrl = null;
    this.lastLoadedArereCode = null;
    this.resetForm();
    this.modalFormSrv.closeModal();
    this.isEditMode = false;
    this.formSubmitted = false;
    this.isLoading = false;
    this.solicitudDetalle = null;
    this.clearFileState();
  }

  public resetForm(): void {
    this.isLoadingSubmint = false;
    this.formSolicitud.reset({
      areso_codigo: null,
      areso_tipo_cambio: null,
      areso_descripcion: '',
      justificacion: '',
      areso_adjunto: '',
      areso_archivo: '',
      urlArchivo: '',
      nombreArchivo: '',
      areso_fecha_max_ant: '',
      areso_fecha_max_nue: '',
      areso_memorando: ''
    });
    this.clearFileState();
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      control.markAsDirty();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const field = this.formSolicitud.get(fieldName);
    return !!(field?.invalid && (field.dirty || field.touched || this.formSubmitted));
  }

  private initForm() {
    const rawFechaMaxAnt = this.modalData?.fechaMaximaActual ||
      this.modalData?.areso_fecha_max_ant ||
      this.modalData?.arere_fecha_maxima ||
      this.modalData?.recomendaciones?.arere_fecha_maxima || '';

    const fechaActual = this.pdfGenSrv.normalizeDateToIso(rawFechaMaxAnt);
    const fechaNue = this.pdfGenSrv.normalizeDateToIso(this.modalData?.areso_fecha_max_nue || this.modalData?.fechaCumplimiento || '');
    const today = this.pdfGenSrv.normalizeDateToIso(new Date());

    this.formSolicitud = new FormGroup({
      areso_codigo: new FormControl(this.modalData?.areso_codigo || null),
      areso_tipo_cambio: new FormControl(this.modalData?.areve_codigo || null),
      urlArchivo: new FormControl(this.modalData?.areso_adjunto || ''),
      fecha: new FormControl(today),
      areso_descripcion: new FormControl(''),
      justificacion: new FormControl('', [Validators.required, Validators.minLength(100)]),
      areve_archivo: new FormControl(this.modalData?.areve_archivo || ''),
      nombreArchivo: new FormControl(this.fileUtils.getFileName(this.modalData?.areso_adjunto) || ''),
      areso_fecha_max_ant: new FormControl(fechaActual),
      areso_fecha_max_nue: new FormControl(
        fechaNue,
        [Validators.required, this.fechaMaximaValidator(fechaActual, today)]
      ),
      areso_memorando: new FormControl({ value: this.modalData?.areso_memorando || '', disabled: true }),
      areso_adjunto: new FormControl('')
    });
  }

  private fechaMaximaValidator(fechaMinimaCumplimiento: string, fechaSolicitudStr?: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const fechaCumplimiento = control.value;

      if (!fechaCumplimiento) {
        return null;
      }

      const partesCumplimiento = String(fechaCumplimiento).split('-').map(Number);
      if (partesCumplimiento.length !== 3) {
        return null;
      }

      const fechaCumplimientoDate = new Date(partesCumplimiento[0], partesCumplimiento[1] - 1, partesCumplimiento[2]);
      fechaCumplimientoDate.setHours(0, 0, 0, 0);

      // Fecha base de la solicitud (emisión de la solicitud)
      const baseSolicitudIso = fechaSolicitudStr || this.fechaSolicitud() || this.pdfGenSrv.normalizeDateToIso(new Date());
      let fechaSolicitudDate = new Date();
      fechaSolicitudDate.setHours(0, 0, 0, 0);

      if (baseSolicitudIso) {
        const partesSol = String(baseSolicitudIso).split('-').map(Number);
        if (partesSol.length === 3) {
          fechaSolicitudDate = new Date(partesSol[0], partesSol[1] - 1, partesSol[2]);
          fechaSolicitudDate.setHours(0, 0, 0, 0);
        }
      }

      // La nueva fecha no puede ser anterior a hoy / fecha de solicitud
      if (fechaCumplimientoDate < fechaSolicitudDate) {
        return { fechaInvalida: true };
      }

      // La nueva fecha tampoco puede ser anterior a la fecha actual si fuera futura
      if (fechaMinimaCumplimiento) {
        const partesMinima = String(fechaMinimaCumplimiento).split('-').map(Number);
        if (partesMinima.length === 3) {
          const fechaMinimaDate = new Date(partesMinima[0], partesMinima[1] - 1, partesMinima[2]);
          fechaMinimaDate.setHours(0, 0, 0, 0);
          if (fechaCumplimientoDate < fechaMinimaDate) {
            return { fechaInvalida: true };
          }
        }
      }

      // El límite de dos meses se calcula desde la FECHA DE LA SOLICITUD
      const fechaMaximaPermitida = new Date(fechaSolicitudDate);
      fechaMaximaPermitida.setMonth(fechaMaximaPermitida.getMonth() + 2);

      if (fechaCumplimientoDate > fechaMaximaPermitida) {
        return { ampliacionMaximaExcedida: true };
      }

      return null;
    };
  }

  protected getMinDate(): string {
    const rawFechaMaxAnt = this.modalData?.fechaMaximaActual ||
      this.modalData?.areso_fecha_max_ant ||
      this.modalData?.arere_fecha_maxima || '';
    const fechaMinima = this.pdfGenSrv.normalizeDateToIso(rawFechaMaxAnt);
    const hoy = this.fechaSolicitud() || this.pdfGenSrv.normalizeDateToIso(new Date());
    if (fechaMinima && fechaMinima > hoy) {
      return fechaMinima;
    }
    return hoy;
  }

  protected getMaxDate(): string {
    const fechaSol = this.formSolicitud?.get('fecha')?.value || this.fechaSolicitud() || this.pdfGenSrv.normalizeDateToIso(new Date());
    if (!fechaSol) {
      return '';
    }

    const partes = String(fechaSol).split('-').map(Number);
    if (partes.length !== 3) {
      return '';
    }

    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    fecha.setMonth(fecha.getMonth() + 2);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected getErrorMessage(fieldName: string): string {
    const control = this.formSolicitud.get(fieldName);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (fieldName === 'areso_fecha_max_nue' && control?.hasError('fechaInvalida')) {
      return 'La fecha máxima nueva no puede ser anterior a la fecha de hoy ni a la fecha máxima actual';
    }
    if (fieldName === 'areso_fecha_max_nue' && control?.hasError('ampliacionMaximaExcedida')) {
      return 'Solo puede solicitar una ampliación máxima de dos meses desde la fecha de emisión de la solicitud';
    }
    if (fieldName === 'justificacion' && control?.hasError('minlength')) {
      const actual = control.value ? control.value.trim().length : 0;
      return `Debe ingresar al menos 100 caracteres justificativos (actual: ${actual}/100)`;
    }
    return '';
  }

  private clearFileState(): void {
    this.archivoAdjunto = null;
    this.fileName = '';
    if (this.adjuntoInput?.nativeElement) {
      this.adjuntoInput.nativeElement.value = '';
    }
  }
}
