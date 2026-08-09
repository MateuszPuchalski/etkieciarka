function digitRun(s: string, i: number): number {
  let n = 0;
  while (i + n < s.length && s[i + n] >= '0' && s[i + n] <= '9') n++;
  return n;
}

/**
 * Szerokość symbolu Code128 w modułach dla danych zakodowanych algorytmem
 * zachłannym (podzbiory B/C jak w typowych enkoderach). Każdy symbol ma
 * 11 modułów, znak stop 13. Wynik służy do doboru szerokości modułu (^BY)
 * i wycentrowania kodu — drukarka koduje sama przez ^BC.
 */
export function code128Modules(data: string): number {
  const len = data.length;
  if (len === 0) return 0;
  let symbols = 1; // znak startu
  let i = 0;
  const startRun = digitRun(data, 0);
  let mode: 'B' | 'C' = startRun >= 4 || (startRun === len && len % 2 === 0 && len >= 2) ? 'C' : 'B';
  while (i < len) {
    const run = digitRun(data, i);
    if (mode === 'C') {
      if (run >= 2) {
        symbols++;
        i += 2;
      } else {
        mode = 'B';
        symbols++; // znak zmiany podzbioru
      }
    } else {
      if (run >= 6 || (run >= 4 && i + run === len)) {
        mode = 'C';
        symbols++; // znak zmiany podzbioru
        continue;
      }
      symbols++;
      i++;
    }
  }
  symbols++; // suma kontrolna
  return 11 * symbols + 13;
}
