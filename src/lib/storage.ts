import type { AppState } from '../types';
import { DEFAULT_STATE } from '../types';

const KEY = 'etkieciarka.v1';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AppState>;
      return {
        ...DEFAULT_STATE,
        ...p,
        config: { ...DEFAULT_STATE.config, ...p.config },
        single: { ...DEFAULT_STATE.single, ...p.single },
        batch: { ...DEFAULT_STATE.batch, ...p.batch },
      };
    }
  } catch {
    // uszkodzony zapis — wracamy do domyślnych
  }
  return DEFAULT_STATE;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function saveState(s: AppState): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // brak miejsca / tryb prywatny — ignorujemy
    }
  }, 300);
}
