import { describe, expect, it } from 'vitest';
import { transliterate, zplForLabel, zplForLabels } from '../src/lib/zpl';
import { DEFAULT_CONFIG } from '../src/types';

const DATA = { rack: 'C03', column: '06', shelf: '03' };

describe('zplForLabel', () => {
  const zpl = zplForLabel(DATA, DEFAULT_CONFIG);

  it('otwiera i zamyka format oraz ustawia UTF-8 i wymiary w dotach', () => {
    expect(zpl.startsWith('^XA')).toBe(true);
    expect(zpl.endsWith('^XZ')).toBe(true);
    expect(zpl).toContain('^CI28');
    expect(zpl).toContain(`^PW${Math.round((100 * 203) / 25.4)}`);
    expect(zpl).toContain(`^LL${Math.round((60 * 203) / 25.4)}`);
  });

  it('rysuje czarny pasek kolumny z tekstem w negatywie (^GB + ^FR)', () => {
    expect(zpl).toContain('^GB');
    expect(zpl).toContain('^FR');
    expect(zpl).toContain('^FDKOLUMNA^FS');
  });

  it('koduje Code128 bez linii interpretacji i z własnym tekstem', () => {
    expect(zpl).toMatch(/\^BCN,\d+,N,N,N\^FDC03-06-03\^FS/);
    expect(zpl).toMatch(/\^FB\d+,1,0,C\^FDC03-06-03\^FS/);
  });

  it('pomija ukryte elementy', () => {
    const z = zplForLabel(DATA, {
      ...DEFAULT_CONFIG,
      showColumnBar: false,
      showBarcode: false,
      showBarcodeText: false,
      showDividers: false,
    });
    expect(z).not.toContain('^GB');
    expect(z).not.toContain('^BC');
  });

  it('rysuje linie podziału jako ^GB', () => {
    // pionowa + pozioma linia oraz wypełniony pasek kolumny = 3 × ^GB
    expect(zpl.match(/\^GB/g)).toHaveLength(3);
  });

  it('usuwa znaki sterujące ZPL z danych', () => {
    const z = zplForLabel({ ...DATA, rack: 'C^0~3' }, DEFAULT_CONFIG);
    expect(z).toContain('^FDC 0 3^FS');
  });

  it('transliteruje polskie znaki w trybie zgodności', () => {
    const z = zplForLabel(DATA, { ...DEFAULT_CONFIG, asciiFallback: true });
    expect(z).toContain('^FDPolka^FS');
    expect(z).not.toContain('Półka');
  });

  it('domyślnie zostawia UTF-8 („Półka")', () => {
    expect(zpl).toContain('^FDPółka^FS');
  });
});

describe('transliterate', () => {
  it('mapuje wszystkie polskie znaki diakrytyczne', () => {
    expect(transliterate('ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ')).toBe('acelnoszz ACELNOSZZ');
  });
});

describe('zplForLabels', () => {
  it('łączy wiele etykiet w jeden strumień ^XA…^XZ', () => {
    const z = zplForLabels([DATA, { ...DATA, shelf: '04' }], DEFAULT_CONFIG);
    expect(z.match(/\^XA/g)).toHaveLength(2);
    expect(z.match(/\^XZ/g)).toHaveLength(2);
  });
});
