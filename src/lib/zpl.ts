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

/** ^ i ~ to znaki sterujące ZPL — nie mogą trafić do danych pola. */
function fd(s: string, ascii: boolean): string {
  const clean = s.replace(/[\^~]/g, ' ');
  return ascii ? transliterate(clean) : clean;
}

export function zplForLabel(data: LabelData, cfg: LabelConfig): string {
  const L = computeLayout(cfg, data);
  const d = (mm: number) => mmToDots(mm, cfg.dpi);
  const a = cfg.asciiFallback;
  const z: string[] = [
    '^XA',
    '^CI28', // UTF-8 — czcionka 0 na ZD421 (Link-OS) drukuje polskie znaki
    `^PW${d(cfg.widthMm)}`,
    `^LL${d(cfg.heightMm)}`,
    '^LH0,0',
  ];

  const rf = d(L.rack.fontMm);
  z.push(
    `^FO${d(L.rack.x)},${d(L.rack.y + (L.rack.h - L.rack.fontMm) / 2)}^A0N,${rf},${rf}^FD${fd(data.rack, a)}^FS`,
  );

  if (cfg.showColumnBar) {
    const b = L.columnBar;
    const lf = d(b.labelFontMm);
    const vf = d(b.valueFontMm);
    z.push(`^FO${d(b.x)},${d(b.y)}^GB${d(b.w)},${d(b.h)},${d(b.h)}^FS`);
    z.push(
      `^FO${d(b.x + L.inset)},${d(b.y + (b.h - b.labelFontMm) / 2)}^FR^A0N,${lf},${lf}^FD${fd(cfg.columnLabel, a)}^FS`,
    );
    z.push(
      `^FO${d(b.x)},${d(b.y + (b.h - b.valueFontMm) / 2)}^FR^A0N,${vf},${vf}^FB${d(b.w - L.inset)},1,0,R^FD${fd(data.column, a)}^FS`,
    );
  }

  if (cfg.showShelf) {
    const b = L.shelfRow;
    const lf = d(b.labelFontMm);
    const vf = d(b.valueFontMm);
    z.push(
      `^FO${d(b.x + L.inset)},${d(b.y + (b.h - b.labelFontMm) / 2)}^A0N,${lf},${lf}^FD${fd(cfg.shelfLabel, a)}^FS`,
    );
    z.push(
      `^FO${d(b.x)},${d(b.y + (b.h - b.valueFontMm) / 2)}^A0N,${vf},${vf}^FB${d(b.w - L.inset)},1,0,R^FD${fd(data.shelf, a)}^FS`,
    );
  }

  if (cfg.showBarcode && L.barcode.code) {
    const b = L.barcode;
    z.push(`^BY${b.moduleDots},2`);
    // Linia interpretacji wyłączona — własny tekst niżej daje spójny WYSIWYG.
    z.push(`^FO${d(b.x)},${d(b.y)}^BCN,${d(b.h)},N,N,N^FD${fd(b.code, a)}^FS`);
  }

  if (cfg.showBarcodeText && L.barcodeText.text) {
    const t = L.barcodeText;
    const tf = d(t.fontMm);
    z.push(`^FO${d(t.x)},${d(t.y)}^A0N,${tf},${tf}^FB${d(t.w)},1,0,C^FD${fd(t.text, a)}^FS`);
  }

  z.push('^XZ');
  return z.join('\n');
}

export function zplForLabels(labels: LabelData[], cfg: LabelConfig): string {
  return labels.map((l) => zplForLabel(l, cfg)).join('\n');
}
