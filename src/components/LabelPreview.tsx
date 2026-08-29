import { useMemo } from 'react';
import bwipjs from 'bwip-js/browser';
import type { LabelConfig, LabelData } from '../types';
import { computeLayout } from '../lib/layout';

const FONT = "'Roboto Condensed', 'Arial Narrow', Arial, 'Helvetica Neue', sans-serif";

export function LabelPreview({ data, config }: { data: LabelData; config: LabelConfig }) {
  const L = computeLayout(config, data);
  const W = config.widthMm;
  const H = config.heightMm;

  const barcodeUri = useMemo(() => {
    if (!config.showBarcode || !L.barcode.code) return null;
    try {
      const svg = bwipjs.toSVG({
        bcid: 'code128',
        text: L.barcode.code,
        height: 10,
        includetext: false,
      });
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch {
      return null;
    }
  }, [config.showBarcode, L.barcode.code]);

  const rackAnchor = config.rackAlign === 'center' ? 'middle' : config.rackAlign === 'right' ? 'end' : 'start';
  const rackX = config.rackAlign === 'center'
    ? L.rack.x + L.rack.w / 2
    : config.rackAlign === 'right'
      ? L.rack.x + L.rack.w
      : L.rack.x;

  return (
    <svg
      className="label-svg"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Etykieta ${L.barcode.code}`}
    >
      <rect x={0} y={0} width={W} height={H} fill="#fff" />

      {L.dividers.map((dv, i) => (
        <rect key={i} x={dv.x} y={dv.y} width={dv.w} height={dv.h} fill="#000" />
      ))}

      {config.showRack && (
        <text
          x={rackX}
          y={L.rack.y + L.rack.h / 2}
          fontSize={L.rack.fontMm}
          fontFamily={FONT}
          fontWeight="bold"
          fill="#000"
          textAnchor={rackAnchor}
          dominantBaseline="central"
        >
          {data.rack}
        </text>
      )}

      {config.showColumnBar && (
        <g>
          <rect x={L.columnBar.x} y={L.columnBar.y} width={L.columnBar.w} height={L.columnBar.h} fill="#000" />
          <text
            x={L.columnBar.x + L.inset}
            y={L.columnBar.y + L.columnBar.h / 2}
            fontSize={L.columnBar.labelFontMm}
            fontFamily={FONT}
            fontWeight="bold"
            fill="#fff"
            dominantBaseline="central"
          >
            {config.columnLabel}
          </text>
          <text
            x={L.columnBar.x + L.columnBar.w - L.inset}
            y={L.columnBar.y + L.columnBar.h / 2}
            fontSize={L.columnBar.valueFontMm}
            fontFamily={FONT}
            fontWeight="bold"
            fill="#fff"
            textAnchor="end"
            dominantBaseline="central"
          >
            {data.column}
          </text>
        </g>
      )}

      {config.showShelf && (
        <g>
          <text
            x={L.shelfRow.x + L.inset}
            y={L.shelfRow.y + L.shelfRow.h / 2}
            fontSize={L.shelfRow.labelFontMm}
            fontFamily={FONT}
            fontWeight="bold"
            fill="#000"
            dominantBaseline="central"
          >
            {config.shelfLabel}
          </text>
          <text
            x={L.shelfRow.x + L.shelfRow.w - L.inset}
            y={L.shelfRow.y + L.shelfRow.h / 2}
            fontSize={L.shelfRow.valueFontMm}
            fontFamily={FONT}
            fontWeight="bold"
            fill="#000"
            textAnchor="end"
            dominantBaseline="central"
          >
            {data.shelf}
          </text>
        </g>
      )}

      {barcodeUri && (
        <image
          href={barcodeUri}
          x={L.barcode.x}
          y={L.barcode.y}
          width={L.barcode.w}
          height={L.barcode.h}
          preserveAspectRatio="none"
        />
      )}

      {config.showBarcodeText && (
        <text
          x={L.barcodeText.x + L.barcodeText.w / 2}
          y={L.barcodeText.y + L.barcodeText.h / 2}
          fontSize={L.barcodeText.fontMm}
          fontFamily={FONT}
          fontWeight={config.barcodeTextBold ? 'bold' : 'normal'}
          fill="#000"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {L.barcodeText.text}
        </text>
      )}
    </svg>
  );
}
