import type { LabelConfig, LabelData } from '../types';
import { code128Modules } from './code128';
import { clamp, mmToDots } from './units';

export function renderCode(template: string, d: LabelData): string {
  return template
    .replaceAll('{regal}', d.rack)
    .replaceAll('{kolumna}', d.column)
    .replaceAll('{polka}', d.shelf);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometria wszystkich elementów etykiety w milimetrach — jedyne źródło
 *  prawdy dla podglądu SVG, druku z przeglądarki i generatora ZPL. */
export interface LabelLayout {
  inset: number; // wewnętrzny margines tekstu w wierszach KOLUMNA/Półka
  dividers: Box[]; // czarne linie oddzielające sekcje
  rack: Box & { fontMm: number };
  columnBar: Box & { labelFontMm: number; valueFontMm: number };
  shelfRow: Box & { labelFontMm: number; valueFontMm: number };
  barcode: Box & { moduleDots: number; code: string };
  barcodeText: Box & { fontMm: number; text: string };
}

export function computeLayout(cfg: LabelConfig, data: LabelData): LabelLayout {
  const W = cfg.widthMm;
  const H = cfg.heightMm;
  const pad = clamp(W * 0.03, 1.2, 4);
  const inset = clamp(W * 0.012, 0.8, 2);
  const innerW = W - 2 * pad;

  const textFont = clamp(H * 0.062, 2, 4.5);
  const textH = cfg.showBarcodeText ? textFont * 1.3 : 0;
  const bcH = cfg.showBarcode ? clamp(cfg.barcodeHeightMm, 4, H * 0.42) : 0;
  const gapB = bcH + textH > 0 ? pad * 0.6 : 0;

  const topY = pad;
  const topH = Math.max(4, H - 2 * pad - bcH - textH - gapB);

  const hasRight = cfg.showColumnBar || cfg.showShelf;
  const gapMid = hasRight ? innerW * 0.02 : 0;
  const leftW = hasRight ? innerW * 0.42 : innerW;

  const rackLen = Math.max(2, data.rack.length);
  // 0.55 ≈ szerokość znaku czcionki condensed względem jej rozmiaru
  const rackFont = Math.min(topH * 0.75, leftW / (rackLen * 0.55)) * cfg.rackFontScale;

  const rightX = pad + leftW + gapMid;
  const rightW = W - pad - rightX;
  const rowH = topH * 0.44;
  const rowGap = topH * 0.12;
  const baseLabelFont = rowH * 0.42 * cfg.headerFontScale;
  const valueFontMm = rowH * 0.66 * cfg.headerFontScale;
  // Tekst z małymi literami (x-height ≈ 53% stopnia pisma) wygląda na mniejszy
  // niż wersaliki (≈ 72%) — kompensujemy stopień, by oba nagłówki były
  // optycznie tej samej wielkości (tak jak na oryginalnych etykietach).
  const caseComp = (s: string) => (/\p{Ll}/u.test(s) ? 1.32 : 1);
  const columnLabelFontMm = baseLabelFont * caseComp(cfg.columnLabel);
  const shelfLabelFontMm = baseLabelFont * caseComp(cfg.shelfLabel);

  const code = renderCode(cfg.codeTemplate, data);
  const modules = Math.max(1, code128Modules(code));
  const moduleDots = clamp(Math.floor(mmToDots(innerW, cfg.dpi) / modules), 1, 10);
  const dotMm = 25.4 / cfg.dpi;
  const bcW = Math.min(innerW, modules * moduleDots * dotMm);
  const bcY = topY + topH + gapB;

  // Linie podziału jak na oryginalnych etykietach: pionowa między kodem
  // regału a kolumną/półką, pozioma nad sekcją kodu kreskowego.
  const dividers: Box[] = [];
  if (cfg.showDividers) {
    const t = clamp(W * 0.004, 0.3, 0.6);
    const hLineY = gapB > 0 ? topY + topH + gapB / 2 - t / 2 : null;
    if (hasRight) {
      // Prawa krawędź linii styka się z lewą krawędzią paska KOLUMNA,
      // więc linia wtapia się w jego czarne tło.
      const vX = pad + leftW + gapMid - t;
      const vBottom = hLineY !== null ? hLineY + t : H - pad;
      dividers.push({ x: vX, y: topY, w: t, h: vBottom - topY });
    }
    if (hLineY !== null) {
      dividers.push({ x: pad, y: hLineY, w: innerW, h: t });
    }
  }

  return {
    inset,
    dividers,
    rack: { x: pad, y: topY, w: leftW, h: topH, fontMm: rackFont },
    columnBar: { x: rightX, y: topY, w: rightW, h: rowH, labelFontMm: columnLabelFontMm, valueFontMm },
    shelfRow: {
      x: rightX,
      y: topY + rowH + rowGap,
      w: rightW,
      h: rowH,
      labelFontMm: shelfLabelFontMm,
      valueFontMm,
    },
    barcode: { x: pad + (innerW - bcW) / 2, y: bcY, w: bcW, h: bcH, moduleDots, code },
    barcodeText: {
      x: pad,
      y: bcY + bcH + (cfg.showBarcode ? 0.6 : 0),
      w: innerW,
      h: textH,
      fontMm: textFont,
      text: code,
    },
  };
}
