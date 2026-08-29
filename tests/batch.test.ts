import { describe, expect, it } from 'vitest';
import { expandBatch, MAX_BATCH } from '../src/lib/batch';

describe('expandBatch', () => {
  it('domyślnie generuje serię półka → kolumny', () => {
    const out = expandBatch({ racks: 'C03', colFrom: 1, colTo: 2, shelfFrom: 1, shelfTo: 3, pad: 2 });
    expect(out).toHaveLength(6);
    expect(out[0]).toEqual({ rack: 'C03', column: '01', shelf: '01' });
    expect(out[1]).toEqual({ rack: 'C03', column: '02', shelf: '01' });
    expect(out[2]).toEqual({ rack: 'C03', column: '01', shelf: '02' });
    expect(out[5]).toEqual({ rack: 'C03', column: '02', shelf: '03' });
  });

  it('pozwala przełączyć na kolejność kolumna → półki', () => {
    const out = expandBatch({
      racks: 'C03', colFrom: 1, colTo: 2, shelfFrom: 1, shelfTo: 3, pad: 2, order: 'column-first',
    });
    expect(out[0]).toEqual({ rack: 'C03', column: '01', shelf: '01' });
    expect(out[2]).toEqual({ rack: 'C03', column: '01', shelf: '03' });
    expect(out[3]).toEqual({ rack: 'C03', column: '02', shelf: '01' });
  });

  it('obsługuje wiele regałów po przecinku', () => {
    const out = expandBatch({ racks: 'C03, C04', colFrom: 1, colTo: 1, shelfFrom: 1, shelfTo: 2, pad: 2 });
    expect(out).toHaveLength(4);
    expect(out[0].rack).toBe('C03');
    expect(out[2].rack).toBe('C04');
  });

  it('stosuje zero-padding wg pad', () => {
    const out = expandBatch({ racks: 'A', colFrom: 7, colTo: 7, shelfFrom: 12, shelfTo: 12, pad: 3 });
    expect(out[0]).toEqual({ rack: 'A', column: '007', shelf: '012' });
  });

  it('zwraca pustą listę dla odwróconych zakresów', () => {
    const out = expandBatch({ racks: 'A', colFrom: 5, colTo: 1, shelfFrom: 1, shelfTo: 2, pad: 2 });
    expect(out).toHaveLength(0);
  });

  it('ogranicza wynik do MAX_BATCH', () => {
    const out = expandBatch({ racks: 'A', colFrom: 1, colTo: 100, shelfFrom: 1, shelfTo: 100, pad: 2 });
    expect(out).toHaveLength(MAX_BATCH);
  });
});
