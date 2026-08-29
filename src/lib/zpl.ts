import type { LabelConfig, LabelData } from '../types';
import { computeLayout } from './layout';
import { mmToDots } from './units';

const PL_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
};

export function transliterate(s: string): string {
  return s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => PL_MAP[ch] ?? ch);
}

function fd(s: string, ascii: boolean): string {
  const clean = s.replace(/[\^~]/g, ' ');
  return ascii ? transliterate(clean) : clean;
}

export function zplForLabel(data: LabelData, cfg: LabelConfig): string {
  const L = computeLayout(cfg, data);
  const d = (mm: number) => mmToDots(mm, cfg.dpi);
  const sx = Math.max(0.5, cfg.printScaleXPercent / 100);
  const sy = Math.max(0.5, cfg.printScaleYPercent / 100);
  const px = (mm: number) => d(cfg.printOffsetXmm + mm * sx);
  const py = (mm: number) => d(cfg.printOffsetYmm + mm * sy);
  const sw = (mm: number) => Math.max(1, d(mm * sx));
  const sh = (mm: number) => Math.max(1, d(mm * sy));
  const a = cfg.asciiFallback;

  const z: string[] = [
    '^XA',
    '^CI28',
    `^PW${d(cfg.widthMm)}`,
    `^LL${d(cfg.heightMm)}`,
    '^LH0,0',
  ];

  for (const dv of L.dividers) {
    const w = sw(dv.w);
    const h = sh(dv.h);
    z.push(`^FO${px(dv.x)},${py(dv.y)}^GB${w},${h},${Math.min(w, h)}^FS`);
  }

  if (cfg.showRack) {
    const fh = sh(L.rack.fontMm);
    const fw = sw(L.rack.fontMm);
    const align = cfg.rackAlign === 'center' ? 'C' : cfg.rackAlign === 'right' ? 'R' : 'L';
    z.push(
      `^FO${px(L.rack.x)},${py(L.rack.y + (L.rack.h - L.rack.fontMm) / 2)}^A0N,${fh},${fw}^FB${sw(L.rack.w)},1,0,${align}^FD${fd(data.rack, a)}^FS`,
    );
  }

  if (cfg.showColumnBar) {
    const b = L.columnBar;
    const lfh = sh(b.labelFontMm);
    const lfw = sw(b.labelFontMm);
    const vfh = sh(b.valueFontMm);
    const vfw = sw(b.valueFontMm);
    z.push(`^FO${px(b.x)},${py(b.y)}^GB${sw(b.w)},${sh(b.h)},${sh(b.h)}^FS`);
    z.push(
      `^FO${px(b.x + L.inset)},${py(b.y + (b.h - b.labelFontMm) / 2)}^FR^A0N,${lfh},${lfw}^FD${fd(cfg.columnLabel, a)}^FS`,
    );
    z.push(
      `^FO${px(b.x)},${py(b.y + (b.h - b.valueFontMm) / 2)}^FR^A0N,${vfh},${vfw}^FB${sw(b.w - L.inset)},1,0,R^FD${fd(data.column, a)}^FS`,
    );
  }

  if (cfg.showShelf) {
    const b = L.shelfRow;
    const lfh = sh(b.labelFontMm);
    const lfw = sw(b.labelFontMm);
    const vfh = sh(b.valueFontMm);
    const vfw = sw(b.valueFontMm);
    z.push(
      `^FO${px(b.x + L.inset)},${py(b.y + (b.h - b.labelFontMm) / 2)}^A0N,${lfh},${lfw}^FD${fd(cfg.shelfLabel, a)}^FS`,
    );
    z.push(
      `^FO${px(b.x)},${py(b.y + (b.h - b.valueFontMm) / 2)}^A0N,${vfh},${vfw}^FB${sw(b.w - L.inset)},1,0,R^FD${fd(data.shelf, a)}^FS`,
    );
  }

  if (cfg.showBarcode && L.barcode.code) {
    const b = L.barcode;
    const moduleDots = Math.max(1, Math.round(b.moduleDots * sx));
    z.push(`^BY${moduleDots},2`);
    z.push(`^FO${px(b.x)},${py(b.y)}^BCN,${sh(b.h)},N,N,N^FD${fd(b.code, a)}^FS`);
  }

  if (cfg.showBarcodeText && L.barcodeText.text) {
    const t = L.barcodeText;
    const tfh = sh(t.fontMm);
    const tfw = sw(t.fontMm);
    const x = px(t.x);
    const y = py(t.y);
    const width = sw(t.w);
    const field = `^A0N,${tfh},${tfw}^FB${width},1,0,C^FD${fd(t.text, a)}^FS`;
    z.push(`^FO${x},${y}${field}`);
    if (cfg.barcodeTextBold) z.push(`^FO${x + 1},${y}${field}`);
  }

  z.push('^XZ');
  return z.join('\n');
}

export function zplForLabels(labels: LabelData[], cfg: LabelConfig): string {
  return labels.map((l) => zplForLabel(l, cfg)).join('\n');
}
