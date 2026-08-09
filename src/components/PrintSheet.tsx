import type { LabelConfig, LabelData } from '../types';
import { LabelPreview } from './LabelPreview';

/** Widoczny tylko w wydruku: każda etykieta to osobna strona o wymiarach etykiety. */
export function PrintSheet({ labels, config }: { labels: LabelData[]; config: LabelConfig }) {
  return (
    <div className="print-sheet">
      {labels.map((l, i) => (
        <div
          className="print-page"
          key={`${l.rack}-${l.column}-${l.shelf}-${i}`}
          style={{ width: `${config.widthMm}mm`, height: `${config.heightMm}mm` }}
        >
          <LabelPreview data={l} config={config} />
        </div>
      ))}
    </div>
  );
}
