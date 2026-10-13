import { Injectable } from '@angular/core';
import { SOLICITUD_PDF_TEMPLATE } from '../components/modal-crear-solicitud/solicitud-pdf-template';

export interface SolicitudPdfPayload {
  nroSolicitud: string;
  para: string;
  fecha: string;
  fechaMaximaActual?: string;
  fechaCumplimiento: string;
  detalle: string;
  remitente: string;
  cargoRemitente: string;
  departamento: string;
}

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

@Injectable({
  providedIn: 'root'
})
export class SolicitudPdfGeneratorService {
  private cachedLogo: PdfImageData | null = null;
  private logoLoadingPromise: Promise<PdfImageData> | null = null;

  public async generatePdf(payload: SolicitudPdfPayload): Promise<{ file: File; blob: Blob; blobUrl: string }> {
    const normalizedPayload = {
      nroSolicitud: this.normalizeText(payload.nroSolicitud || ''),
      para: this.normalizeText(payload.para || 'Director'),
      fecha: this.normalizeText(this.formatPdfDate(payload.fecha)),
      fechaMaximaActual: this.normalizeText(this.formatPdfDate(payload.fechaMaximaActual || '')),
      fechaCumplimiento: this.normalizeText(this.formatPdfDate(payload.fechaCumplimiento)),
      detalle: this.normalizeText(payload.detalle || '[DETALLE DE LA SOLICITUD]', true),
      remitente: this.normalizeText(payload.remitente || 'Firma del remitente'),
      cargoRemitente: this.normalizeText(payload.cargoRemitente || ''),
      departamento: this.normalizeText(payload.departamento || ''),
    };

    const logo = await this.getLogoImageData(SOLICITUD_PDF_TEMPLATE.logoUrl);
    const pdfBytes = this.buildPdfBytes(normalizedPayload, logo);
    const fileName = 'solicitud-de-ampliación-de-plazo.pdf';
    const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const file = new File([pdfBuffer], fileName, { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    return { file, blob, blobUrl };
  }

  private async getLogoImageData(url: string): Promise<PdfImageData> {
    if (this.cachedLogo) {
      return this.cachedLogo;
    }
    if (this.logoLoadingPromise) {
      return this.logoLoadingPromise;
    }

    this.logoLoadingPromise = this.loadLogoImageData(url).then(logo => {
      this.cachedLogo = logo;
      return logo;
    });

    return this.logoLoadingPromise;
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

  public normalizeText(value: string, preserveLines = false): string {
    if (!value) return '';
    if (preserveLines) {
      return value
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .join('\n')
        .trim();
    }
    return value.replace(/\s+/g, ' ').trim();
  }

  public normalizeDateToIso(dateVal: any): string {
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
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return str;
  }

  public formatPdfDate(value: string): string {
    if (!value) return '';
    const iso = this.normalizeDateToIso(value);
    if (!iso) return value;

    const parts = iso.split('-');
    if (parts.length !== 3) return value;

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

    const stringToLatin1 = (s: string): Uint8Array => {
      const arr = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) {
        let code = s.charCodeAt(i);
        if (code === 8220 || code === 8221) code = 34; // "
        else if (code === 8216 || code === 8217) code = 39; // '
        else if (code === 8211 || code === 8212) code = 45; // -
        arr[i] = code > 255 ? 63 : code;
      }
      return arr;
    };

    const chunks: Uint8Array[] = [];
    const offsets: number[] = [];
    let totalLen = 0;

    const addChunk = (c: Uint8Array) => { chunks.push(c); totalLen += c.length; };
    const addStr = (s: string) => addChunk(stringToLatin1(s));

    addStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    const esc = (v: string) =>
      v.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    const H_METRICS: Record<string, number> = {
      ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
      '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
      ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
      'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667, 'Y': 667, 'Z': 611,
      '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 333,
      'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500, 'y': 500, 'z': 500,
      '{': 334, '|': 260, '}': 334, '~': 584,
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

    const centeredFitIn = (text: string, boxX: number, boxW: number, y: number, defaultSize: number, bold = false): string => {
      let size = defaultSize;
      const maxW = boxW - 16;
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
    const DETAIL_PADDING_X = 75;
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
          fillRect(RIGHT_BOX_X, HDR_TOP_Y - 27, RIGHT_BOX_W, 27, 0.93),
          fillRect(RIGHT_BOX_X, HDR_TOP_Y - 114, RIGHT_BOX_W, 29, 0.97),

          boxRect(MARGIN, ZONE_B_BOT_Y, BODY_W, HDR_TOP_Y - ZONE_B_BOT_Y),
          hline(MARGIN, HDR_BOT_Y, PAGE_W - MARGIN),
          vline(RIGHT_BOX_X, HDR_BOT_Y, HDR_TOP_Y),

          hline(RIGHT_BOX_X, HDR_TOP_Y - 27, PAGE_W - MARGIN, 0.35),
          hline(RIGHT_BOX_X, HDR_TOP_Y - 56, PAGE_W - MARGIN, 0.35),
          hline(RIGHT_BOX_X, HDR_TOP_Y - 85, PAGE_W - MARGIN, 0.35),

          `q ${LOGO_SIZE} 0 0 ${LOGO_SIZE} ${LOGO_X} ${LOGO_Y} cm /Im0 Do Q`,

          ...titleLines.map((tLine, idx) => centeredIn(tLine, TITLE_LEFT, TITLE_W, titleStartY - (idx * titleLineHeight), titleSize, true)),

          textAt('No. SOLICITUD:', RIGHT_BOX_X + 10, HDR_TOP_Y - 11, 7, true),
          textAt(payload.nroSolicitud || '---', RIGHT_BOX_X + 10, HDR_TOP_Y - 21.5, 9.5, true),

          textAt('FECHA DE SOLICITUD:', RIGHT_BOX_X + 10, HDR_TOP_Y - 38, 7, true),
          textAt(payload.fecha, RIGHT_BOX_X + 10, HDR_TOP_Y - 49, 8.5),

          textAt('FECHA MÁXIMA ACTUAL:', RIGHT_BOX_X + 10, HDR_TOP_Y - 67, 7, true),
          textAt(payload.fechaMaximaActual || '---', RIGHT_BOX_X + 10, HDR_TOP_Y - 78, 8.5),

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
        const solicitadoPorY = FOOTER_Y + FOOTER_H - 20;

        const footerNameY = FOOTER_Y + 85;
        const footerCargoY = FOOTER_Y + 68;
        const footerDeptY = FOOTER_Y + 51;

        cmds.push(
          boxRect(MARGIN, FOOTER_Y, COL_L_W, FOOTER_H),
          fillRect(MARGIN, FOOTER_Y + FOOTER_H - 28, COL_L_W, 28, 0.97),
          centeredIn('SOLICITADO POR:', MARGIN, COL_L_W, solicitadoPorY, 9, true),

          centeredFitIn(payload.remitente, MARGIN, COL_L_W, footerNameY, 9, true),
          ...(payload.cargoRemitente ? [centeredFitIn(`CARGO: ${payload.cargoRemitente}`, MARGIN, COL_L_W, footerCargoY, 8)] : []),
          ...(payload.departamento ? [centeredFitIn(payload.departamento, MARGIN, COL_L_W, footerDeptY, 8)] : []),

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
      const streamBytes = stringToLatin1(streamStr);
      addStreamObject(`<< /Length ${streamBytes.length} >>`, streamBytes);
    }

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
}
