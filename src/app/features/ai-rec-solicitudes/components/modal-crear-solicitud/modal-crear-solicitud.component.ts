import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { AlertsStateService } from '@core/services/alerts-state.service';
import { User } from '@core/auth/models/authentication';
import { AuxiliaryService } from '@shared/services/auxiliary.service';
import { ModalCrearSolicitudService } from '../../services/modal-crear-solicitud.service';
import { SOLICITUD_PDF_TEMPLATE } from './solicitud-pdf-template';
import { SolicitudesAuditorService } from '../../services/solicitudes.service';

import { VerificablesResponsablesService } from '@features/ai-verificables-respon/services/verificables/verificables-responsables.service';

interface PdfImageData {
    width: number;
    height: number;
    data: Uint8Array;
}

interface PdfTextLine {
    text: string;
    isLastLine: boolean;
    isFirstLine: boolean;
    isEmpty: boolean;
    isBullet: boolean;
}

@Component({
    selector: 'app-modal-crear-solicitud',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './modal-crear-solicitud.component.html',
    styleUrls: ['./modal-crear-solicitud.component.css'],
})
export class ModalCrearSolicitudComponent implements OnInit {
    protected modalSrv: ModalCrearSolicitudService = inject(ModalCrearSolicitudService);
    protected alertsService: AlertsStateService = inject(AlertsStateService);
    protected auxiliarSrv: AuxiliaryService = inject(AuxiliaryService);
    protected solicitudesSrv: SolicitudesAuditorService = inject(SolicitudesAuditorService);
    private readonly verificablesRespSrv: VerificablesResponsablesService = inject(VerificablesResponsablesService);
    protected user: User | null = this.auxiliarSrv.getUserInfo();

    protected formSolicitud!: FormGroup;
    protected isFormSubmitted = false;
    protected isLoading = false;
    protected modalData: any = null;

    // Datos del director obtenidos desde el backend (ahora como signals)
    protected numeroSolicitud = signal<string | number>('Cargando...');
    protected nombreDirector = signal<string>('Cargando...');
    protected departamento = signal<string>('');
    protected correoDirector = signal<string>('');
    protected cargoResponsable = signal<string>('');

    ngOnInit(): void {
        this.initForm();
    }

    private lastLoadedArereCode: number | null = null;

    constructor() {
        effect(() => {
            this.modalData = this.modalSrv.getModalData();
            console.log('📋 Modal abierto con datos:', this.modalData);
            if (this.modalData) {
                const arereCode = this.modalData?.arere_codigo ||
                    this.modalData?.codRec ||
                    this.modalData?.arere_codigo_rec ||
                    this.modalData?.recomendaciones?.arere_codigo ||
                    this.modalData?.recomendacion?.arere_codigo;

                const codeNum = arereCode ? +arereCode : null;

                if (codeNum && (this.lastLoadedArereCode !== codeNum || !this.modalData.memorandoInforme || !this.modalData.tituloInforme)) {
                    this.lastLoadedArereCode = codeNum;

                    // Limpieza inmediata para evitar mostrar datos de otra recomendación
                    this.modalData = {
                        ...this.modalData,
                        tituloInforme: '',
                        memorandoInforme: '',
                        descripcionRecomendacion: ''
                    };

                    this.verificablesRespSrv.getRecomendacionDetalle(codeNum).subscribe({
                        next: (res) => {
                            if (res && res.datos) {
                                this.modalData = {
                                    ...this.modalData,
                                    tituloInforme: res.datos.ainin_titulo || '',
                                    memorandoInforme: res.datos.ainin_memorando || '',
                                    memorandoAprobacion: res.datos.ainin_memo_aprobacion || '',
                                    descripcionRecomendacion: res.datos.recomendaciones?.arere_descripcion ||
                                        res.datos.arere_descripcion || '',
                                    fechaMaximaActual: this.modalData?.fechaMaximaActual ||
                                        res.datos.recomendaciones?.arere_fecha_maxima ||
                                        res.datos.arere_fecha_maxima ||
                                        this.modalData?.areso_fecha_max_ant || ''
                                };
                            }
                            this.initForm();
                            this.cargarDatosDirector();
                        },
                        error: (err) => {
                            console.error('Error al cargar detalle de recomendación en modal:', err);
                            this.initForm();
                            this.cargarDatosDirector();
                        }
                    });
                } else {
                    this.initForm();
                    this.cargarDatosDirector();
                }
            }
        }, { allowSignalWrites: true });
    }

    protected getDefaultDetalleText(): string {
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
            texto += ` ${recomendacion}`;
        }

        if (memorando && memorandoAprobacion && memorando.trim() !== memorandoAprobacion.trim()) {
            texto += `, correspondiente al Informe remitido con memorandos ${memorando} y ${memorandoAprobacion}`;
        } else if (memorando) {
            texto += `, correspondiente al Informe remitido con memorando ${memorando}`;
        } else if (memorandoAprobacion) {
            texto += `, correspondiente al Informe remitido con memorando ${memorandoAprobacion}`;
        }

        texto += ', en virtud de ';
        return texto;
    }

    protected onDetalleInput(event: Event): void {
        const textarea = event.target as HTMLTextAreaElement;
        const prefix = this.getDefaultDetalleText();
        let val = textarea.value;

        if (val.includes(': ... complete')) {
            val = val.replace(': ... complete', '');
        } else if (val.includes('... complete')) {
            val = val.replace('... complete', '');
        }

        if (!val.startsWith(prefix)) {
            const userTyped = val.replace(prefix.trim(), '').trimStart();
            val = prefix + userTyped;
        }

        textarea.value = val;
        this.formSolicitud.get('detalle')?.setValue(val, { emitEvent: true });
    }

    protected getAdditionalMotivoLength(): number {
        const val = this.formSolicitud?.get('detalle')?.value || '';
        const prefix = this.getDefaultDetalleText();
        if (val.startsWith(prefix)) {
            let additional = val.substring(prefix.length);
            additional = additional.replace(': ... complete', '').replace('... complete', '').trim();
            return additional.length;
        }
        return Math.max(0, val.length - prefix.length);
    }

    private motivoMinLengthValidator(minAdditionalChars: number): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const val = control.value || '';
            const prefix = this.getDefaultDetalleText();
            let additionalText = val;
            if (val.startsWith(prefix)) {
                additionalText = val.substring(prefix.length);
            }
            additionalText = additionalText.replace(': ... complete', '').replace('... complete', '').trim();
            const actualLen = additionalText.length;
            if (actualLen < minAdditionalChars) {
                return {
                    motivoIncompleto: true,
                    actual: actualLen,
                    required: minAdditionalChars
                };
            }
            return null;
        };
    }

    private initForm(): void {
        const today = this.toLocalDateString();
        const rawFechaMaxAnt = this.modalData?.fechaMaximaActual ||
            this.modalData?.areso_fecha_max_ant ||
            this.modalData?.arere_fecha_maxima ||
            this.modalData?.recomendaciones?.arere_fecha_maxima || '';
        const fechaMaximaActual = this.normalizeDateToIso(rawFechaMaxAnt);
        const fechaCumplimientoInicial = this.normalizeDateToIso(this.modalData?.fechaCumplimiento || this.modalData?.areso_fecha_max_nue || '');
        const fechaMinimaCumplimiento = fechaMaximaActual || today;
        const prefix = this.getDefaultDetalleText();

        let userTypedExtra = '';
        if (this.modalData?.detalle) {
            const raw = String(this.modalData.detalle);
            let extracted = '';
            if (raw.includes(', en virtud de')) {
                extracted = raw.substring(raw.indexOf(', en virtud de') + ', en virtud de'.length);
            } else if (raw.includes(' debido a que ')) {
                extracted = raw.substring(raw.indexOf(' debido a que ') + ' debido a que '.length);
            }
            extracted = extracted.replace(': ... complete', '').replace('... complete', '').trim();
            if (extracted && !extracted.includes('Por medio del presente') && !extracted.includes('Se requiere solicitud')) {
                userTypedExtra = extracted;
            }
        }

        const detalleInicial = prefix + (userTypedExtra ? userTypedExtra : ': ... complete');

        this.formSolicitud = new FormGroup({
            fecha: new FormControl(today, Validators.required),
            fechaMaximaActual: new FormControl(fechaMaximaActual),
            fechaCumplimiento: new FormControl(fechaCumplimientoInicial, [Validators.required, this.fechaCumplimientoValidator(fechaMinimaCumplimiento, today)]),
            detalle: new FormControl(detalleInicial, [Validators.required, this.motivoMinLengthValidator(100)]),
            numeroMemorado: new FormControl(''),
        });
    }

    private cargarDatosDirector(): void {
        console.log('👤 Usuario completo:', this.user);

        // Resetear signals
        this.numeroSolicitud.set('Cargando...');
        this.nombreDirector.set('Cargando...');
        this.cargoResponsable.set('');
        this.departamento.set('');
        this.correoDirector.set('');

        // Detectar rol del usuario
        const rolesArray = this.user?.roles || [];
        console.log('🔐 Array de roles crudos:', rolesArray);

        // Los roles pueden ser strings "4", "5" o números 4, 5
        const tieneRol4 = rolesArray.some((r: any) =>
            r === "4" || r === 4 || r?.asero_codigo === 4 || r?.codigo === 4
        );
        const tieneRol2 = rolesArray.some((r: any) =>
            r === "2" || r === 2 || r?.asero_codigo === 2 || r?.codigo === 2
        );
        const tieneRol5 = rolesArray.some((r: any) =>
            r === "5" || r === 5 || r?.asero_codigo === 5 || r?.codigo === 5
        );
        const esDirectorEquivalente = tieneRol5 || tieneRol2;

        console.log('📌 ¿Es RESPONSABLE (rol 4)?:', tieneRol4);
        console.log('📌 ¿Es DIRECTOR/EQUIVALENTE (rol 5 o 2)?:', esDirectorEquivalente);

        // Si es DIRECTOR o rol equivalente (AUDITOR_JEFE_INTERNO), tiene prioridad
        if (esDirectorEquivalente) {
            // DIRECTOR/EQUIVALENTE → obtener auditor
            console.log('🎯 Detectado: DIRECTOR/EQUIVALENTE (rol 5 o 2)');
            this.cargarAuditor();
        } else if (tieneRol4) {
            // RESPONSABLE → obtener director
            console.log('🎯 Detectado: RESPONSABLE (rol 4)');
            this.cargarDirector();
        } else {
            console.error('❌ Usuario no tiene rol RESPONSABLE (4) ni DIRECTOR (5)');
            this.numeroSolicitud.set('Error');
            this.nombreDirector.set('Error');
            this.alertsService.showAlert('Tu rol no está configurado correctamente', 'error');
        }
    }

    private cargarDirector(): void {
        const codigoPer = this.user?.codigo_per;
        const departamento = this.user?.departamento;

        console.log('🔍 [RESPONSABLE] codigo_per:', codigoPer);
        console.log('🔍 [RESPONSABLE] departamento:', departamento);

        if (!codigoPer) {
            console.error('❌ No se pudo obtener codigo_per del usuario');
            this.numeroSolicitud.set('Error');
            this.nombreDirector.set('Error');
            this.alertsService.showAlert('No se pudo obtener tu código de persona', 'error');
            return;
        }

        const urlLog = departamento
            ? `/api/solicitudes/obtener-director/${codigoPer}?departamento=${departamento}`
            : `/api/solicitudes/obtener-director/${codigoPer}`;
        console.log('🚀 [RESPONSABLE] Llamando:', urlLog);

        this.solicitudesSrv.obtenerDirectorYNumeroSolicitud(codigoPer, departamento).subscribe({
            next: (response: any) => {
                console.log('✅ Respuesta del servidor:', response);
                if (response?.codigo === 1 && response?.datos) {
                    const datos = response.datos;
                    this.numeroSolicitud.set(datos.numeroSolicitud || 'No disponible');
                    this.nombreDirector.set(datos.nombreDirector || 'No disponible');
                    this.departamento.set(datos.departamento || '');
                    this.correoDirector.set(datos.correoDirector || '');
                    this.cargoResponsable.set(datos.cargoResponsable || '');

                    console.log('✏️ Modal rellenado (DIRECTOR):');
                    console.log('  - numeroSolicitud:', datos.numeroSolicitud);
                    console.log('  - nombreDirector:', datos.nombreDirector);
                    console.log('  - departamento:', datos.departamento);
                    console.log('  - cargoResponsable:', datos.cargoResponsable);
                } else {
                    console.warn('⚠️  Respuesta inesperada:', response);
                    this.numeroSolicitud.set('Error');
                    this.nombreDirector.set('Error');
                }
            },
            error: (error: any) => {
                console.error('❌ Error:', error);
                this.numeroSolicitud.set('Error');
                this.nombreDirector.set('Error');
                this.alertsService.showAlert('Error al cargar director: ' + error, 'error');
            }
        });
    }

    private cargarAuditor(): void {
        const arereCode = this.modalData?.arere_codigo;
        console.log('🔍 [DIRECTOR] arere_codigo (de modalData):', arereCode);
        console.log('📦 [DIRECTOR] modalData completo:', this.modalData);

        if (!arereCode) {
            console.error('❌ No se pudo obtener arere_codigo del modalData');
            this.numeroSolicitud.set('Error');
            this.nombreDirector.set('Error');
            this.alertsService.showAlert('No se pudo obtener el código de la recomendación', 'error');
            return;
        }

        console.log('🚀 [DIRECTOR] Llamando: /api/solicitudes/obtener-auditor/' + arereCode);
        this.solicitudesSrv.obtenerAuditorYNumeroSolicitud(arereCode).subscribe({
            next: (response: any) => {
                console.log('✅ Respuesta del servidor:', response);
                if (response?.codigo === 1 && response?.datos) {
                    const datos = response.datos;
                    this.numeroSolicitud.set(datos.numeroSolicitud || 'No disponible');
                    this.nombreDirector.set(datos.nombreDirector || 'No disponible');
                    this.departamento.set(datos.departamento || '');
                    this.correoDirector.set(datos.correoDirector || '');
                    this.cargoResponsable.set(datos.cargoResponsable || '');

                    console.log('✏️ Modal rellenado (AUDITOR OPERATIVO):');
                    console.log('  - numeroSolicitud:', datos.numeroSolicitud);
                    console.log('  - nombreDirector (auditor):', datos.nombreDirector);
                    console.log('  - departamento:', datos.departamento);
                    console.log('  - cargoResponsable:', datos.cargoResponsable);
                } else {
                    console.warn('⚠️  Respuesta inesperada:', response);
                    this.numeroSolicitud.set('Error');
                    this.nombreDirector.set('Error');
                    this.alertsService.showAlert('Respuesta inesperada del servidor', 'error');
                }
            },
            error: (error: any) => {
                console.error('❌ Error al cargar auditor:', error);
                this.numeroSolicitud.set('Error');
                this.nombreDirector.set('Error');
                this.alertsService.showAlert('Error al cargar auditor: ' + error, 'error');
            }
        });
    }

    protected async enviarSolicitud(): Promise<void> {
        this.isFormSubmitted = true;

        if (this.formSolicitud.invalid) {
            this.alertsService.showAlert('Por favor complete todos los campos requeridos', 'error');
            return;
        }

        this.isLoading = true;

        try {
            const fechaCumplimiento = this.formSolicitud.get('fechaCumplimiento')?.value || '';
            const detalle = this.formSolicitud.get('detalle')?.value || '';
            const pdfFile = await this.generateSolicitudPdf();

            // Abrir automáticamente el PDF generado en una nueva pestaña para inspección del usuario
            const fileURL = URL.createObjectURL(pdfFile);
            window.open(fileURL, '_blank');

            this.modalSrv.setGeneratedSolicitud({
                attachment: pdfFile,
                fechaCumplimiento,
                detalle,
            });
            this.alertsService.showAlert('PDF generado y abierto en una nueva pestaña. Si requiere editar, puede hacer clic en "Generar PDF" nuevamente.', 'success');
            this.isLoading = false;
            this.modalSrv.closeModal();
            this.resetForm();
        } catch (error) {
            console.error(error);
            this.alertsService.showAlert('No se pudo generar el PDF de la solicitud', 'error');
            this.isLoading = false;
        }
    }

    private async generateSolicitudPdf(): Promise<File> {
        const form = this.formSolicitud.value;
        const payload: any = {
            nroSolicitud: this.normalizeText(
                this.numeroSolicitud()?.toString() ||
                this.modalData?.nroSolicitud?.toString() ||
                this.modalData?.areso_codigo?.toString() ||
                ''
            ),
            para: this.normalizeText(this.nombreDirector() || 'Director'),
            fecha: this.normalizeText(this.formatPdfDate(form.fecha)),
            fechaMaximaActual: this.normalizeText(this.formatPdfDate(form.fechaMaximaActual || this.modalData?.fechaMaximaActual || '')),
            fechaCumplimiento: this.normalizeText(this.formatPdfDate(form.fechaCumplimiento)),
            detalle: this.normalizeText(form.detalle || '[DETALLE DE LA SOLICITUD]', true),
            remitente: this.normalizeText(this.user?.nombre_completo || 'Firma del remitente'),
            cargoRemitente: this.normalizeText(this.cargoResponsable() || ''),
            departamento: this.normalizeText(this.departamento() || this.user?.departamento || ''),
        };

        const logo = await this.loadLogoImageData(SOLICITUD_PDF_TEMPLATE.logoUrl);
        const pdfBytes = this.buildPdfBytes(payload, logo);
        const fileName = 'solicitud-de-ampliación-de-plazo.pdf';
        const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
        return new File([pdfBuffer], fileName, { type: 'application/pdf' });
    }

    private buildPdfBytes(
        payload: {
            nroSolicitud: string;
            para: string;
            fecha: string;
            fechaMaximaActual?: string;
            fechaCumplimiento: string;
            detalle: string;
            remitente: string;
            cargoRemitente: string;
            departamento: string;
        },
        logo: PdfImageData
    ): Uint8Array {

        const PAGE_W = 595.28;
        const PAGE_H = 841.89;
        const MARGIN = 42;
        const BODY_W = PAGE_W - MARGIN * 2;

        // ============================================================
        // NUEVO CODIFICADOR LATIN-1 (SOPORTA TILDES Y EÑES PARA PDF)
        // ============================================================
        const stringToLatin1 = (s: string): Uint8Array => {
            const arr = new Uint8Array(s.length);
            for (let i = 0; i < s.length; i++) {
                let code = s.charCodeAt(i);
                // Mapeo básico para caracteres especiales de Word (comillas tipográficas, guiones)
                if (code === 8220 || code === 8221) code = 34; // "
                else if (code === 8216 || code === 8217) code = 39; // '
                else if (code === 8211 || code === 8212) code = 45; // -
                // Si el caracter no es soportado, pone '?'
                arr[i] = code > 255 ? 63 : code;
            }
            return arr;
        };

        const chunks: Uint8Array[] = [];
        const offsets: number[] = [];
        let totalLen = 0;

        const addChunk = (c: Uint8Array) => { chunks.push(c); totalLen += c.length; };
        const addStr = (s: string) => addChunk(stringToLatin1(s)); // Reemplazado TextEncoder

        addStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

        const esc = (v: string) =>
            v.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

        // ============================================================
        // MÉTRICAS EXACTAS HELVETICA PARA JUSTIFICACIÓN PERFECTA
        // ============================================================
        const H_METRICS: Record<string, number> = {
            ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
            '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
            ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
            'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667, 'Y': 667, 'Z': 611,
            '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 333,
            'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500, 'y': 500, 'z': 500,
            '{': 334, '|': 260, '}': 334, '~': 584,
            // Caracteres latinos extendidos (tildes, eñe)
            'Á': 667, 'É': 667, 'Í': 278, 'Ó': 778, 'Ú': 722, 'Ñ': 722,
            'á': 556, 'é': 556, 'í': 222, 'ó': 556, 'ú': 556, 'ñ': 556,
            'ü': 556, 'Ü': 722
        };

        const charW = (ch: string, size: number): number => {
            return size * ((H_METRICS[ch] || 556) / 1000);
        };

        const textW = (text: string, size: number): number =>
            [...text].reduce((acc, ch) => acc + charW(ch, size), 0);

        const textAt = (text: string, x: number, y: number, size: number, bold = false): string =>
            `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(text)}) Tj ET`;

        const centeredIn = (text: string, boxX: number, boxW: number, y: number, size: number, bold = false): string => {
            const x = boxX + Math.max(4, (boxW - textW(text, size)) / 2);
            return textAt(text, x, y, size, bold);
        };

        // NUEVA FUNCIÓN: Auto-ajusta el tamaño de letra si el texto es muy largo
        const centeredFitIn = (text: string, boxX: number, boxW: number, y: number, defaultSize: number, bold = false): string => {
            let size = defaultSize;
            const maxW = boxW - 16; // Dejamos 8 puntos de margen a cada lado para que no choque con los bordes

            // Si el texto es más ancho que el espacio, reducimos la letra 0.25 puntos a la vez (hasta un mínimo de 4)
            while (textW(text, size) > maxW && size > 4) {
                size -= 0.25;
            }

            const x = boxX + (boxW - textW(text, size)) / 2;
            return textAt(text, x, y, size, bold);
        };

        const hline = (x1: number, y: number, x2: number, lw = 0.45): string =>
            `${lw} w ${x1} ${y} m ${x2} ${y} l S`;

        const vline = (x: number, y1: number, y2: number, lw = 0.45): string =>
            `${lw} w ${x} ${y1} m ${x} ${y2} l S`;

        const boxRect = (x: number, y: number, w: number, h: number, lw = 0.45): string =>
            `${lw} w ${x} ${y} ${w} ${h} re S`;

        const fillRect = (x: number, y: number, w: number, h: number, gray = 0.97): string =>
            `${gray} g ${x} ${y} ${w} ${h} re f 0 g`;

        // ============================================================
        // WRAP DE TEXTO
        // ============================================================
        const wrapText = (text: string, maxW: number, size: number): PdfTextLine[] => {
            const lines: PdfTextLine[] = [];
            const paragraphs = text.split('\n').map(p => p.trim());

            for (let p = 0; p < paragraphs.length; p++) {
                const para = paragraphs[p];
                if (!para) {
                    lines.push({ text: '', isLastLine: true, isFirstLine: false, isEmpty: true, isBullet: false });
                    continue;
                }

                const isBullet = /^(?:[-*•]|\d+\.)/.test(para);
                const words = para.split(/\s+/).filter(Boolean);

                let cur = '';
                let isFirstLine = true;

                const pIndent = 0;
                const bIndent = isBullet ? size * 1.5 : 0;

                for (let i = 0; i < words.length; i++) {
                    const word = words[i];
                    const currentIndent = isFirstLine ? pIndent : bIndent;
                    const currentMaxW = maxW - currentIndent;

                    const candidate = cur ? `${cur} ${word}` : word;

                    if (textW(candidate, size) <= currentMaxW) {
                        cur = candidate;
                    } else {
                        if (cur) {
                            lines.push({ text: cur, isLastLine: false, isFirstLine, isEmpty: false, isBullet });
                            isFirstLine = false;
                        }
                        cur = word;
                    }
                }
                if (cur) {
                    lines.push({ text: cur, isLastLine: true, isFirstLine, isEmpty: false, isBullet });
                }

                if (p < paragraphs.length - 1 && paragraphs[p + 1] !== undefined) {
                    lines.push({ text: '', isLastLine: true, isFirstLine: false, isEmpty: true, isBullet: false });
                }
            }
            return lines;
        };

        // ============================================================
        // LÓGICA DE JUSTIFICACIÓN PERFECTA (OPERADOR TJ)
        // ============================================================
        const justifyText = (
            line: PdfTextLine,
            x: number,
            y: number,
            width: number,
            size: number
        ): string => {
            if (line.isEmpty) return '';

            let indent = 0;
            if (!line.isFirstLine && line.isBullet) indent = size * 1.5;

            const startX = x + indent;
            const lineMaxW = width - indent;
            const words = line.text.trim().split(/\s+/);

            if (words.length <= 1 || line.isLastLine) {
                return `BT /F1 ${size} Tf ${startX.toFixed(2)} ${y.toFixed(2)} Td (${esc(line.text)}) Tj ET`;
            }

            const wordsWidth = words.reduce((acc, w) => acc + textW(w, size), 0);
            const gaps = words.length - 1;
            const spaceW = charW(' ', size);

            const naturalWidth = wordsWidth + (gaps * spaceW);
            const extraSpace = lineMaxW - naturalWidth;

            const gapExtraPts = Math.max(0, extraSpace / gaps);
            const offsetTJ = -((gapExtraPts / size) * 1000);

            const tjElements = words.map((w, i) => {
                if (i === words.length - 1) {
                    return `(${esc(w)})`;
                }
                return `(${esc(w)} ) ${offsetTJ.toFixed(2)}`;
            });

            return `BT /F1 ${size} Tf ${startX.toFixed(2)} ${y.toFixed(2)} Td [ ${tjElements.join(' ')} ] TJ ET`;
        };

        // ============================================================
        // SEPARADOR DINÁMICO DE TÍTULO PARA EVITAR SUPERPOSICIÓN
        // ============================================================
        const splitTitle = (text: string, maxWidth: number, fontSize: number): string[] => {
            const words = text.split(' ');
            const lines: string[] = [];
            let currentLine = '';
            words.forEach(w => {
                const testLine = currentLine ? `${currentLine} ${w}` : w;
                if (textW(testLine, fontSize) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = w;
                }
            });
            if (currentLine) lines.push(currentLine);
            return lines;
        };


        // ============================================================
        // DIMENSIONES FIJAS Y DISTRIBUCIÓN
        // ============================================================

        const HDR_TOP_Y = PAGE_H - MARGIN;
        const HDR_H = 114;
        const HDR_BOT_Y = HDR_TOP_Y - HDR_H;
        const LOGO_SIZE = 64;
        const LOGO_X = MARGIN + 4;
        const LOGO_Y = HDR_BOT_Y + (HDR_H - LOGO_SIZE) / 2;
        const RIGHT_BOX_W = 175;
        const RIGHT_BOX_X = PAGE_W - MARGIN - RIGHT_BOX_W;

        const TITLE_LEFT = LOGO_X + LOGO_SIZE + 15;
        const TITLE_W = RIGHT_BOX_X - TITLE_LEFT - 10;

        // CORRECCIÓN: Se mantiene el texto original sin remover tildes
        const rawTitle = (SOLICITUD_PDF_TEMPLATE.documentTitle as string)
            .replace(/\s+/g, ' ').trim().toUpperCase();

        let titleSize = 11.5;
        let titleLines = splitTitle(rawTitle, TITLE_W, titleSize);

        if (titleLines.length > 2) {
            titleSize = 10;
            titleLines = splitTitle(rawTitle, TITLE_W, titleSize);
        }
        if (titleLines.length > 3) {
            titleSize = 9;
            titleLines = splitTitle(rawTitle, TITLE_W, titleSize);
        }

        const titleLineHeight = titleSize + 4;
        const totalTitleHeight = titleLines.length * titleLineHeight;
        const titleStartY = HDR_BOT_Y + (HDR_H / 2) + (totalTitleHeight / 2) - titleSize;

        const ROW_H = 24;
        const DE_Y = HDR_BOT_Y - 20;
        const PARA_Y = DE_Y - ROW_H;
        const ZONE_B_BOT_Y = PARA_Y - 14;

        const FOOTER_H = 160;
        const FOOTER_Y = 45;
        const COL_L_W = 245;
        const COL_R_W = BODY_W - COL_L_W;
        const COL_R_X = MARGIN + COL_L_W;

        const DETAIL_LABEL_H = 24;
        const DETAIL_PADDING_X = 75; // Texto súper centrado
        const DETAIL_INNER_W = BODY_W - DETAIL_PADDING_X * 2;
        const FOOTER_TOP_Y_P1 = FOOTER_Y + FOOTER_H;
        const DETAIL_BOX_MIN_H = 80;

        let detailFontSize = 9.0;
        let detailLineH = 12.5;
        let wrappedLines = wrapText(payload.detalle, DETAIL_INNER_W, detailFontSize);

        const MAX_LINES_P1 = (sizes: [number, number]) => {
            const avail = ZONE_B_BOT_Y - FOOTER_TOP_Y_P1 - DETAIL_LABEL_H - 40;
            return Math.max(4, Math.floor(avail / sizes[1]));
        };

        if (wrappedLines.length > MAX_LINES_P1([detailFontSize, detailLineH])) {
            detailFontSize = 8.5; detailLineH = 11.8;
            wrappedLines = wrapText(payload.detalle, DETAIL_INNER_W, detailFontSize);
        }

        const linesPerPage1 = MAX_LINES_P1([detailFontSize, detailLineH]);
        const CONT_TOP_Y = PAGE_H - MARGIN - 30;
        const CONT_BOT_Y = FOOTER_Y + FOOTER_H + 10;
        const linesPerCont = Math.max(4, Math.floor((CONT_TOP_Y - CONT_BOT_Y - DETAIL_LABEL_H) / detailLineH));

        const pageLines: PdfTextLine[][] = [];
        let remaining = [...wrappedLines];

        const chunk1 = remaining.splice(0, linesPerPage1);
        pageLines.push(chunk1);

        while (remaining.length > 0) {
            pageLines.push(remaining.splice(0, linesPerCont));
        }

        const totalPages = pageLines.length;

        const buildPageStream = (pageIndex: number): string => {
            const isFirst = pageIndex === 0;
            const isLast = pageIndex === totalPages - 1;
            const lines = pageLines[pageIndex];
            const cmds: string[] = [];

            if (isFirst) {
                cmds.push(
                    // Fondos sutiles de celdas en el cuadro derecho
                    fillRect(RIGHT_BOX_X, HDR_TOP_Y - 27, RIGHT_BOX_W, 27, 0.93),
                    fillRect(RIGHT_BOX_X, HDR_TOP_Y - 114, RIGHT_BOX_W, 29, 0.97),

                    // 1. CIERRE DEL MARCO EN EL ENCABEZADO Y SECCIÓN DE/PARA
                    // Usamos un boxRect que engloba desde arriba hasta donde inicia el DETALLE
                    boxRect(MARGIN, ZONE_B_BOT_Y, BODY_W, HDR_TOP_Y - ZONE_B_BOT_Y),
                    hline(MARGIN, HDR_BOT_Y, PAGE_W - MARGIN), // Línea separadora principal del encabezado
                    vline(RIGHT_BOX_X, HDR_BOT_Y, HDR_TOP_Y), // Línea vertical del cuadro derecho

                    // Líneas divisorias horizontales entre celdas del cuadro derecho
                    hline(RIGHT_BOX_X, HDR_TOP_Y - 27, PAGE_W - MARGIN, 0.35),
                    hline(RIGHT_BOX_X, HDR_TOP_Y - 56, PAGE_W - MARGIN, 0.35),
                    hline(RIGHT_BOX_X, HDR_TOP_Y - 85, PAGE_W - MARGIN, 0.35),

                    `q ${LOGO_SIZE} 0 0 ${LOGO_SIZE} ${LOGO_X} ${LOGO_Y} cm /Im0 Do Q`,

                    ...titleLines.map((tLine, idx) => centeredIn(tLine, TITLE_LEFT, TITLE_W, titleStartY - (idx * titleLineHeight), titleSize, true)),

                    // Celda 1: No. Solicitud
                    textAt('No. SOLICITUD:', RIGHT_BOX_X + 10, HDR_TOP_Y - 11, 7, true),
                    textAt(payload.nroSolicitud || '---', RIGHT_BOX_X + 10, HDR_TOP_Y - 21.5, 9.5, true),

                    // Celda 2: Fecha de Solicitud
                    textAt('FECHA DE SOLICITUD:', RIGHT_BOX_X + 10, HDR_TOP_Y - 38, 7, true),
                    textAt(payload.fecha, RIGHT_BOX_X + 10, HDR_TOP_Y - 49, 8.5),

                    // Celda 3: Fecha Máxima Actual
                    textAt('FECHA MÁXIMA ACTUAL:', RIGHT_BOX_X + 10, HDR_TOP_Y - 67, 7, true),
                    textAt(payload.fechaMaximaActual || '---', RIGHT_BOX_X + 10, HDR_TOP_Y - 78, 8.5),

                    // Celda 4: Fecha Máxima Nueva
                    textAt('FECHA MÁXIMA NUEVA:', RIGHT_BOX_X + 10, HDR_TOP_Y - 96, 7, true),
                    textAt(payload.fechaCumplimiento, RIGHT_BOX_X + 10, HDR_TOP_Y - 107, 8.5, true),

                    textAt(`DE: ${payload.remitente}`, MARGIN + 10, DE_Y, 10, true),
                    hline(MARGIN, DE_Y - 11, PAGE_W - MARGIN, 0.3),
                    textAt(`PARA: ${payload.para}`, MARGIN + 10, PARA_Y, 10, true)
                );
            }

            const boxTopY = isFirst ? ZONE_B_BOT_Y : CONT_TOP_Y;
            const boxBotTarget = isLast ? FOOTER_Y + FOOTER_H + 8 : MARGIN;
            const detailBoxH = Math.max(DETAIL_BOX_MIN_H, boxTopY - boxBotTarget);
            const detailBoxY = boxTopY - detailBoxH;
            const detailDivY = boxTopY - DETAIL_LABEL_H;
            const detailLabelY = boxTopY - 16;

            // Para que mantenga las tildes del título
            const detailLabel = isFirst ? 'DETALLE' : `DETALLE (continuación ${pageIndex + 1}/${totalPages})`;

            cmds.push(
                boxRect(MARGIN, detailBoxY, BODY_W, detailBoxH),
                fillRect(MARGIN, detailDivY, BODY_W, DETAIL_LABEL_H, 0.93),
                textAt(detailLabel, MARGIN + 12, detailLabelY, 10, true),
                hline(MARGIN, detailDivY, MARGIN + BODY_W, 0.3),
            );

            const detailTextStartY = detailDivY - detailLineH - 30;

            lines.forEach((ln, i) => {
                const yPos = detailTextStartY - i * detailLineH;
                cmds.push(
                    justifyText(
                        ln,
                        MARGIN + DETAIL_PADDING_X,
                        yPos,
                        DETAIL_INNER_W,
                        detailFontSize
                    )
                );
            });

            if (isLast) {
                const solicitadoPorY = FOOTER_Y + FOOTER_H - 20; // Título en la barra gris

                const footerNameY = FOOTER_Y + 85;
                const footerCargoY = FOOTER_Y + 68;
                const footerDeptY = FOOTER_Y + 51;

                cmds.push(
                    // Caja izquierda (Solicitado Por)
                    boxRect(MARGIN, FOOTER_Y, COL_L_W, FOOTER_H),
                    fillRect(MARGIN, FOOTER_Y + FOOTER_H - 28, COL_L_W, 28, 0.97),
                    centeredIn('SOLICITADO POR:', MARGIN, COL_L_W, solicitadoPorY, 9, true),

                    // CAMBIO: Usamos centeredFitIn para el nombre, cargo y departamento
                    centeredFitIn(payload.remitente, MARGIN, COL_L_W, footerNameY, 9, true),
                    ...(payload.cargoRemitente ? [centeredFitIn(`CARGO: ${payload.cargoRemitente}`, MARGIN, COL_L_W, footerCargoY, 8)] : []),
                    ...(payload.departamento ? [centeredFitIn(payload.departamento, MARGIN, COL_L_W, footerDeptY, 8)] : []),

                    // Caja derecha (Aprobado Por)
                    boxRect(COL_R_X, FOOTER_Y, COL_R_W, FOOTER_H),
                    fillRect(COL_R_X, FOOTER_Y + FOOTER_H - 28, COL_R_W, 28, 0.97),
                    centeredIn('APROBADO POR:', COL_R_X, COL_R_W, solicitadoPorY, 9, true)
                );
            }

            if (totalPages > 1) {
                const pageNumText = `Página ${pageIndex + 1} de ${totalPages}`;
                const pageNumX = PAGE_W - MARGIN - textW(pageNumText, 7.5);
                cmds.push(textAt(pageNumText, pageNumX, MARGIN - 12, 7.5));
            }

            return cmds.filter(Boolean).join('\n');
        };

        const addObject = (body: string): void => {
            offsets.push(totalLen);
            addStr(`${offsets.length} 0 obj\n${body}\nendobj\n`);
        };

        const addStreamObject = (dict: string, data: Uint8Array): void => {
            offsets.push(totalLen);
            addStr(`${offsets.length} 0 obj\n${dict}\nstream\n`);
            addChunk(data);
            addStr('\nendstream\nendobj\n');
        };

        addObject('<< /Type /Catalog /Pages 2 0 R >>');

        const pageObjStart = 3;
        const pageKids = Array.from({ length: totalPages }, (_, i) => `${pageObjStart + i} 0 R`).join(' ');
        addObject(`<< /Type /Pages /Kids [${pageKids}] /Count ${totalPages} >>`);

        const contentObjStart = pageObjStart + totalPages;
        for (let i = 0; i < totalPages; i++) {
            const contentRef = contentObjStart + i;
            addObject(`<<
            /Type /Page
            /Parent 2 0 R
            /MediaBox [0 0 ${PAGE_W} ${PAGE_H}]
            /Resources <<
                /Font << /F1 ${contentObjStart + totalPages} 0 R /F2 ${contentObjStart + totalPages + 1} 0 R >>
                /XObject << /Im0 ${contentObjStart + totalPages + 2} 0 R >>
            >>
            /Contents ${contentRef} 0 R
        >>`);
        }

        for (let i = 0; i < totalPages; i++) {
            const streamStr = buildPageStream(i);
            const streamBytes = stringToLatin1(streamStr); // Se usa Latin-1 también para el contenido del Stream
            addStreamObject(`<< /Length ${streamBytes.length} >>`, streamBytes);
        }

        // CORRECCIÓN: Se agrega /Encoding /WinAnsiEncoding explícitamente a las fuentes
        addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

        addStreamObject(
            `<<
            /Type /XObject
            /Subtype /Image
            /Width ${logo.width}
            /Height ${logo.height}
            /ColorSpace /DeviceRGB
            /BitsPerComponent 8
            /Length ${logo.data.length}
        >>`,
            logo.data
        );

        const xrefOffset = totalLen;
        addStr(`xref\n0 ${offsets.length + 1}\n`);
        addStr('0000000000 65535 f \n');
        offsets.forEach(o => addStr(`${o.toString().padStart(10, '0')} 00000 n \n`));
        addStr(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

        const total = new Uint8Array(totalLen);
        let cursor = 0;
        chunks.forEach(c => { total.set(c, cursor); cursor += c.length; });
        return total;
    }

    private async loadLogoImageData(url: string): Promise<PdfImageData> {
        const image = new Image();
        image.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`No se pudo cargar el logo: ${url}`));
            image.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;

        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('No se pudo preparar el canvas para el logo');
        }

        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const rgbData = new Uint8Array(canvas.width * canvas.height * 3);

        for (let sourceIndex = 0, targetIndex = 0; sourceIndex < imageData.length; sourceIndex += 4, targetIndex += 3) {
            rgbData[targetIndex] = imageData[sourceIndex];
            rgbData[targetIndex + 1] = imageData[sourceIndex + 1];
            rgbData[targetIndex + 2] = imageData[sourceIndex + 2];
        }

        return {
            width: canvas.width,
            height: canvas.height,
            data: rgbData,
        };
    }

    // CORRECCIÓN FINAL: Ya no elimina acentos con .normalize('NFD') ni con Regex
    private normalizeText(value: string, preserveLines = false): string {
        if (preserveLines) {
            return value
                .split('\n')
                .map(line => line.replace(/\s+/g, ' ').trim())
                .join('\n')
                .trim();
        }
        return value.replace(/\s+/g, ' ').trim();
    }

    protected normalizeDateToIso(dateVal: any): string {
        if (!dateVal) return '';
        const str = String(dateVal).trim();
        const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (matchIso) {
            return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
        }
        const matchSlash = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchSlash) {
            return `${matchSlash[3]}-${matchSlash[2]}-${matchSlash[1]}`;
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return this.toLocalDateString(d);
        }
        return str;
    }

    private formatPdfDate(value: string): string {
        if (!value) {
            return value;
        }

        const iso = this.normalizeDateToIso(value);
        if (!iso) {
            return value;
        }

        const parts = iso.split('-');
        if (parts.length !== 3) {
            return value;
        }

        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        const date = new Date(year, month - 1, day);

        return date.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    protected closeModal(): void {
        this.lastLoadedArereCode = null;
        this.modalData = null;
        this.modalSrv.closeModal();
        this.resetForm();
    }

    private resetForm(): void {
        this.formSolicitud.reset();
        this.isFormSubmitted = false;
    }

    protected isFieldInvalid(fieldName: string): boolean {
        const field = this.formSolicitud.get(fieldName);
        return !!(field && field.invalid && (field.dirty || field.touched || this.isFormSubmitted));
    }

    protected getErrorMessage(fieldName: string): string {
        const control = this.formSolicitud.get(fieldName);
        if (control?.hasError('required')) {
            return 'Este campo es requerido';
        }
        if (fieldName === 'fechaCumplimiento' && control?.hasError('fechaInvalida')) {
            return 'La fecha máxima nueva no puede ser anterior a la fecha de hoy ni a la fecha máxima actual';
        }
        if (fieldName === 'fechaCumplimiento' && control?.hasError('ampliacionMaximaExcedida')) {
            return 'Solo puede pedir una ampliación máxima de dos meses desde la fecha de emisión de la solicitud';
        }
        if (fieldName === 'detalle') {
            if (control?.hasError('required')) {
                return 'Este campo es requerido';
            }
            if (control?.hasError('motivoIncompleto')) {
                const actual = control.getError('motivoIncompleto')?.actual || 0;
                return `Debe ingresar al menos 100 caracteres adicionales explicando el motivo (ingresados: ${actual}/100).`;
            }
        }
        return '';
    }

    protected getTodayDate(): string {
        return this.toLocalDateString();
    }

    protected getMinFechaCumplimiento(): string {
        const rawFechaMaxAnt = this.modalData?.fechaMaximaActual ||
            this.modalData?.areso_fecha_max_ant ||
            this.modalData?.arere_fecha_maxima ||
            this.modalData?.recomendaciones?.arere_fecha_maxima || '';
        const fechaMinima = this.normalizeDateToIso(rawFechaMaxAnt);
        const hoy = this.getTodayDate();
        if (fechaMinima && fechaMinima > hoy) {
            return fechaMinima;
        }
        return hoy;
    }

    protected getMaxFechaCumplimiento(): string {
        const fechaSol = this.formSolicitud?.get('fecha')?.value || this.getTodayDate();
        if (!fechaSol) {
            return '';
        }

        const partes = String(fechaSol).split('-').map(Number);
        if (partes.length !== 3) {
            return '';
        }

        const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
        fecha.setMonth(fecha.getMonth() + 2);
        return this.toLocalDateString(fecha);
    }

    private toLocalDateString(date: Date = new Date()): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private fechaCumplimientoValidator(fechaMinimaCumplimiento: string, fechaSolicitudStr?: string): ValidatorFn {
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

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            // No permitir fechas en el pasado
            if (fechaCumplimientoDate < hoy) {
                return { fechaInvalida: true };
            }

            // No permitir fechas menores a la fecha actual si fuera futura
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

            // Límite de dos meses desde la fecha de solicitud
            const refFechaSol = fechaSolicitudStr || this.toLocalDateString(hoy);
            const partesSol = String(refFechaSol).split('-').map(Number);
            const fechaMaximaPermitida = new Date(partesSol[0], partesSol[1] - 1, partesSol[2]);
            fechaMaximaPermitida.setHours(0, 0, 0, 0);
            fechaMaximaPermitida.setMonth(fechaMaximaPermitida.getMonth() + 2);

            if (fechaCumplimientoDate > fechaMaximaPermitida) {
                return { ampliacionMaximaExcedida: true };
            }

            return null;
        };
    }
}