import type { BatchSpec } from '../types';
import { expandBatch, MAX_BATCH, parseRacks } from '../lib/batch';
import { renderCode } from '../lib/layout';

export function BatchPanel({
  value,
  codeTemplate,
  onChange,
}: {
  value: BatchSpec;
  codeTemplate: string;
  onChange: (v: BatchSpec) => void;
}) {
  const num =
    (key: 'colFrom' | 'colTo' | 'shelfFrom' | 'shelfTo' | 'pad') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseInt(e.target.value, 10);
      onChange({ ...value, [key]: Number.isFinite(n) ? n : 0 });
    };

  const labels = expandBatch(value);
  const racks = parseRacks(value.racks);
  const total =
    racks.length *
    Math.max(0, value.colTo - value.colFrom + 1) *
    Math.max(0, value.shelfTo - value.shelfFrom + 1);
  const preview = labels.slice(0, 8).map((l) => renderCode(codeTemplate, l));
  const order = value.order ?? 'shelf-first';

  return (
    <div>
      <div className="field-grid">
        <label className="span-3">
          Regały (po przecinku)
          <input
            type="text"
            value={value.racks}
            onChange={(e) => onChange({ ...value, racks: e.target.value })}
            placeholder="C03, C04"
          />
        </label>
        <label>
          Kolumna od
          <input type="number" value={value.colFrom} onChange={num('colFrom')} />
        </label>
        <label>
          Kolumna do
          <input type="number" value={value.colTo} onChange={num('colTo')} />
        </label>
        <label>
          Liczba cyfr
          <input type="number" min={1} max={4} value={value.pad} onChange={num('pad')} />
        </label>
        <label>
          Półka od
          <input type="number" value={value.shelfFrom} onChange={num('shelfFrom')} />
        </label>
        <label>
          Półka do
          <input type="number" value={value.shelfTo} onChange={num('shelfTo')} />
        </label>
      </div>

      <div className="batch-order-block">
        <span className="batch-order-title">Kolejność na rolce</span>
        <div className="segmented full">
          <button
            type="button"
            className={order === 'shelf-first' ? 'active' : ''}
            onClick={() => onChange({ ...value, order: 'shelf-first' })}
          >
            Półka po półce
          </button>
          <button
            type="button"
            className={order === 'column-first' ? 'active' : ''}
            onClick={() => onChange({ ...value, order: 'column-first' })}
          >
            Kolumna po kolumnie
          </button>
        </div>
        <small>
          {order === 'shelf-first'
            ? 'Najpierw wszystkie kolumny na jednej półce, potem kolejna półka — wygodne przy naklejaniu wzdłuż regału.'
            : 'Najpierw wszystkie półki jednej kolumny, potem kolejna kolumna.'}
        </small>
      </div>

      <p className="batch-info">
        Etykiet w serii: <strong>{labels.length}</strong>
        {total > MAX_BATCH && ` (obcięto do limitu ${MAX_BATCH})`}
      </p>
      {preview.length > 0 && (
        <p className="batch-preview" title="Pierwsze etykiety w dokładnej kolejności wydruku">
          <strong>Kolejność druku:</strong> {preview.join(' → ')}
          {labels.length > preview.length && ' → …'}
        </p>
      )}
    </div>
  );
}
