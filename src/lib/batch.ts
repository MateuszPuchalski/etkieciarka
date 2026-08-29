import type { BatchSpec, LabelData } from '../types';

export const MAX_BATCH = 2000;

export function parseRacks(racks: string): string[] {
  return racks
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
}

/**
 * Rozwija zakresy do kolejności odpowiadającej fizycznemu naklejaniu.
 * Domyślnie drukujemy półka po półce: dla jednej półki wszystkie kolumny,
 * potem przechodzimy do następnej półki.
 */
export function expandBatch(b: BatchSpec): LabelData[] {
  const racks = parseRacks(b.racks);
  const padLen = Math.max(1, Math.min(4, Math.floor(b.pad) || 1));
  const pad = (n: number) => String(n).padStart(padLen, '0');
  const out: LabelData[] = [];
  const order = b.order ?? 'shelf-first';

  const push = (rack: string, column: number, shelf: number) => {
    if (out.length >= MAX_BATCH) return false;
    out.push({ rack, column: pad(column), shelf: pad(shelf) });
    return true;
  };

  for (const rack of racks) {
    if (order === 'column-first') {
      for (let c = b.colFrom; c <= b.colTo; c++) {
        for (let s = b.shelfFrom; s <= b.shelfTo; s++) {
          if (!push(rack, c, s)) return out;
        }
      }
    } else {
      for (let s = b.shelfFrom; s <= b.shelfTo; s++) {
        for (let c = b.colFrom; c <= b.colTo; c++) {
          if (!push(rack, c, s)) return out;
        }
      }
    }
  }

  return out;
}
