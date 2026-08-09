import type { BatchSpec, LabelData } from '../types';

export const MAX_BATCH = 2000;

export function parseRacks(racks: string): string[] {
  return racks
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
}

/** Rozwija zakresy (regały × kolumny × półki) do listy etykiet, z limitem MAX_BATCH. */
export function expandBatch(b: BatchSpec): LabelData[] {
  const racks = parseRacks(b.racks);
  const padLen = Math.max(1, Math.min(4, Math.floor(b.pad) || 1));
  const pad = (n: number) => String(n).padStart(padLen, '0');
  const out: LabelData[] = [];
  for (const rack of racks) {
    for (let c = b.colFrom; c <= b.colTo; c++) {
      for (let s = b.shelfFrom; s <= b.shelfTo; s++) {
        if (out.length >= MAX_BATCH) return out;
        out.push({ rack, column: pad(c), shelf: pad(s) });
      }
    }
  }
  return out;
}
