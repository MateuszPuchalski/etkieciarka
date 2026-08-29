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

export interface LabelLayout {
  inset: number;
  dividers: Box[];
  rack: Box & { fontMm: number };
  columnBar: Box & { labelFontMm: number; valueFontMm: number };
  shelfRow: Box & { labelFontMm: number; valueFontMm: number };
  barcode: Box & { moduleDots: number; code: string };
  barcodeText: Box & { fontMm: number; text: string };
}

function sized(value: number, fallback: number, max: number, min = 1): number {
  return clamp(value > 0 ? value : fallback, min, Math.max(min, max));
}

function place<T extends Box>(box: T, dx: number, dy: number, W: number, H: number): T {
  return {
    ...box,
    x: clamp(box.x + dx, 0, Math.max(0, W - box.w)),
    y: clamp(box.y + dy, 0, Math.max(0, H - box.h)),
  };
}

export function computeLayout(cfg: LabelConfig, data: LabelData): LabelLayout {
  const W = cfg.widthMm;
  const H = cfg.heightMm;

  const marginLeft = clamp(cfg.marginLeftMm, 0, W * 0.45);
  const marginRight = clamp(cfg.marginRightMm, 0, W * 0.45);
  const marginTop = clamp(cfg.marginTopMm, 0, H * 0.45);
  const marginBottom = clamp(cfg.marginBottomMm, 0, H * 0.45);
  const innerW = Math.max(1, W - marginLeft - marginRight);
  const innerH = Math.max(4, H - marginTop - marginBottom);
  const inset = clamp(W * 0.012, 0.8, 2);

  const textFontBase = clamp(H * 0.062, 2, 4.5);
  const autoTextFont = textFontBase * cfg.barcodeTextFontScale;
  const autoTextH = cfg.showBarcodeText ? autoTextFont * 1.3 : 0;
  const autoBcH = cfg.showBarcode ? clamp(cfg.barcodeHeightMm, 4, innerH * 0.42) : 0;
  const gapB = autoBcH + autoTextH > 0 ? Math.max(0.5, Math.min(innerW, innerH) * 0.018) : 0;
  const topY = marginTop;
  const topH = Math.max(4, innerH - autoBcH - autoTextH - gapB);

  const hasRight = cfg.showColumnBar || cfg.showShelf;
  const hasRack = cfg.showRack;
  const gapMid = hasRight && hasRack ? clamp(cfg.sectionGapMm, 0, innerW * 0.2) : 0;
  const availableTopW = Math.max(1, innerW - gapMid);
  const autoRackW = hasRack ? (hasRight ? availableTopW * clamp(cfg.rackWidthPercent, 10, 90) / 100 : innerW) : 0;
  const autoRightW = hasRight ? (hasRack ? availableTopW - autoRackW : innerW) : 0;
  const autoRowH = topH * clamp(cfg.rightRowHeightPercent, 20, 50) / 100;
  const configuredRowGap = clamp(cfg.rowGapMm, 0, topH * 0.4);
  const rowGap = cfg.showColumnBar && cfg.showShelf
    ? Math.min(configuredRowGap, Math.max(0, topH - 2 * autoRowH))
    : 0;
  const rightX = hasRack ? marginLeft + autoRackW + gapMid : marginLeft;
  const shelfY = cfg.showColumnBar ? topY + autoRowH + rowGap : topY;

  const rackW = hasRack ? sized(cfg.rackWidthMm, autoRackW, W, 2) : 0;
  const rackH = hasRack ? sized(cfg.rackHeightMm, topH, H, 2) : 0;
  const rackLen = Math.max(2, data.rack.length);
  const rackFont = hasRack
    ? Math.min(rackH * 0.75, Math.max(1, rackW) / (rackLen * 0.55)) * cfg.rackFontScale
    : 0;
  const rack = place(
    { x: marginLeft, y: topY, w: rackW, h: rackH, fontMm: rackFont },
    cfg.rackOffsetX,
    cfg.rackOffsetY,
    W,
    H,
  );

  const columnW = cfg.showColumnBar ? sized(cfg.columnWidthMm, autoRightW, W, 2) : 0;
  const columnH = cfg.showColumnBar ? sized(cfg.columnHeightMm, autoRowH, H, 2) : 0;
  const columnLabelBase = columnH * 0.42 * cfg.headerFontScale;
  const columnValueFont = columnH * 0.66 * cfg.valueFontScale;
  const caseComp = (s: string) => (/\p{Ll}/u.test(s) ? 1.32 : 1);
  const columnBar = place(
    {
      x: rightX,
      y: topY,
      w: columnW,
      h: columnH,
      labelFontMm: columnLabelBase * caseComp(cfg.columnLabel),
      valueFontMm: columnValueFont,
    },
    cfg.columnOffsetX,
    cfg.columnOffsetY,
    W,
    H,
  );

  const shelfW = cfg.showShelf ? sized(cfg.shelfWidthMm, autoRightW, W, 2) : 0;
  const shelfH = cfg.showShelf ? sized(cfg.shelfHeightMm, autoRowH, H, 2) : 0;
  const shelfLabelBase = shelfH * 0.42 * cfg.headerFontScale;
  const shelfValueFont = shelfH * 0.66 * cfg.valueFontScale;
  const shelfRow = place(
    {
      x: rightX,
      y: shelfY,
      w: shelfW,
      h: shelfH,
      labelFontMm: shelfLabelBase * caseComp(cfg.shelfLabel),
      valueFontMm: shelfValueFont,
    },
    cfg.shelfOffsetX,
    cfg.shelfOffsetY,
    W,
    H,
  );

  const code = renderCode(cfg.codeTemplate, data);
  const modules = Math.max(1, code128Modules(code));
  const autoBarcodeAreaW = innerW * clamp(cfg.barcodeWidthPercent, 20, 100) / 100;
  const barcodeAreaW = sized(cfg.barcodeWidthMm, autoBarcodeAreaW, W, 4);
  const moduleDots = clamp(Math.floor(mmToDots(barcodeAreaW, cfg.dpi) / modules), 1, 10);
  const dotMm = 25.4 / cfg.dpi;
  const naturalBcW = modules * moduleDots * dotMm;
  const bcW = Math.min(barcodeAreaW, naturalBcW);
  const bcH = cfg.showBarcode ? sized(cfg.barcodeHeightMm, autoBcH, H, 4) : 0;
  const bcY = topY + topH + gapB;
  const barcode = place(
    { x: marginLeft + (innerW - bcW) / 2, y: bcY, w: bcW, h: bcH, moduleDots, code },
    cfg.barcodeOffsetX,
    cfg.barcodeOffsetY,
    W,
    H,
  );

  const textW = cfg.showBarcodeText ? sized(cfg.barcodeTextWidthMm, innerW, W, 2) : 0;
  const textH = cfg.showBarcodeText ? sized(cfg.barcodeTextHeightMm, autoTextH, H, 1) : 0;
  const textFont = Math.min(textH * 0.8, autoTextFont);
  const barcodeText = place(
    {
      x: marginLeft + (innerW - textW) / 2,
      y: bcY + bcH + (cfg.showBarcode ? 0.6 : 0),
      w: textW,
      h: textH,
      fontMm: textFont,
      text: code,
    },
    cfg.barcodeTextOffsetX,
    cfg.barcodeTextOffsetY,
    W,
    H,
  );

  const dividers: Box[] = [];
  if (cfg.showDividers) {
    const t = clamp(cfg.dividerThicknessMm, 0.15, 2);
    if (cfg.showRack && (cfg.showColumnBar || cfg.showShelf)) {
      const rightBoxes: Box[] = [];
      if (cfg.showColumnBar) rightBoxes.push(columnBar);
      if (cfg.showShelf) rightBoxes.push(shelfRow);
      const rightLeft = Math.min(...rightBoxes.map((b) => b.x));
      const x = clamp((rack.x + rack.w + rightLeft) / 2 - t / 2, 0, W - t);
      const top = Math.min(rack.y, ...rightBoxes.map((b) => b.y));
      const bottom = Math.max(rack.y + rack.h, ...rightBoxes.map((b) => b.y + b.h));
      if (rightLeft >= rack.x + rack.w) dividers.push({ x, y: top, w: t, h: Math.max(t, bottom - top) });
    }
    if (cfg.showBarcode) {
      const topBoxes: Box[] = [];
      if (cfg.showRack) topBoxes.push(rack);
      if (cfg.showColumnBar) topBoxes.push(columnBar);
      if (cfg.showShelf) topBoxes.push(shelfRow);
      if (topBoxes.length) {
        const topBottom = Math.max(...topBoxes.map((b) => b.y + b.h));
        if (barcode.y >= topBottom) {
          const y = clamp((topBottom + barcode.y) / 2 - t / 2, 0, H - t);
          dividers.push({ x: marginLeft, y, w: innerW, h: t });
        }
      }
    }
  }

  return { inset, dividers, rack, columnBar, shelfRow, barcode, barcodeText };
}
