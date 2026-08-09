import type { LabelConfig } from '../types';
import { SIZE_PRESETS } from '../types';

export function SettingsPanel({
  config,
  onChange,
}: {
  config: LabelConfig;
  onChange: (c: Partial<LabelConfig>) => void;
}) {
  const presetIdx = SIZE_PRESETS.findIndex(
    (p) => p.widthMm === config.widthMm && p.heightMm === config.heightMm,
  );

  const numInput =
    (key: 'widthMm' | 'heightMm' | 'barcodeHeightMm', min: number, max: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseFloat(e.target.value);
      if (Number.isFinite(n)) onChange({ [key]: Math.min(max, Math.max(min, n)) });
    };

  return (
    <div className="settings">
      <h3>Rozmiar i drukarka</h3>
      <div className="field-grid">
        <label className="span-3">
          Preset rozmiaru
          <select
            value={presetIdx}
            onChange={(e) => {
              const p = SIZE_PRESETS[parseInt(e.target.value, 10)];
              if (p) onChange({ widthMm: p.widthMm, heightMm: p.heightMm });
            }}
          >
            <option value={-1}>— własny rozmiar —</option>
            {SIZE_PRESETS.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Szerokość [mm]
          <input type="number" min={20} max={300} step={1} value={config.widthMm} onChange={numInput('widthMm', 20, 300)} />
        </label>
        <label>
          Wysokość [mm]
          <input type="number" min={15} max={300} step={1} value={config.heightMm} onChange={numInput('heightMm', 15, 300)} />
        </label>
        <label>
          Rozdzielczość
          <select
            value={config.dpi}
            onChange={(e) => onChange({ dpi: parseInt(e.target.value, 10) === 300 ? 300 : 203 })}
          >
            <option value={203}>203 dpi</option>
            <option value={300}>300 dpi</option>
          </select>
        </label>
      </div>

      <h3>Układ etykiety</h3>
      <div className="field-grid">
        <label>
          Wielkość kodu regału ({config.rackFontScale.toFixed(2)}×)
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={config.rackFontScale}
            onChange={(e) => onChange({ rackFontScale: parseFloat(e.target.value) })}
          />
        </label>
        <label>
          Wielkość nagłówków ({config.headerFontScale.toFixed(2)}×)
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={config.headerFontScale}
            onChange={(e) => onChange({ headerFontScale: parseFloat(e.target.value) })}
          />
        </label>
        <label>
          Wysokość kodu kresk. [mm]
          <input
            type="number"
            min={4}
            max={40}
            step={1}
            value={config.barcodeHeightMm}
            onChange={numInput('barcodeHeightMm', 4, 40)}
          />
        </label>
      </div>
      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={config.showColumnBar}
            onChange={(e) => onChange({ showColumnBar: e.target.checked })}
          />
          Pasek kolumny
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.showShelf}
            onChange={(e) => onChange({ showShelf: e.target.checked })}
          />
          Wiersz półki
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.showBarcode}
            onChange={(e) => onChange({ showBarcode: e.target.checked })}
          />
          Kod kreskowy
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.showBarcodeText}
            onChange={(e) => onChange({ showBarcodeText: e.target.checked })}
          />
          Tekst pod kodem
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.showDividers}
            onChange={(e) => onChange({ showDividers: e.target.checked })}
          />
          Linie podziału
        </label>
      </div>

      <h3>Teksty</h3>
      <div className="field-grid">
        <label>
          Etykieta kolumny
          <input
            type="text"
            value={config.columnLabel}
            onChange={(e) => onChange({ columnLabel: e.target.value })}
          />
        </label>
        <label>
          Etykieta półki
          <input
            type="text"
            value={config.shelfLabel}
            onChange={(e) => onChange({ shelfLabel: e.target.value })}
          />
        </label>
        <label>
          Szablon kodu
          <input
            type="text"
            value={config.codeTemplate}
            onChange={(e) => onChange({ codeTemplate: e.target.value })}
            placeholder="{regal}-{kolumna}-{polka}"
          />
        </label>
      </div>
      <p className="hint">
        Szablon kodu: {'{regal}'}, {'{kolumna}'}, {'{polka}'} zostaną zastąpione wartościami.
      </p>
      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={config.asciiFallback}
            onChange={(e) => onChange({ asciiFallback: e.target.checked })}
          />
          Zamień polskie znaki w ZPL (tryb zgodności ze starym firmware)
        </label>
      </div>
    </div>
  );
}
