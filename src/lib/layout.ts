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
  inset: number;
  dividers: Box[];
  rack: Box & { fontMm: number };
  columnBar: Box & { labelFontMm: number; valueFontMm: number };
  shelfRow: Box & { labelFontMm: number; valueFontMm: number };
  barcode: Box & { moduleDots: number; code: string };
  barcodeText: Box & { fontMm: number; text: string };
}

export function computeLayout(cfg: LabelConfig, data: LabelData): LabelLayout {
  const W = cfg.widthMm;
  const H = cfg.heightMm;
  const maxPad = Math.max(0.5, Math.min(W, H) * 0.18);
  const pad = clamp(cfg.contentPaddingMm, 0, maxPad);
  const inset = clamp(W * 0.012, 0.8, 2);
  const innerW = Math.max(1, W - 2 * pad);

  const textFontBase = clamp(H * 0.062, 2, 4.5);
  const textFont = textFontBase * cfg.barcodeTextFontScale;
  const textH = cfg.showBarcodeText ? textFont * 1.3 : 0;
  const bcH = cfg.showBarcode ? clamp(cfg.barcodeHeightMm, 4, H * 0.42) : 0;
  const gapB = bcH + textH > 0 ? Math.max(0.5, pad * 0.6) : 0;

  const topY = pad;
  const topH = Math.max(4, H - 2 * pad - bcH - textH - gapB);

  const hasRight = cfg.showColumnBar || cfg.showShelf;
  const hasRack = cfg.showRack;
  const gapMid = hasRight && hasRack ? clamp(cfg.sectionGapMm, 0, innerW * 0.2) : 0;
  const availableTopW = Math.max(1, innerW - gapMid);
  const rackRatio = clamp(cfg.rackWidthPercent, 10, 90) / 100;
  const leftW = hasRack ? (hasRight ? availableTopW * rackRatio : innerW) : 0;
  const rightW = hasRight ? (hasRack ? availableTopW - leftW : innerW) : 0;

  const rackLen = Math.max(2, data.rack.length);
  const rackFont = hasRack
    ? Math.min(topH * 0.75, Math.max(1, leftW) / (rackLen * 0.55)) * cfg.rackFontScale
    : 0;

  const rightX = hasRack ? pad + leftW + gapMid : pad;
  const rowH = topH * clamp(cfg.rightRowHeightPercent, 20, 50) / 100;
  const configuredRowGap = clamp(cfg.rowGapMm, 0, topH * 0.4);
  const rowGap = cfg.showColumnBar && cfg.showShelf
    ? Math.min(configuredRowGap, Math.max(0, topH - 2 * rowH))
    : 0;
  const baseLabelFont = rowH * 0.42 * cfg.headerFontScale;
  const valueFontMm = rowH * 0.66 * cfg.valueFontScale;
  const caseComp = (s: string) => (/\p{Ll}/u.test(s) ? 1.32 : 1);
  const columnLabelFontMm = baseLabelFont * caseComp(cfg.columnLabel);
  const shelfLabelFontMm = baseLabelFont * caseComp(cfg.shelfLabel);

  const code = renderCode(cfg.codeTemplate, data);
  const modules = Math.max(1, code128Modules(code));
  const barcodeAreaW = innerW * clamp(cfg.barcodeWidthPercent, 20, 100) / 100;
  const moduleDots = clamp(Math.floor(mmToDots(barcodeAreaW, cfg.dpi) / modules), 1, 10);
  const dotMm = 25.4 / cfg.dpi;
  const naturalBcW = modules * moduleDots * dotMm;
  const bcW = Math.min(barcodeAreaW, naturalBcW);
  const bcY = topY + topH + gapB;

  const dividers: Box[] = [];
  if (cfg.showDividers) {
    const t = clamp(cfg.dividerThicknessMm, 0.15, 2);
    const hLineY = gapB > 0 ? topY + topH + gapB / 2 - t / 2 : null;
    if (hasRack && hasRight) {
      const vX = pad + leftW + gapMid / 2 - t / 2;
      const vBottom = hLineY !== null ? hLineY + t : H - pad;
      dividers.push({ x: vX, y: topY, w: t, h: Math.max(0, vBottom - topY) });
    }
    if (hLineY !== null) {
      dividers.push({ x: pad, y: hLineY, w: innerW, h: t });
    }
  }

  const shelfY = cfg.showColumnBar ? topY + rowH + rowGap : topY;

  return {
    inset,
    dividers,
    rack: { x: pad, y: topY, w: leftW, h: topH, fontMm: rackFont },
    columnBar: { x: rightX, y: topY, w: rightW, h: rowH, labelFontMm: columnLabelFontMm, valueFontMm },
    shelfRow: {
      x: rightX,
      y: shelfY,
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
