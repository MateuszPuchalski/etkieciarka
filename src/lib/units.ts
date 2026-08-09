/** Przeliczenie milimetrów na doty drukarki (203 dpi ≈ 8 d/mm, 300 dpi ≈ 11,81 d/mm). */
export function mmToDots(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
