import type { AppState, LabelConfig } from '../types';
import { DEFAULT_STATE } from '../types';

const KEY = 'etkieciarka.v1';

/**
 * Rozpoznaje poprzedni, nietknięty układ startowy. Dzięki temu możemy
 * zaktualizować domyślny wygląd istniejącym użytkownikom bez nadpisywania
 * ich własnych, ręcznie ustawionych projektów.
 */
function isLegacyDefaultLayout(config: Partial<LabelConfig> | undefined): boolean {
  if (!config) return false;
  return config.widthMm === 80
    && config.heightMm === 50
    && config.marginTopMm === 3
    && config.marginRightMm === 3
    && config.marginBottomMm === 3
    && config.marginLeftMm === 3
    && config.sectionGapMm === 2
    && config.rackWidthPercent === 42
    && config.rowGapMm === 3
    && config.rackFontScale === 1
    && config.headerFontScale === 1
    && config.valueFontScale === 1
    && config.barcodeHeightMm === 12
    && config.barcodeWidthPercent === 100
    && (config.shelfLabel === 'Półka' || config.shelfLabel === undefined);
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AppState>;
      const migrateDefault = isLegacyDefaultLayout(p.config);
      return {
        ...DEFAULT_STATE,
        ...p,
        config: migrateDefault
          ? { ...DEFAULT_STATE.config }
          : { ...DEFAULT_STATE.config, ...p.config },
        single: migrateDefault && p.single?.rack === 'C03' && p.single?.column === '06' && p.single?.shelf === '03'
          ? { ...DEFAULT_STATE.single }
          : { ...DEFAULT_STATE.single, ...p.single },
        batch: migrateDefault && p.batch?.racks === 'C03'
          ? { ...DEFAULT_STATE.batch }
          : { ...DEFAULT_STATE.batch, ...p.batch },
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
