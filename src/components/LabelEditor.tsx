import { useMemo, useRef, useState } from 'react';
import bwipjs from 'bwip-js/browser';
import type { LabelConfig, LabelData } from '../types';
import { SIZE_PRESETS } from '../types';
import { computeLayout } from '../lib/layout';

const FONT = "'Roboto Condensed', 'Arial Narrow', Arial, 'Helvetica Neue', sans-serif";
type Selection = 'rack' | 'column' | 'shelf' | 'barcode' | 'barcodeText' | null;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function LabelEditor({
  data,
  config,
  onDataChange,
  onConfigChange,
}: {
  data: LabelData;
  config: LabelConfig;
  onDataChange: (d: LabelData) => void;
  onConfigChange: (c: Partial<LabelConfig>) => void;
}) {
  const [selected, setSelected] = useState<Selection>('rack');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const L = computeLayout(config, data);
  const W = config.widthMm;
  const H = config.heightMm;

  const barcodeUri = useMemo(() => {
    if (!config.showBarcode || !L.barcode.code) return null;
    try {
      const svg = bwipjs.toSVG({ bcid: 'code128', text: L.barcode.code, height: 10, includetext: false });
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch {
      return null;
    }
  }, [config.showBarcode, L.barcode.code]);

  const presetIdx = SIZE_PRESETS.findIndex((p) => p.widthMm === W && p.heightMm === H);
  const rackAnchor = config.rackAlign === 'center' ? 'middle' : config.rackAlign === 'right' ? 'end' : 'start';
  const rackX = config.rackAlign === 'center'
    ? L.rack.x + L.rack.w / 2
    : config.rackAlign === 'right'
      ? L.rack.x + L.rack.w
      : L.rack.x;

  const selectBox = selected === 'rack' ? L.rack
    : selected === 'column' ? L.columnBar
      : selected === 'shelf' ? L.shelfRow
        : selected === 'barcode' ? L.barcode
          : selected === 'barcodeText' ? L.barcodeText
            : null;

  const beginRackResize = (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const startX = e.clientX;
    const start = config.rackWidthPercent;
    const rect = svg.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const deltaMm = ((ev.clientX - startX) / rect.width) * W;
      const usable = Math.max(1, W - config.marginLeftMm - config.marginRightMm - config.sectionGapMm);
      onConfigChange({ rackWidthPercent: clamp(start + (deltaMm / usable) * 100, 10, 90) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="editor-workspace">
      <div className="editor-toolbar">
        <div className="brand-mark">E</div>
        <div className="toolbar-group">
          <span className="toolbar-label">Etykieta</span>
          <select
            className="toolbar-select"
            value={presetIdx}
            onChange={(e) => {
              const p = SIZE_PRESETS[Number(e.target.value)];
              if (p) onConfigChange({ widthMm: p.widthMm, heightMm: p.heightMm });
            }}
            title="Rozmiar etykiety"
          >
            <option value={-1}>{W} × {H} mm</option>
            {SIZE_PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
          </select>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group compact">
          <button className={config.showRack ? 'tool-chip active' : 'tool-chip'} onClick={() => onConfigChange({ showRack: !config.showRack })}>Regał</button>
          <button className={config.showColumnBar ? 'tool-chip active' : 'tool-chip'} onClick={() => onConfigChange({ showColumnBar: !config.showColumnBar })}>Kolumna</button>
          <button className={config.showShelf ? 'tool-chip active' : 'tool-chip'} onClick={() => onConfigChange({ showShelf: !config.showShelf })}>Półka</button>
          <button className={config.showBarcode ? 'tool-chip active' : 'tool-chip'} onClick={() => onConfigChange({ showBarcode: !config.showBarcode })}>Kod</button>
        </div>
        <div className="toolbar-spacer" />
        <div className="size-readout">{W} × {H} mm</div>
      </div>

      <div className="canvas-stage" onClick={() => setSelected(null)}>
        <div className="label-canvas" style={{ aspectRatio: `${W} / ${H}` }}>
          <svg
            ref={svgRef}
            className="label-svg editor-svg"
            viewBox={`0 0 ${W} ${H}`}
            xmlns="http://www.w3.org/2000/svg"
            onClick={(e) => e.stopPropagation()}
          >
            <rect x={0} y={0} width={W} height={H} fill="#fff" />

            {L.dividers.map((dv, i) => <rect key={i} x={dv.x} y={dv.y} width={dv.w} height={dv.h} fill="#000" />)}

            {config.showRack && (
              <g className="editable-object" onClick={() => setSelected('rack')}>
                <rect x={L.rack.x} y={L.rack.y} width={L.rack.w} height={L.rack.h} fill="transparent" />
                <text x={rackX} y={L.rack.y + L.rack.h / 2} fontSize={L.rack.fontMm} fontFamily={FONT} fontWeight="bold" fill="#000" textAnchor={rackAnchor} dominantBaseline="central">{data.rack}</text>
              </g>
            )}

            {config.showColumnBar && (
              <g className="editable-object" onClick={() => setSelected('column')}>
                <rect x={L.columnBar.x} y={L.columnBar.y} width={L.columnBar.w} height={L.columnBar.h} fill="#000" />
                <text x={L.columnBar.x + L.inset} y={L.columnBar.y + L.columnBar.h / 2} fontSize={L.columnBar.labelFontMm} fontFamily={FONT} fontWeight="bold" fill="#fff" dominantBaseline="central">{config.columnLabel}</text>
                <text x={L.columnBar.x + L.columnBar.w - L.inset} y={L.columnBar.y + L.columnBar.h / 2} fontSize={L.columnBar.valueFontMm} fontFamily={FONT} fontWeight="bold" fill="#fff" textAnchor="end" dominantBaseline="central">{data.column}</text>
              </g>
            )}

            {config.showShelf && (
              <g className="editable-object" onClick={() => setSelected('shelf')}>
                <rect x={L.shelfRow.x} y={L.shelfRow.y} width={L.shelfRow.w} height={L.shelfRow.h} fill="transparent" />
                <text x={L.shelfRow.x + L.inset} y={L.shelfRow.y + L.shelfRow.h / 2} fontSize={L.shelfRow.labelFontMm} fontFamily={FONT} fontWeight="bold" fill="#000" dominantBaseline="central">{config.shelfLabel}</text>
                <text x={L.shelfRow.x + L.shelfRow.w - L.inset} y={L.shelfRow.y + L.shelfRow.h / 2} fontSize={L.shelfRow.valueFontMm} fontFamily={FONT} fontWeight="bold" fill="#000" textAnchor="end" dominantBaseline="central">{data.shelf}</text>
              </g>
            )}

            {barcodeUri && (
              <g className="editable-object" onClick={() => setSelected('barcode')}>
                <image href={barcodeUri} x={L.barcode.x} y={L.barcode.y} width={L.barcode.w} height={L.barcode.h} preserveAspectRatio="none" />
                <rect x={L.barcode.x} y={L.barcode.y} width={L.barcode.w} height={L.barcode.h} fill="transparent" />
              </g>
            )}

            {config.showBarcodeText && (
              <text className="editable-object" onClick={() => setSelected('barcodeText')} x={W / 2} y={L.barcodeText.y + L.barcodeText.h / 2} fontSize={L.barcodeText.fontMm} fontFamily={FONT} fontWeight={config.barcodeTextBold ? 'bold' : 'normal'} fill="#000" textAnchor="middle" dominantBaseline="central">{L.barcodeText.text}</text>
            )}

            {selectBox && (
              <g className="selection-overlay" pointerEvents="none">
                <rect x={selectBox.x} y={selectBox.y} width={selectBox.w} height={selectBox.h} fill="none" vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {selected === 'rack' && config.showRack && (config.showColumnBar || config.showShelf) && (
              <circle
                className="resize-handle"
                cx={L.rack.x + L.rack.w + config.sectionGapMm / 2}
                cy={L.rack.y + L.rack.h / 2}
                r={Math.max(0.9, W * 0.008)}
                onPointerDown={beginRackResize}
              />
            )}
          </svg>

          {selected && (
            <div className="floating-inspector" onClick={(e) => e.stopPropagation()}>
              {selected === 'rack' && (
                <>
                  <input className="inline-value large" value={data.rack} onChange={(e) => onDataChange({ ...data, rack: e.target.value })} aria-label="Kod regału" />
                  <div className="segmented">
                    {(['left', 'center', 'right'] as const).map((a) => <button key={a} className={config.rackAlign === a ? 'active' : ''} onClick={() => onConfigChange({ rackAlign: a })}>{a === 'left' ? '←' : a === 'center' ? '↔' : '→'}</button>)}
                  </div>
                  <label className="mini-control">Rozmiar <input type="range" min={0.5} max={1.5} step={0.05} value={config.rackFontScale} onChange={(e) => onConfigChange({ rackFontScale: Number(e.target.value) })} /></label>
                  <span className="inspector-hint">Przeciągnij niebieski uchwyt, aby zmienić szerokość sekcji.</span>
                </>
              )}

              {selected === 'column' && (
                <>
                  <input className="inline-value" value={config.columnLabel} onChange={(e) => onConfigChange({ columnLabel: e.target.value })} aria-label="Nagłówek kolumny" />
                  <input className="inline-value strong" value={data.column} onChange={(e) => onDataChange({ ...data, column: e.target.value })} aria-label="Numer kolumny" />
                  <label className="mini-control">Nagłówek <input type="range" min={0.5} max={1.5} step={0.05} value={config.headerFontScale} onChange={(e) => onConfigChange({ headerFontScale: Number(e.target.value) })} /></label>
                  <label className="mini-control">Wartość <input type="range" min={0.5} max={1.5} step={0.05} value={config.valueFontScale} onChange={(e) => onConfigChange({ valueFontScale: Number(e.target.value) })} /></label>
                </>
              )}

              {selected === 'shelf' && (
                <>
                  <input className="inline-value" value={config.shelfLabel} onChange={(e) => onConfigChange({ shelfLabel: e.target.value })} aria-label="Nagłówek półki" />
                  <input className="inline-value strong" value={data.shelf} onChange={(e) => onDataChange({ ...data, shelf: e.target.value })} aria-label="Numer półki" />
                  <label className="mini-control">Nagłówek <input type="range" min={0.5} max={1.5} step={0.05} value={config.headerFontScale} onChange={(e) => onConfigChange({ headerFontScale: Number(e.target.value) })} /></label>
                  <label className="mini-control">Wartość <input type="range" min={0.5} max={1.5} step={0.05} value={config.valueFontScale} onChange={(e) => onConfigChange({ valueFontScale: Number(e.target.value) })} /></label>
                </>
              )}

              {selected === 'barcode' && (
                <>
                  <input className="inline-value code" value={config.codeTemplate} onChange={(e) => onConfigChange({ codeTemplate: e.target.value })} aria-label="Szablon kodu" />
                  <label className="mini-control">Wysokość <input type="range" min={4} max={40} step={1} value={config.barcodeHeightMm} onChange={(e) => onConfigChange({ barcodeHeightMm: Number(e.target.value) })} /></label>
                  <label className="mini-control">Szerokość <input type="range" min={20} max={100} step={1} value={config.barcodeWidthPercent} onChange={(e) => onConfigChange({ barcodeWidthPercent: Number(e.target.value) })} /></label>
                  <button className="tool-chip active" onClick={() => onConfigChange({ showBarcodeText: !config.showBarcodeText })}>{config.showBarcodeText ? 'Tekst pod kodem ✓' : 'Pokaż tekst pod kodem'}</button>
                </>
              )}

              {selected === 'barcodeText' && (
                <>
                  <div className="inline-static">{L.barcodeText.text}</div>
                  <label className="mini-control">Rozmiar <input type="range" min={0.5} max={1.5} step={0.05} value={config.barcodeTextFontScale} onChange={(e) => onConfigChange({ barcodeTextFontScale: Number(e.target.value) })} /></label>
                  <button className={config.barcodeTextBold ? 'tool-chip active' : 'tool-chip'} onClick={() => onConfigChange({ barcodeTextBold: !config.barcodeTextBold })}><strong>B</strong> Pogrubienie</button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="canvas-footer">
          <span>Kliknij element, żeby go edytować</span>
          <span className="dot">•</span>
          <span>WYSIWYG → ZPL</span>
        </div>
      </div>
    </div>
  );
}
