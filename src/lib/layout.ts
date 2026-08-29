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

export interface LabelSections {
  rack: Box;
  right: Box;
  bottom: Box;
  columnSlot: Box;
  shelfSlot: Box;
  barcodeSlot: Box;
  barcodeTextSlot: Box;
}

export interface LabelLayout {
  inset: number;
  dividers: Box[];
  sections: LabelSections;
  rack: Box & { fontMm: number };
  columnBar: Box & { labelFontMm: number; valueFontMm: number };
  shelfRow: Box & { labelFontMm: number; valueFontMm: number };
  barcode: Box & { moduleDots: number; code: string };
  barcodeText: Box & { fontMm: number; text: string };
}

function sized(value: number, fallback: number, max: number, min = 1): number {
  return clamp(value > 0 ? value : fallback, min, Math.max(min, max));
}

const SNAP_MM = 1.1;

function placeInSection<T extends Box>(box: T, dx: number, dy: number, section: Box): T {
  const maxX = section.x + Math.max(0, section.w - box.w);
  const maxY = section.y + Math.max(0, section.h - box.h);
  let x = clamp(box.x + dx, section.x, maxX);
  let y = clamp(box.y + dy, section.y, maxY);

  const sectionCx = section.x + section.w / 2;
  const sectionCy = section.y + section.h / 2;

  const candidatesX = [
    { delta: section.x - x },
    { delta: sectionCx - (x + box.w / 2) },
    { delta: section.x + section.w - (x + box.w) },
  ];
  const bestX = candidatesX.reduce((a, b) => Math.abs(b.delta) < Math.abs(a.delta) ? b : a);
  if (Math.abs(bestX.delta) <= SNAP_MM) x += bestX.delta;

  const candidatesY = [
    { delta: section.y - y },
    { delta: sectionCy - (y + box.h / 2) },
    { delta: section.y + section.h - (y + box.h) },
  ];
  const bestY = candidatesY.reduce((a, b) => Math.abs(b.delta) < Math.abs(a.delta) ? b : a);
  if (Math.abs(bestY.delta) <= SNAP_MM) y += bestY.delta;

  return {
    ...box,
    x: clamp(x, section.x, maxX),
    y: clamp(y, section.y, maxY),
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
  const barcodeTextGap = cfg.showBarcode && cfg.showBarcodeText ? 0.6 : 0;
  const bottomContentH = autoBcH + autoTextH + barcodeTextGap;
  const sectionGapY = bottomContentH > 0 ? Math.max(0.5, Math.min(innerW, innerH) * 0.018) : 0;
  const topY = marginTop;
  const topH = Math.max(4, innerH - bottomContentH - sectionGapY);
  const bottomY = topY + topH + sectionGapY;
  const bottomH = Math.max(1, H - marginBottom - bottomY);

  const hasRight = cfg.showColumnBar || cfg.showShelf;
  const hasRack = cfg.showRack;
  const gapMid = hasRight && hasRack ? clamp(cfg.sectionGapMm, 0, innerW * 0.2) : 0;
  const availableTopW = Math.max(1, innerW - gapMid);
  const rackSectionW = hasRack ? (hasRight ? availableTopW * clamp(cfg.rackWidthPercent, 10, 90) / 100 : innerW) : 0;
  const rightSectionW = hasRight ? (hasRack ? availableTopW - rackSectionW : innerW) : 0;
  const rightX = hasRack ? marginLeft + rackSectionW + gapMid : marginLeft;

  const rackSection: Box = { x: marginLeft, y: topY, w: rackSectionW, h: topH };
  const rightSection: Box = { x: rightX, y: topY, w: rightSectionW, h: topH };
  const bottomSection: Box = { x: marginLeft, y: bottomY, w: innerW, h: bottomH };

  const configuredRowGap = cfg.showColumnBar && cfg.showShelf ? clamp(cfg.rowGapMm, 0, topH * 0.25) : 0;
  const rowGap = Math.min(configuredRowGap, Math.max(0, topH - 4));
  const sharedRowH = cfg.showColumnBar && cfg.showShelf
    ? Math.max(2, (topH - rowGap) / 2)
    : topH;
  const columnSlot: Box = { x: rightSection.x, y: rightSection.y, w: rightSection.w, h: sharedRowH };
  const shelfSlot: Box = {
    x: rightSection.x,
    y: cfg.showColumnBar ? rightSection.y + sharedRowH + rowGap : rightSection.y,
    w: rightSection.w,
    h: cfg.showColumnBar && cfg.showShelf ? sharedRowH : topH,
  };

  const barcodeSlotH = cfg.showBarcode ? Math.min(autoBcH, bottomSection.h) : 0;
  const barcodeSlot: Box = { x: bottomSection.x, y: bottomSection.y, w: bottomSection.w, h: barcodeSlotH };
  const barcodeTextSlotY = bottomSection.y + barcodeSlotH + barcodeTextGap;
  const barcodeTextSlot: Box = {
    x: bottomSection.x,
    y: barcodeTextSlotY,
    w: bottomSection.w,
    h: Math.max(1, bottomSection.y + bottomSection.h - barcodeTextSlotY),
  };

  const sections: LabelSections = {
    rack: rackSection,
    right: rightSection,
    bottom: bottomSection,
    columnSlot,
    shelfSlot,
    barcodeSlot,
    barcodeTextSlot,
  };

  const rackW = hasRack ? sized(cfg.rackWidthMm, rackSection.w, rackSection.w, 2) : 0;
  const rackH = hasRack ? sized(cfg.rackHeightMm, rackSection.h, rackSection.h, 2) : 0;
  const rackLen = Math.max(2, data.rack.length);
  const rackFont = hasRack
    ? Math.min(rackH * 0.75, Math.max(1, rackW) / (rackLen * 0.55)) * cfg.rackFontScale
    : 0;
  const rack = placeInSection(
    { x: rackSection.x, y: rackSection.y, w: rackW, h: rackH, fontMm: rackFont },
    cfg.rackOffsetX,
    cfg.rackOffsetY,
    rackSection,
  );

  const columnW = cfg.showColumnBar ? sized(cfg.columnWidthMm, columnSlot.w, columnSlot.w, 2) : 0;
  const columnH = cfg.showColumnBar ? sized(cfg.columnHeightMm, columnSlot.h, columnSlot.h, 2) : 0;
  const columnLabelBase = columnH * 0.42 * cfg.headerFontScale;
  const columnValueFont = columnH * 0.66 * cfg.valueFontScale;
  const caseComp = (s: string) => (/\p{Ll}/u.test(s) ? 1.32 : 1);
  const columnBar = placeInSection(
    {
      x: columnSlot.x,
      y: columnSlot.y,
      w: columnW,
      h: columnH,
      labelFontMm: columnLabelBase * caseComp(cfg.columnLabel),
      valueFontMm: columnValueFont,
    },
    cfg.columnOffsetX,
    cfg.columnOffsetY,
    columnSlot,
  );

  const shelfW = cfg.showShelf ? sized(cfg.shelfWidthMm, shelfSlot.w, shelfSlot.w, 2) : 0;
  const shelfH = cfg.showShelf ? sized(cfg.shelfHeightMm, shelfSlot.h, shelfSlot.h, 2) : 0;
  const shelfLabelBase = shelfH * 0.42 * cfg.headerFontScale;
  const shelfValueFont = shelfH * 0.66 * cfg.valueFontScale;
  const shelfRow = placeInSection(
    {
      x: shelfSlot.x,
      y: shelfSlot.y,
      w: shelfW,
      h: shelfH,
      labelFontMm: shelfLabelBase * caseComp(cfg.shelfLabel),
      valueFontMm: shelfValueFont,
    },
    cfg.shelfOffsetX,
    cfg.shelfOffsetY,
    shelfSlot,
  );

  const code = renderCode(cfg.codeTemplate, data);
  const modules = Math.max(1, code128Modules(code));
  const autoBarcodeAreaW = bottomSection.w * clamp(cfg.barcodeWidthPercent, 20, 100) / 100;
  const barcodeAreaW = sized(cfg.barcodeWidthMm, autoBarcodeAreaW, bottomSection.w, 4);
  const moduleDots = clamp(Math.floor(mmToDots(barcodeAreaW, cfg.dpi) / modules), 1, 10);
  const dotMm = 25.4 / cfg.dpi;
  const naturalBcW = modules * moduleDots * dotMm;
  const bcW = Math.min(barcodeAreaW, naturalBcW);
  const bcH = cfg.showBarcode ? sized(cfg.barcodeHeightMm, barcodeSlot.h, barcodeSlot.h, 4) : 0;
  const barcode = placeInSection(
    {
      x: bottomSection.x + (bottomSection.w - bcW) / 2,
      y: barcodeSlot.y,
      w: bcW,
      h: bcH,
      moduleDots,
      code,
    },
    cfg.barcodeOffsetX,
    cfg.barcodeOffsetY,
    barcodeSlot,
  );

  const textW = cfg.showBarcodeText ? sized(cfg.barcodeTextWidthMm, barcodeTextSlot.w, barcodeTextSlot.w, 2) : 0;
  const textH = cfg.showBarcodeText ? sized(cfg.barcodeTextHeightMm, autoTextH, barcodeTextSlot.h, 1) : 0;
  const textFont = Math.min(textH * 0.8, autoTextFont);
  const barcodeText = placeInSection(
    {
      x: barcodeTextSlot.x + (barcodeTextSlot.w - textW) / 2,
      y: barcodeTextSlot.y,
      w: textW,
      h: textH,
      fontMm: textFont,
      text: code,
    },
    cfg.barcodeTextOffsetX,
    cfg.barcodeTextOffsetY,
    barcodeTextSlot,
  );

  const dividers: Box[] = [];
  if (cfg.showDividers) {
    const t = clamp(cfg.dividerThicknessMm, 0.15, 2);
    if (hasRack && hasRight) {
      dividers.push({
        x: rackSection.x + rackSection.w + gapMid / 2 - t / 2,
        y: topY,
        w: t,
        h: topH,
      });
    }
    if (bottomContentH > 0) {
      dividers.push({
        x: marginLeft,
        y: topY + topH + sectionGapY / 2 - t / 2,
        w: innerW,
        h: t,
      });
    }
  }

  return { inset, dividers, sections, rack, columnBar, shelfRow, barcode, barcodeText };
}
