import { useMemo, useRef, useState } from 'react';
import bwipjs from 'bwip-js/browser';
import type { LabelConfig, LabelData } from '../types';
import { SIZE_PRESETS } from '../types';
import { computeLayout, type Box } from '../lib/layout';

const FONT = "'Roboto Condensed', 'Arial Narrow', Arial, 'Helvetica Neue', sans-serif";
type Selection = 'rack' | 'column' | 'shelf' | 'barcode' | 'barcodeText' | null;
type Snapshot = { config: LabelConfig; data: LabelData };
type Guides = { x?: number; y?: number };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function LabelEditor({ data, config, onDataChange, onConfigChange }: {
  data: LabelData;
  config: LabelConfig;
  onDataChange: (d: LabelData) => void;
  onConfigChange: (c: Partial<LabelConfig>) => void;
}) {
  const [selected, setSelected] = useState<Selection>('rack');
  const [guides, setGuides] = useState<Guides>({});
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const L = computeLayout(config, data);
  const W = config.widthMm;
  const H = config.heightMm;

  const barcodeUri = useMemo(() => {
    if (!config.showBarcode || !L.barcode.code) return null;
    try {
      const svg = bwipjs.toSVG({ bcid: 'code128', text: L.barcode.code, height: 10, includetext: false });
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch { return null; }
  }, [config.showBarcode, L.barcode.code]);

  const presetIdx = SIZE_PRESETS.findIndex((p) => p.widthMm === W && p.heightMm === H);
  const rackAnchor = config.rackAlign === 'center' ? 'middle' : config.rackAlign === 'right' ? 'end' : 'start';
  const rackX = config.rackAlign === 'center' ? L.rack.x + L.rack.w / 2 : config.rackAlign === 'right' ? L.rack.x + L.rack.w : L.rack.x;
  const selectBox = selected === 'rack' ? L.rack : selected === 'column' ? L.columnBar : selected === 'shelf' ? L.shelfRow : selected === 'barcode' ? L.barcode : selected === 'barcodeText' ? L.barcodeText : null;

  const snapshot = (): Snapshot => ({ config: { ...config }, data: { ...data } });
  const checkpoint = () => { setPast((p) => [...p.slice(-39), snapshot()]); setFuture([]); };
  const restore = (s: Snapshot) => { onConfigChange(s.config); onDataChange(s.data); };
  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [snapshot(), ...f].slice(0, 40));
    restore(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p.slice(-39), snapshot()]);
    restore(next);
  };
  const changeConfig = (c: Partial<LabelConfig>) => { checkpoint(); onConfigChange(c); };
  const changeData = (d: LabelData) => { checkpoint(); onDataChange(d); };

  const mmDelta = (dx: number, dy: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: dx / rect.width * W, y: dy / rect.height * H };
  };

  const snapBox = (box: Box, x: number, y: number) => {
    const threshold = 1.1;
    const xTargets = [config.marginLeftMm, W / 2, W - config.marginRightMm];
    const yTargets = [config.marginTopMm, H / 2, H - config.marginBottomMm];
    const xPoints = [x, x + box.w / 2, x + box.w];
    const yPoints = [y, y + box.h / 2, y + box.h];
    let sx = x, sy = y, gx: number | undefined, gy: number | undefined;
    outerX: for (const t of xTargets) for (const p of xPoints) if (Math.abs(p - t) <= threshold) { sx += t - p; gx = t; break outerX; }
    outerY: for (const t of yTargets) for (const p of yPoints) if (Math.abs(p - t) <= threshold) { sy += t - p; gy = t; break outerY; }
    return { x: sx, y: sy, guides: { x: gx, y: gy } as Guides };
  };

  const dragKeys = (sel: Exclude<Selection, null>) => {
    if (sel === 'rack') return ['rackOffsetX', 'rackOffsetY'] as const;
    if (sel === 'column' || sel === 'shelf') return ['rightOffsetX', 'rightOffsetY'] as const;
    if (sel === 'barcode') return ['barcodeOffsetX', 'barcodeOffsetY'] as const;
    return ['barcodeTextOffsetX', 'barcodeTextOffsetY'] as const;
  };

  const beginDrag = (sel: Exclude<Selection, null>, box: Box, e: React.PointerEvent<SVGGElement | SVGTextElement>) => {
    e.preventDefault(); e.stopPropagation(); setSelected(sel); checkpoint();
    const startX = e.clientX, startY = e.clientY;
    const [kx, ky] = dragKeys(sel);
    const ox = Number(config[kx]), oy = Number(config[ky]);
    const move = (ev: PointerEvent) => {
      const d = mmDelta(ev.clientX - startX, ev.clientY - startY);
      const snapped = snapBox(box, box.x + d.x, box.y + d.y);
      setGuides(snapped.guides);
      onConfigChange({ [kx]: ox + snapped.x - box.x, [ky]: oy + snapped.y - box.y } as Partial<LabelConfig>);
    };
    const up = () => { setGuides({}); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const beginResize = (sel: Exclude<Selection, null>, e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault(); e.stopPropagation(); checkpoint();
    const startX = e.clientX, startY = e.clientY;
    const start = { ...config };
    const move = (ev: PointerEvent) => {
      const d = mmDelta(ev.clientX - startX, ev.clientY - startY);
      if (sel === 'rack') {
        const usable = Math.max(1, W - config.marginLeftMm - config.marginRightMm - config.sectionGapMm);
        onConfigChange({ rackWidthPercent: clamp(start.rackWidthPercent + d.x / usable * 100, 10, 90) });
      } else if (sel === 'column' || sel === 'shelf') {
        const topH = Math.max(4, H - config.marginTopMm - config.marginBottomMm - config.barcodeHeightMm - 5);
        onConfigChange({ rightRowHeightPercent: clamp(start.rightRowHeightPercent + d.y / topH * 100, 20, 50) });
      } else if (sel === 'barcode') {
        const innerW = Math.max(1, W - config.marginLeftMm - config.marginRightMm);
        onConfigChange({
          barcodeWidthPercent: clamp(start.barcodeWidthPercent + d.x / innerW * 100, 20, 100),
          barcodeHeightMm: clamp(start.barcodeHeightMm + d.y, 4, 40),
        });
      } else {
        onConfigChange({ barcodeTextFontScale: clamp(start.barcodeTextFontScale + d.y / 12, 0.5, 1.5) });
      }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const beginMarginDrag = (side: 'left' | 'right' | 'top' | 'bottom', e: React.PointerEvent<SVGLineElement>) => {
    e.preventDefault(); e.stopPropagation(); checkpoint();
    const move = (ev: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect(); if (!rect) return;
      const x = clamp((ev.clientX - rect.left) / rect.width * W, 0, W * .45);
      const y = clamp((ev.clientY - rect.top) / rect.height * H, 0, H * .45);
      if (side === 'left') onConfigChange({ marginLeftMm: x });
      if (side === 'right') onConfigChange({ marginRightMm: clamp(W - (ev.clientX - rect.left) / rect.width * W, 0, W * .45) });
      if (side === 'top') onConfigChange({ marginTopMm: y });
      if (side === 'bottom') onConfigChange({ marginBottomMm: clamp(H - (ev.clientY - rect.top) / rect.height * H, 0, H * .45) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  return (
    <div className="editor-workspace">
      <div className="editor-toolbar">
        <div className="brand-mark">E</div>
        <div className="toolbar-group"><span className="toolbar-label">Etykieta</span><select className="toolbar-select" value={presetIdx} onChange={(e) => { const p = SIZE_PRESETS[Number(e.target.value)]; if (p) changeConfig({ widthMm: p.widthMm, heightMm: p.heightMm }); }}><option value={-1}>{W} × {H} mm</option>{SIZE_PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</select></div>
        <div className="toolbar-divider" />
        <div className="toolbar-group compact">
          <button className="history-button" disabled={!past.length} onClick={undo} title="Cofnij">↶</button><button className="history-button" disabled={!future.length} onClick={redo} title="Ponów">↷</button>
          <button className={config.showRack ? 'tool-chip active' : 'tool-chip'} onClick={() => changeConfig({ showRack: !config.showRack })}>Regał</button><button className={config.showColumnBar ? 'tool-chip active' : 'tool-chip'} onClick={() => changeConfig({ showColumnBar: !config.showColumnBar })}>Kolumna</button><button className={config.showShelf ? 'tool-chip active' : 'tool-chip'} onClick={() => changeConfig({ showShelf: !config.showShelf })}>Półka</button><button className={config.showBarcode ? 'tool-chip active' : 'tool-chip'} onClick={() => changeConfig({ showBarcode: !config.showBarcode })}>Kod</button>
        </div>
        <div className="toolbar-spacer" /><div className="size-readout">{W} × {H} mm</div>
      </div>

      <div className="canvas-stage" onClick={() => setSelected(null)}><div className="label-canvas" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg ref={svgRef} className="label-svg editor-svg" viewBox={`0 0 ${W} ${H}`} onClick={(e) => e.stopPropagation()}>
          <rect x={0} y={0} width={W} height={H} fill="#fff" />
          <g className="margin-guides">
            <line x1={config.marginLeftMm} y1={0} x2={config.marginLeftMm} y2={H} onPointerDown={(e) => beginMarginDrag('left', e)} /><line x1={W - config.marginRightMm} y1={0} x2={W - config.marginRightMm} y2={H} onPointerDown={(e) => beginMarginDrag('right', e)} /><line x1={0} y1={config.marginTopMm} x2={W} y2={config.marginTopMm} onPointerDown={(e) => beginMarginDrag('top', e)} /><line x1={0} y1={H - config.marginBottomMm} x2={W} y2={H - config.marginBottomMm} onPointerDown={(e) => beginMarginDrag('bottom', e)} />
          </g>
          {guides.x !== undefined && <line className="snap-guide" x1={guides.x} y1={0} x2={guides.x} y2={H} />}{guides.y !== undefined && <line className="snap-guide" x1={0} y1={guides.y} x2={W} y2={guides.y} />}
          {L.dividers.map((dv, i) => <rect key={i} x={dv.x} y={dv.y} width={dv.w} height={dv.h} fill="#000" />)}

          {config.showRack && <g className="editable-object draggable" onPointerDown={(e) => beginDrag('rack', L.rack, e)}><rect x={L.rack.x} y={L.rack.y} width={L.rack.w} height={L.rack.h} fill="transparent" /><text x={rackX} y={L.rack.y + L.rack.h / 2} fontSize={L.rack.fontMm} fontFamily={FONT} fontWeight="bold" textAnchor={rackAnchor} dominantBaseline="central">{data.rack}</text></g>}
          {config.showColumnBar && <g className="editable-object draggable" onPointerDown={(e) => beginDrag('column', L.columnBar, e)}><rect x={L.columnBar.x} y={L.columnBar.y} width={L.columnBar.w} height={L.columnBar.h} fill="#000" /><text x={L.columnBar.x + L.inset} y={L.columnBar.y + L.columnBar.h / 2} fontSize={L.columnBar.labelFontMm} fontFamily={FONT} fontWeight="bold" fill="#fff" dominantBaseline="central">{config.columnLabel}</text><text x={L.columnBar.x + L.columnBar.w - L.inset} y={L.columnBar.y + L.columnBar.h / 2} fontSize={L.columnBar.valueFontMm} fontFamily={FONT} fontWeight="bold" fill="#fff" textAnchor="end" dominantBaseline="central">{data.column}</text></g>}
          {config.showShelf && <g className="editable-object draggable" onPointerDown={(e) => beginDrag('shelf', L.shelfRow, e)}><rect x={L.shelfRow.x} y={L.shelfRow.y} width={L.shelfRow.w} height={L.shelfRow.h} fill="transparent" /><text x={L.shelfRow.x + L.inset} y={L.shelfRow.y + L.shelfRow.h / 2} fontSize={L.shelfRow.labelFontMm} fontFamily={FONT} fontWeight="bold" dominantBaseline="central">{config.shelfLabel}</text><text x={L.shelfRow.x + L.shelfRow.w - L.inset} y={L.shelfRow.y + L.shelfRow.h / 2} fontSize={L.shelfRow.valueFontMm} fontFamily={FONT} fontWeight="bold" textAnchor="end" dominantBaseline="central">{data.shelf}</text></g>}
          {barcodeUri && <g className="editable-object draggable" onPointerDown={(e) => beginDrag('barcode', L.barcode, e)}><image href={barcodeUri} x={L.barcode.x} y={L.barcode.y} width={L.barcode.w} height={L.barcode.h} preserveAspectRatio="none" /><rect x={L.barcode.x} y={L.barcode.y} width={L.barcode.w} height={L.barcode.h} fill="transparent" /></g>}
          {config.showBarcodeText && <text className="editable-object draggable" onPointerDown={(e) => beginDrag('barcodeText', L.barcodeText, e)} x={L.barcodeText.x + L.barcodeText.w / 2} y={L.barcodeText.y + L.barcodeText.h / 2} fontSize={L.barcodeText.fontMm} fontFamily={FONT} fontWeight={config.barcodeTextBold ? 'bold' : 'normal'} textAnchor="middle" dominantBaseline="central">{L.barcodeText.text}</text>}

          {selectBox && <g className="selection-overlay" pointerEvents="none"><rect x={selectBox.x} y={selectBox.y} width={selectBox.w} height={selectBox.h} fill="none" vectorEffect="non-scaling-stroke" /></g>}
          {selected && selectBox && <circle className="resize-handle resize-se" cx={selectBox.x + selectBox.w} cy={selectBox.y + selectBox.h} r={Math.max(.85, W * .008)} onPointerDown={(e) => beginResize(selected, e)} />}
        </svg>

        {selected && <div className="floating-inspector" onClick={(e) => e.stopPropagation()}>
          {selected === 'rack' && <><input className="inline-value large" value={data.rack} onFocus={checkpoint} onChange={(e) => onDataChange({ ...data, rack: e.target.value })} /><div className="segmented">{(['left','center','right'] as const).map((a) => <button key={a} className={config.rackAlign === a ? 'active' : ''} onClick={() => changeConfig({ rackAlign: a })}>{a === 'left' ? '←' : a === 'center' ? '↔' : '→'}</button>)}</div><label className="mini-control">Rozmiar <input type="range" min={.5} max={1.5} step={.05} value={config.rackFontScale} onPointerDown={checkpoint} onChange={(e) => onConfigChange({ rackFontScale: Number(e.target.value) })} /></label></>}
          {selected === 'column' && <><input className="inline-value" value={config.columnLabel} onFocus={checkpoint} onChange={(e) => onConfigChange({ columnLabel: e.target.value })} /><input className="inline-value strong" value={data.column} onFocus={checkpoint} onChange={(e) => onDataChange({ ...data, column: e.target.value })} /><label className="mini-control">Nagłówek <input type="range" min={.5} max={1.5} step={.05} value={config.headerFontScale} onPointerDown={checkpoint} onChange={(e) => onConfigChange({ headerFontScale: Number(e.target.value) })} /></label></>}
          {selected === 'shelf' && <><input className="inline-value" value={config.shelfLabel} onFocus={checkpoint} onChange={(e) => onConfigChange({ shelfLabel: e.target.value })} /><input className="inline-value strong" value={data.shelf} onFocus={checkpoint} onChange={(e) => onDataChange({ ...data, shelf: e.target.value })} /></>}
          {selected === 'barcode' && <><input className="inline-value code" value={config.codeTemplate} onFocus={checkpoint} onChange={(e) => onConfigChange({ codeTemplate: e.target.value })} /><span className="inspector-hint">Przeciągnij narożnik, aby zmienić szerokość i wysokość.</span></>}
          {selected === 'barcodeText' && <><div className="inline-static">{L.barcodeText.text}</div><button className={config.barcodeTextBold ? 'tool-chip active' : 'tool-chip'} onClick={() => changeConfig({ barcodeTextBold: !config.barcodeTextBold })}><strong>B</strong> Pogrubienie</button></>}
          <button className="reset-position" onClick={() => { checkpoint(); if (selected === 'rack') onConfigChange({ rackOffsetX:0,rackOffsetY:0 }); if (selected === 'column'||selected === 'shelf') onConfigChange({ rightOffsetX:0,rightOffsetY:0 }); if (selected === 'barcode') onConfigChange({ barcodeOffsetX:0,barcodeOffsetY:0 }); if (selected === 'barcodeText') onConfigChange({ barcodeTextOffsetX:0,barcodeTextOffsetY:0 }); }}>Wyzeruj pozycję</button>
        </div>}
      </div><div className="canvas-footer"><span>Przeciągaj elementy i krawędzie marginesów</span><span className="dot">•</span><span>Snap do marginesów i środka</span><span className="dot">•</span><span>WYSIWYG → ZPL</span></div></div>
    </div>
  );
}
