import { describe, expect, it } from 'vitest';
import { computeLayout, renderCode } from '../src/lib/layout';
import { code128Modules } from '../src/lib/code128';
import { mmToDots } from '../src/lib/units';
import { DEFAULT_CONFIG } from '../src/types';

const DATA = { rack: 'C03', column: '06', shelf: '03' };

describe('units', () => {
  it('mmToDots: 100 mm przy 203 dpi = 799 dotów (zaokrąglenie)', () => {
    expect(mmToDots(100, 203)).toBe(Math.round((100 * 203) / 25.4));
    expect(mmToDots(25.4, 203)).toBe(203);
    expect(mmToDots(25.4, 300)).toBe(300);
  });
});

describe('renderCode', () => {
  it('podstawia wartości do szablonu', () => {
    expect(renderCode('{regal}-{kolumna}-{polka}', DATA)).toBe('C03-06-03');
  });
});

describe('code128Modules', () => {
  it('liczy moduły dla danych mieszanych (podzbiór B z fragmentami cyfr)', () => {
    expect(code128Modules('C03-05-03')).toBe(11 * 11 + 13);
  });

  it('liczy moduły dla samych cyfr (podzbiór C)', () => {
    expect(code128Modules('1234')).toBe(11 * 4 + 13);
  });

  it('zwraca 0 dla pustych danych', () => {
    expect(code128Modules('')).toBe(0);
  });
});

describe('computeLayout', () => {
  it('mieści wszystkie elementy wewnątrz etykiety', () => {
    const L = computeLayout(DEFAULT_CONFIG, DATA);
    const W = DEFAULT_CONFIG.widthMm;
    const H = DEFAULT_CONFIG.heightMm;
    for (const box of [L.rack, L.columnBar, L.shelfRow, L.barcode, L.barcodeText]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(W + 0.001);
      expect(box.y + box.h).toBeLessThanOrEqual(H + 0.001);
    }
  });

  it('centruje kod kreskowy w obszarze etykiety przy zerowym offsecie', () => {
    const L = computeLayout(DEFAULT_CONFIG, DATA);
    const center = L.barcode.x + L.barcode.w / 2;
    expect(center).toBeCloseTo(DEFAULT_CONFIG.widthMm / 2, 1);
  });

  it('poszerza obszar regału gdy prawa kolumna jest ukryta', () => {
    const L1 = computeLayout(DEFAULT_CONFIG, DATA);
    const L2 = computeLayout({ ...DEFAULT_CONFIG, showColumnBar: false, showShelf: false }, DATA);
    expect(L2.rack.w).toBeGreaterThan(L1.rack.w);
  });

  it('kompensuje stopień pisma dla nagłówka z małymi literami', () => {
    const L = computeLayout(DEFAULT_CONFIG, DATA);
    expect(L.shelfRow.labelFontMm).toBeCloseTo(L.columnBar.labelFontMm * 1.32, 5);
    const caps = computeLayout({ ...DEFAULT_CONFIG, shelfLabel: 'PÓŁKA' }, DATA);
    expect(caps.shelfRow.labelFontMm).toBeCloseTo(caps.columnBar.labelFontMm, 5);
  });

  it('generuje separatory dla domyślnego układu', () => {
    const L = computeLayout(DEFAULT_CONFIG, DATA);
    expect(L.dividers).toHaveLength(2);
    expect(L.dividers.some((d) => d.h > d.w)).toBe(true);
    expect(L.dividers.some((d) => d.w > d.h)).toBe(true);
  });

  it('pomija linie podziału gdy wyłączone', () => {
    const L = computeLayout({ ...DEFAULT_CONFIG, showDividers: false }, DATA);
    expect(L.dividers).toHaveLength(0);
  });

  it('pozwala przesuwać kolumnę i półkę niezależnie', () => {
    const base = computeLayout(DEFAULT_CONFIG, DATA);
    const moved = computeLayout({ ...DEFAULT_CONFIG, columnOffsetX: 4, shelfOffsetY: 3 }, DATA);
    expect(moved.columnBar.x).toBeCloseTo(base.columnBar.x + 4, 5);
    expect(moved.columnBar.y).toBeCloseTo(base.columnBar.y, 5);
    expect(moved.shelfRow.y).toBeCloseTo(base.shelfRow.y + 3, 5);
    expect(moved.shelfRow.x).toBeCloseTo(base.shelfRow.x, 5);
  });

  it('respektuje jawne wymiary elementów', () => {
    const L = computeLayout({
      ...DEFAULT_CONFIG,
      rackWidthMm: 24,
      rackHeightMm: 18,
      columnWidthMm: 30,
      columnHeightMm: 9,
      shelfWidthMm: 28,
      shelfHeightMm: 8,
      barcodeWidthMm: 44,
      barcodeTextWidthMm: 36,
    }, DATA);
    expect(L.rack.w).toBeCloseTo(24, 5);
    expect(L.rack.h).toBeCloseTo(18, 5);
    expect(L.columnBar.w).toBeCloseTo(30, 5);
    expect(L.columnBar.h).toBeCloseTo(9, 5);
    expect(L.shelfRow.w).toBeCloseTo(28, 5);
    expect(L.shelfRow.h).toBeCloseTo(8, 5);
    expect(L.barcode.w).toBeLessThanOrEqual(44);
    expect(L.barcodeText.w).toBeCloseTo(36, 5);
  });

  it('dobiera moduł kodu ≥ 2 doty dla małej etykiety przy 203 dpi', () => {
    const L = computeLayout({ ...DEFAULT_CONFIG, widthMm: 57, heightMm: 32 }, DATA);
    expect(L.barcode.moduleDots).toBeGreaterThanOrEqual(2);
  });
});
