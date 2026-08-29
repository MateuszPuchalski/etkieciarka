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
    (key: keyof LabelConfig, min: number, max: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseFloat(e.target.value);
      if (Number.isFinite(n)) onChange({ [key]: Math.min(max, Math.max(min, n)) } as Partial<LabelConfig>);
    };

  const range = (
    key: keyof LabelConfig,
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    suffix = '',
  ) => (
    <label>
      {label} ({value}{suffix})
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={numInput(key, min, max)}
      />
    </label>
  );

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
              <option key={p.name} value={i}>{p.name}</option>
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
          <select value={config.dpi} onChange={(e) => onChange({ dpi: parseInt(e.target.value, 10) === 300 ? 300 : 203 })}>
            <option value={203}>203 dpi</option>
            <option value={300}>300 dpi</option>
          </select>
        </label>
      </div>

      <h3>Widoczność elementów</h3>
      <div className="checkbox-row">
        <label><input type="checkbox" checked={config.showRack} onChange={(e) => onChange({ showRack: e.target.checked })} />Regał</label>
        <label><input type="checkbox" checked={config.showColumnBar} onChange={(e) => onChange({ showColumnBar: e.target.checked })} />Pasek kolumny</label>
        <label><input type="checkbox" checked={config.showShelf} onChange={(e) => onChange({ showShelf: e.target.checked })} />Wiersz półki</label>
        <label><input type="checkbox" checked={config.showBarcode} onChange={(e) => onChange({ showBarcode: e.target.checked })} />Kod kreskowy</label>
        <label><input type="checkbox" checked={config.showBarcodeText} onChange={(e) => onChange({ showBarcodeText: e.target.checked })} />Tekst pod kodem</label>
        <label><input type="checkbox" checked={config.showDividers} onChange={(e) => onChange({ showDividers: e.target.checked })} />Linie podziału</label>
      </div>

      <h3>Geometria etykiety</h3>
      <div className="field-grid">
        <label>
          Margines wewnętrzny [mm]
          <input type="number" min={0} max={15} step={0.5} value={config.contentPaddingMm} onChange={numInput('contentPaddingMm', 0, 15)} />
        </label>
        <label>
          Odstęp między sekcjami [mm]
          <input type="number" min={0} max={20} step={0.5} value={config.sectionGapMm} onChange={numInput('sectionGapMm', 0, 20)} />
        </label>
        <label>
          Odstęp kolumna / półka [mm]
          <input type="number" min={0} max={20} step={0.5} value={config.rowGapMm} onChange={numInput('rowGapMm', 0, 20)} />
        </label>
        {range('rackWidthPercent', 'Szerokość sekcji regału', 10, 90, 1, config.rackWidthPercent, '%')}
        {range('rightRowHeightPercent', 'Wysokość wierszy prawej sekcji', 20, 50, 1, config.rightRowHeightPercent, '%')}
        <label>
          Grubość linii [mm]
          <input type="number" min={0.15} max={2} step={0.05} value={config.dividerThicknessMm} onChange={numInput('dividerThicknessMm', 0.15, 2)} />
        </label>
      </div>

      <h3>Tekst i proporcje</h3>
      <div className="field-grid">
        {range('rackFontScale', 'Wielkość kodu regału', 0.5, 1.5, 0.05, Number(config.rackFontScale.toFixed(2)), '×')}
        {range('headerFontScale', 'Wielkość nagłówków', 0.5, 1.5, 0.05, Number(config.headerFontScale.toFixed(2)), '×')}
        {range('valueFontScale', 'Wielkość wartości', 0.5, 1.5, 0.05, Number(config.valueFontScale.toFixed(2)), '×')}
        {range('barcodeTextFontScale', 'Tekst pod kodem', 0.5, 1.5, 0.05, Number(config.barcodeTextFontScale.toFixed(2)), '×')}
        <label>
          Wyrównanie regału
          <select value={config.rackAlign} onChange={(e) => onChange({ rackAlign: e.target.value as LabelConfig['rackAlign'] })}>
            <option value="left">Do lewej</option>
            <option value="center">Środek</option>
            <option value="right">Do prawej</option>
          </select>
        </label>
      </div>

      <h3>Kod kreskowy</h3>
      <div className="field-grid">
        <label>
          Wysokość [mm]
          <input type="number" min={4} max={40} step={1} value={config.barcodeHeightMm} onChange={numInput('barcodeHeightMm', 4, 40)} />
        </label>
        {range('barcodeWidthPercent', 'Maksymalna szerokość', 20, 100, 1, config.barcodeWidthPercent, '%')}
      </div>

      <h3>Teksty</h3>
      <div className="field-grid">
        <label>
          Etykieta kolumny
          <input type="text" value={config.columnLabel} onChange={(e) => onChange({ columnLabel: e.target.value })} />
        </label>
        <label>
          Etykieta półki
          <input type="text" value={config.shelfLabel} onChange={(e) => onChange({ shelfLabel: e.target.value })} />
        </label>
        <label>
          Szablon kodu
          <input type="text" value={config.codeTemplate} onChange={(e) => onChange({ codeTemplate: e.target.value })} placeholder="{regal}-{kolumna}-{polka}" />
        </label>
      </div>
      <p className="hint">
        Szablon kodu: {'{regal}'}, {'{kolumna}'}, {'{polka}'} zostaną zastąpione wartościami.
      </p>
      <div className="checkbox-row">
        <label>
          <input type="checkbox" checked={config.asciiFallback} onChange={(e) => onChange({ asciiFallback: e.target.checked })} />
          Zamień polskie znaki w ZPL (tryb zgodności ze starym firmware)
        </label>
      </div>
    </div>
  );
}
