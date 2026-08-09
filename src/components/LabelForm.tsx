import type { LabelData } from '../types';

export function LabelForm({
  value,
  onChange,
}: {
  value: LabelData;
  onChange: (v: LabelData) => void;
}) {
  return (
    <div className="field-grid">
      <label>
        Regał
        <input
          type="text"
          value={value.rack}
          onChange={(e) => onChange({ ...value, rack: e.target.value })}
          placeholder="C03"
        />
      </label>
      <label>
        Kolumna
        <input
          type="text"
          value={value.column}
          onChange={(e) => onChange({ ...value, column: e.target.value })}
          placeholder="06"
        />
      </label>
      <label>
        Półka
        <input
          type="text"
          value={value.shelf}
          onChange={(e) => onChange({ ...value, shelf: e.target.value })}
          placeholder="03"
        />
      </label>
    </div>
  );
}
