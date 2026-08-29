import { useEffect, useMemo, useRef, useState } from 'react';
import bwipjs from 'bwip-js/browser';
import type { LabelConfig, LabelData } from '../types';
import { DEFAULT_CONFIG, SIZE_PRESETS } from '../types';
import { computeLayout, type Box } from '../lib/layout';

const FONT = "'Roboto Condensed', 'Arial Narrow', Arial, 'Helvetica Neue', sans-serif";
type ElementId = 'rack' | 'column' | 'shelf' | 'barcode' | 'barcodeText';
type Selection = ElementId | null;
type Snapshot = { config: LabelConfig; data: LabelData };
type Guides = { x?: number; y?: number };
type InspectorView = 'element' | 'printer' | 'templates';
type EditMode = 'design' | 'data';
type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type SavedTemplate = { name: string; config: LabelConfig };

const CUSTOM_TEMPLATES_KEY = 'etkieciarka.templates.v1';
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const roundMm = (n: number) => Math.round(n * 10) / 10;

const BUILTIN_TEMPLATES: Array<{ name: string; description: string; patch: Partial<LabelConfig> }> = [
  {
    name: 'Magazyn — standard',
    description: 'Klasyczny układ regał + kolumna/półka + barcode.',
    patch: {
      showRack: true, showColumnBar: true, showShelf: true, showBarcode: true, showBarcodeText: true,
      rackWidthPercent: 42, rackFontScale: 1, headerFontScale: 1, valueFontScale: 1,
      barcodeHeightMm: 12, barcodeWidthPercent: 100, showDividers: true,
    },
  },
  {
    name: 'Duży regał',
    description: 'Więcej miejsca na kod regału, mniejsza prawa sekcja.',
    patch: {
      showRack: true, showColumnBar: true, showShelf: true, showBarcode: true, showBarcodeText: true,
      rackWidthPercent: 56, rackFontScale: 1.25, rightRowHeightPercent: 42, barcodeHeightMm: 10,
    },
  },
  {
    name: 'Minimal',
    description: 'Kod regału i barcode bez prawej sekcji.',
    patch: {
      showRack: true, showColumnBar: false, showShelf: false, showBarcode: true, showBarcodeText: true,
      rackWidthPercent: 90, rackFontScale: 0.95, barcodeHeightMm: 14, showDividers: true,
    },
  },
];

function readTemplates(): SavedTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) as SavedTemplate[] : [];
  } catch {
    return [];
  }
}

function elementName(id: ElementId): string {
  if (id === 'rack') return 'Regał';
  if (id === 'column') return 'Kolumna';
  if (id === 'shelf') return 'Półka';
  if (id === 'barcode') return 'Kod kreskowy';
  return 'Tekst pod kodem';
}

export function LabelEditor({ data, config, onDataChange, onConfigChange }: {
  data: LabelData;
  config: LabelConfig;
  onDataChange: (d: LabelData) => void;
  onConfigChange: (c: Partial<LabelConfig>) => void;
}) {
  const [selected, setSelected] = useState<Selection>('rack');
  const [inspectorView, setInspectorView] = useState<InspectorView>('element');
  const [editMode, setEditMode] = useState<EditMode>('design');
  const [guides, setGuides] = useState<Guides>({});
  const [customGuides, setCustomGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [zoom, setZoom] = useState(100);
  const [spaceDown, setSpaceDown] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>(readTemplates);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const L = computeLayout(config, data);
  const W = config.widthMm;
  const H = config.heightMm;
  const baseCanvasWidth = Math.max(420, W * 9);

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
    : config.rackAlign === 'right' ? L.rack.x + L.rack.w : L.rack.x;

  const boxFor = (id: ElementId): Box => {
    if (id === 'rack') return L.rack;
    if (id === 'column') return L.columnBar;
    if (id === 'shelf') return L.shelfRow;
    if (id === 'barcode') return L.barcode;
    return L.barcodeText;
  };
  const selectBox = selected ? boxFor(selected) : null;

  const isVisible = (id: ElementId): boolean => {
    if (id === 'rack') return config.showRack;
    if (id === 'column') return config.showColumnBar;
    if (id === 'shelf') return config.showShelf;
    if (id === 'barcode') return config.showBarcode;
    return config.showBarcodeText;
  };
  const isLocked = (id: ElementId): boolean => {
    if (id === 'rack') return config.lockRack;
    if (id === 'column') return config.lockColumn;
    if (id === 'shelf') return config.lockShelf;
    if (id === 'barcode') return config.lockBarcode;
    return config.lockBarcodeText;
  };

  const snapshot = (): Snapshot => ({ config: { ...config }, data: { ...data } });
  const checkpoint = () => {
    setPast((p) => [...p.slice(-39), snapshot()]);
    setFuture([]);
  };
  const restore = (s: Snapshot) => {
    onConfigChange(s.config);
    onDataChange(s.data);
  };
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
  const changeConfig = (c: Partial<LabelConfig>) => {
    checkpoint();
    onConfigChange(c);
  };

  const offsetKeys = (id: ElementId): [keyof LabelConfig, keyof LabelConfig] => {
    if (id === 'rack') return ['rackOffsetX', 'rackOffsetY'];
    if (id === 'column') return ['columnOffsetX', 'columnOffsetY'];
    if (id === 'shelf') return ['shelfOffsetX', 'shelfOffsetY'];
    if (id === 'barcode') return ['barcodeOffsetX', 'barcodeOffsetY'];
    return ['barcodeTextOffsetX', 'barcodeTextOffsetY'];
  };

  const offsetPatch = (id: ElementId, dx: number, dy: number, source = config): Partial<LabelConfig> => {
    const [kx, ky] = offsetKeys(id);
    return {
      [kx]: Number(source[kx]) + dx,
      [ky]: Number(source[ky]) + dy,
    } as Partial<LabelConfig>;
  };

  const sizePatch = (id: ElementId, w: number, h: number): Partial<LabelConfig> => {
    if (id === 'rack') return { rackWidthMm: w, rackHeightMm: h };
    if (id === 'column') return { columnWidthMm: w, columnHeightMm: h };
    if (id === 'shelf') return { shelfWidthMm: w, shelfHeightMm: h };
    if (id === 'barcode') return { barcodeWidthMm: w, barcodeHeightMm: h };
    return { barcodeTextWidthMm: w, barcodeTextHeightMm: h };
  };

  const setVisibility = (id: ElementId, visible: boolean) => {
    const patch: Partial<LabelConfig> = id === 'rack' ? { showRack: visible }
      : id === 'column' ? { showColumnBar: visible }
        : id === 'shelf' ? { showShelf: visible }
          : id === 'barcode' ? { showBarcode: visible }
            : { showBarcodeText: visible };
    changeConfig(patch);
  };

  const toggleLock = (id: ElementId) => {
    const locked = !isLocked(id);
    const patch: Partial<LabelConfig> = id === 'rack' ? { lockRack: locked }
      : id === 'column' ? { lockColumn: locked }
        : id === 'shelf' ? { lockShelf: locked }
          : id === 'barcode' ? { lockBarcode: locked }
            : { lockBarcodeText: locked };
    changeConfig(patch);
  };

  const resetPosition = (id: ElementId) => {
    checkpoint();
    const [kx, ky] = offsetKeys(id);
    onConfigChange({ [kx]: 0, [ky]: 0 } as Partial<LabelConfig>);
  };

  const resetSize = (id: ElementId) => {
    checkpoint();
    if (id === 'rack') onConfigChange({ rackWidthMm: 0, rackHeightMm: 0 });
    if (id === 'column') onConfigChange({ columnWidthMm: 0, columnHeightMm: 0 });
    if (id === 'shelf') onConfigChange({ shelfWidthMm: 0, shelfHeightMm: 0 });
    if (id === 'barcode') onConfigChange({ barcodeWidthMm: 0, barcodeHeightMm: DEFAULT_CONFIG.barcodeHeightMm });
    if (id === 'barcodeText') onConfigChange({ barcodeTextWidthMm: 0, barcodeTextHeightMm: 0 });
  };

  const mmDelta = (dx: number, dy: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: dx / rect.width * W, y: dy / rect.height * H };
  };

  const visibleBoxes = (except: ElementId): Array<{ id: ElementId; box: Box }> => {
    const ids: ElementId[] = ['rack', 'column', 'shelf', 'barcode', 'barcodeText'];
    return ids.filter((id) => id !== except && isVisible(id)).map((id) => ({ id, box: boxFor(id) }));
  };

  const snapBox = (id: ElementId, box: Box, x: number, y: number) => {
    const threshold = 1.1;
    const others = visibleBoxes(id);
    const xTargets = [config.marginLeftMm, W / 2, W - config.marginRightMm, ...customGuides.x];
    const yTargets = [config.marginTopMm, H / 2, H - config.marginBottomMm, ...customGuides.y];
    for (const { box: b } of others) {
      xTargets.push(b.x, b.x + b.w / 2, b.x + b.w);
      yTargets.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    const xPoints = [x, x + box.w / 2, x + box.w];
    const yPoints = [y, y + box.h / 2, y + box.h];
    let sx = x;
    let sy = y;
    let gx: number | undefined;
    let gy: number | undefined;
    outerX: for (const t of xTargets) {
      for (const p of xPoints) {
        if (Math.abs(p - t) <= threshold) {
          sx += t - p;
          gx = t;
          break outerX;
        }
      }
    }
    outerY: for (const t of yTargets) {
      for (const p of yPoints) {
        if (Math.abs(p - t) <= threshold) {
          sy += t - p;
          gy = t;
          break outerY;
        }
      }
    }
    return { x: sx, y: sy, guides: { x: gx, y: gy } as Guides };
  };

  const beginDrag = (id: ElementId, box: Box, e: React.PointerEvent<SVGGElement | SVGTextElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(id);
    setInspectorView('element');
    if (editMode !== 'design' || isLocked(id)) return;
    checkpoint();
    const startX = e.clientX;
    const startY = e.clientY;
    const [kx, ky] = offsetKeys(id);
    const ox = Number(config[kx]);
    const oy = Number(config[ky]);
    const move = (ev: PointerEvent) => {
      const d = mmDelta(ev.clientX - startX, ev.clientY - startY);
      const snapped = snapBox(id, box, box.x + d.x, box.y + d.y);
      setGuides(snapped.guides);
      onConfigChange({
        [kx]: ox + snapped.x - box.x,
        [ky]: oy + snapped.y - box.y,
      } as Partial<LabelConfig>);
    };
    const up = () => {
      setGuides({});
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginResize = (id: ElementId, handle: ResizeHandle, e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLocked(id)) return;
    checkpoint();
    const startX = e.clientX;
    const startY = e.clientY;
    const startBox = boxFor(id);
    const startCfg = { ...config };
    const move = (ev: PointerEvent) => {
      const d = mmDelta(ev.clientX - startX, ev.clientY - startY);
      let x = startBox.x;
      let y = startBox.y;
      let w = startBox.w;
      let h = startBox.h;
      if (handle.includes('e')) w = Math.max(2, startBox.w + d.x);
      if (handle.includes('s')) h = Math.max(1, startBox.h + d.y);
      if (handle.includes('w')) {
        x = Math.min(startBox.x + startBox.w - 2, startBox.x + d.x);
        w = Math.max(2, startBox.w - d.x);
      }
      if (handle.includes('n')) {
        y = Math.min(startBox.y + startBox.h - 1, startBox.y + d.y);
        h = Math.max(1, startBox.h - d.y);
      }
      w = Math.min(w, W);
      h = Math.min(h, H);

      let baseShiftX = 0;
      let baseShiftY = 0;
      if (id === 'barcode' || id === 'barcodeText') baseShiftX = (startBox.w - w) / 2;
      if (id === 'barcode') baseShiftY = startBox.h - h;
      const positionPatch = offsetPatch(
        id,
        x - startBox.x - baseShiftX,
        y - startBox.y - baseShiftY,
        startCfg,
      );
      onConfigChange({ ...sizePatch(id, w, h), ...positionPatch });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginMarginDrag = (side: 'left' | 'right' | 'top' | 'bottom', e: React.PointerEvent<SVGLineElement>) => {
    e.preventDefault();
    e.stopPropagation();
    checkpoint();
    const move = (ev: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const posX = (ev.clientX - rect.left) / rect.width * W;
      const posY = (ev.clientY - rect.top) / rect.height * H;
      if (side === 'left') onConfigChange({ marginLeftMm: clamp(posX, 0, W * 0.45) });
      if (side === 'right') onConfigChange({ marginRightMm: clamp(W - posX, 0, W * 0.45) });
      if (side === 'top') onConfigChange({ marginTopMm: clamp(posY, 0, H * 0.45) });
      if (side === 'bottom') onConfigChange({ marginBottomMm: clamp(H - posY, 0, H * 0.45) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginCustomGuideDrag = (axis: 'x' | 'y', index: number, e: React.PointerEvent<SVGLineElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const value = axis === 'x'
        ? clamp((ev.clientX - rect.left) / rect.width * W, 0, W)
        : clamp((ev.clientY - rect.top) / rect.height * H, 0, H);
      setCustomGuides((g) => ({
        ...g,
        [axis]: g[axis].map((v, i) => i === index ? value : v),
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const nudge = (id: ElementId, dx: number, dy: number) => {
    if (isLocked(id)) return;
    checkpoint();
    onConfigChange(offsetPatch(id, dx, dy));
  };

  const hideSelected = () => {
    if (selected) setVisibility(selected, false);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.code === 'Space' && !editing) {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (editing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(100);
        return;
      }
      if (e.key === 'Escape') {
        setSelected(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        hideSelected();
        return;
      }
      if (!selected) return;
      const step = e.shiftKey ? 2 : 0.5;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(selected, -step, 0); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(selected, step, 0); }
      if (e.key === 'ArrowUp') { e.preventDefault(); nudge(selected, 0, -step); }
      if (e.key === 'ArrowDown') { e.preventDefault(); nudge(selected, 0, step); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const beginPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!spaceDown && e.button !== 1) return;
    const stage = stageRef.current;
    if (!stage) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const left = stage.scrollLeft;
    const top = stage.scrollTop;
    const move = (ev: PointerEvent) => {
      stage.scrollLeft = left - (ev.clientX - startX);
      stage.scrollTop = top - (ev.clientY - startY);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const fitToScreen = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const available = Math.max(240, stage.clientWidth - 100);
    setZoom(clamp(available / baseCanvasWidth * 100, 25, 200));
  };

  const setAbsolutePosition = (id: ElementId, axis: 'x' | 'y', value: number) => {
    const box = boxFor(id);
    const delta = value - (axis === 'x' ? box.x : box.y);
    onConfigChange(offsetPatch(id, axis === 'x' ? delta : 0, axis === 'y' ? delta : 0));
  };

  const setAbsoluteSize = (id: ElementId, axis: 'w' | 'h', value: number) => {
    const box = boxFor(id);
    onConfigChange(sizePatch(id, axis === 'w' ? value : box.w, axis === 'h' ? value : box.h));
  };

  const saveTemplate = () => {
    const name = window.prompt('Nazwa szablonu:');
    if (!name?.trim()) return;
    const next = [...savedTemplates, { name: name.trim(), config: { ...config } }];
    setSavedTemplates(next);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(next));
  };

  const removeTemplate = (index: number) => {
    const next = savedTemplates.filter((_, i) => i !== index);
    setSavedTemplates(next);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(next));
  };

  const applyTemplate = (patch: Partial<LabelConfig>) => {
    checkpoint();
    onConfigChange(patch);
  };

  const resetLayout = () => {
    checkpoint();
    onConfigChange({
      ...DEFAULT_CONFIG,
      widthMm: config.widthMm,
      heightMm: config.heightMm,
      dpi: config.dpi,
      columnLabel: config.columnLabel,
      shelfLabel: config.shelfLabel,
      codeTemplate: config.codeTemplate,
      asciiFallback: config.asciiFallback,
      printOffsetXmm: config.printOffsetXmm,
      printOffsetYmm: config.printOffsetYmm,
      printScaleXPercent: config.printScaleXPercent,
      printScaleYPercent: config.printScaleYPercent,
    });
  };

  const dotMm = 25.4 / config.dpi;
  const quietZoneMm = L.barcode.moduleDots * dotMm * 10;
  const barcodeQuality = !config.showBarcode ? { level: 'off', label: 'Kod wyłączony' }
    : !L.barcode.code ? { level: 'bad', label: 'Brak danych kodu' }
      : L.barcode.moduleDots < 2 ? { level: 'bad', label: 'Kod zbyt gęsty' }
        : L.barcode.h < 8 ? { level: 'warn', label: 'Kod zbyt niski' }
          : L.barcode.x < quietZoneMm || W - (L.barcode.x + L.barcode.w) < quietZoneMm
            ? { level: 'warn', label: 'Mała quiet zone' }
            : { level: 'good', label: 'Barcode OK' };

  const rulerTicksX = Array.from({ length: Math.floor(W / 10) + 1 }, (_, i) => i * 10);
  const rulerTicksY = Array.from({ length: Math.floor(H / 10) + 1 }, (_, i) => i * 10);
  const elements: ElementId[] = ['rack', 'column', 'shelf', 'barcode', 'barcodeText'];
  const resizeHandles: Array<{ id: ResizeHandle; x: number; y: number }> = selectBox ? [
    { id: 'nw', x: selectBox.x, y: selectBox.y },
    { id: 'n', x: selectBox.x + selectBox.w / 2, y: selectBox.y },
    { id: 'ne', x: selectBox.x + selectBox.w, y: selectBox.y },
    { id: 'e', x: selectBox.x + selectBox.w, y: selectBox.y + selectBox.h / 2 },
    { id: 'se', x: selectBox.x + selectBox.w, y: selectBox.y + selectBox.h },
    { id: 's', x: selectBox.x + selectBox.w / 2, y: selectBox.y + selectBox.h },
    { id: 'sw', x: selectBox.x, y: selectBox.y + selectBox.h },
    { id: 'w', x: selectBox.x, y: selectBox.y + selectBox.h / 2 },
  ] : [];

  return (
    <div className="editor-workspace">
      <div className="editor-toolbar">
        <div className="brand-mark">E</div>
        <select className="toolbar-select" value={presetIdx} onChange={(e) => {
          const p = SIZE_PRESETS[Number(e.target.value)];
          if (p) changeConfig({ widthMm: p.widthMm, heightMm: p.heightMm });
        }}>
          <option value={-1}>{W} × {H} mm</option>
          {SIZE_PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
        <div className="toolbar-divider" />
        <div className="segmented mode-segmented">
          <button className={editMode === 'design' ? 'active' : ''} onClick={() => setEditMode('design')}>Układ</button>
          <button className={editMode === 'data' ? 'active' : ''} onClick={() => setEditMode('data')}>Dane</button>
        </div>
        <button className="history-button" disabled={!past.length} onClick={undo} title="Cofnij (Ctrl+Z)">↶</button>
        <button className="history-button" disabled={!future.length} onClick={redo} title="Ponów (Ctrl+Shift+Z)">↷</button>
        <div className="toolbar-spacer" />
        <button className="toolbar-action" onClick={() => setInspectorView('templates')}>Szablony</button>
        <button className="toolbar-action" onClick={() => setInspectorView('printer')}>Drukarka</button>
        <span className={`quality-badge ${barcodeQuality.level}`}>{barcodeQuality.label}</span>
      </div>

      <div className="editor-body">
        <aside className="layers-panel">
          <div className="side-title">Warstwy</div>
          {elements.map((id) => (
            <div key={id} className={`layer-row ${selected === id ? 'selected' : ''} ${!isVisible(id) ? 'muted-layer' : ''}`}>
              <button className="layer-main" onClick={() => { setSelected(id); setInspectorView('element'); }}>
                <span className={`layer-kind ${id}`}>{id === 'barcodeText' ? 'T' : id === 'barcode' ? '▥' : '▣'}</span>
                <span>{elementName(id)}</span>
              </button>
              <button className="layer-icon" onClick={() => setVisibility(id, !isVisible(id))} title="Widoczność">{isVisible(id) ? '◉' : '○'}</button>
              <button className={`layer-icon ${isLocked(id) ? 'locked' : ''}`} onClick={() => toggleLock(id)} title="Blokada">{isLocked(id) ? '🔒' : '⌁'}</button>
            </div>
          ))}
          <div className="layers-help">
            <strong>Skróty</strong>
            <span>Strzałki · 0,5 mm</span>
            <span>Shift + strzałki · 2 mm</span>
            <span>Delete · ukryj</span>
            <span>Spacja + przeciągnięcie · pan</span>
          </div>
        </aside>

        <div
          ref={stageRef}
          className={`canvas-stage ${spaceDown ? 'panning' : ''}`}
          onPointerDown={(e) => {
            if (spaceDown || e.button === 1) beginPan(e);
            else if (e.target === e.currentTarget) setSelected(null);
          }}
          onWheel={(e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            setZoom((z) => clamp(z + (e.deltaY < 0 ? 10 : -10), 25, 400));
          }}
        >
          <div className="canvas-scroll-space">
            <div
              className="label-canvas"
              style={{ width: `${baseCanvasWidth * zoom / 100}px`, aspectRatio: `${W} / ${H}` }}
            >
              <div className="ruler ruler-top" onDoubleClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const value = clamp((e.clientX - rect.left) / rect.width * W, 0, W);
                setCustomGuides((g) => ({ ...g, x: [...g.x, value] }));
              }}>
                {rulerTicksX.map((v) => <span key={v} style={{ left: `${v / W * 100}%` }}>{v}</span>)}
              </div>
              <div className="ruler ruler-left" onDoubleClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const value = clamp((e.clientY - rect.top) / rect.height * H, 0, H);
                setCustomGuides((g) => ({ ...g, y: [...g.y, value] }));
              }}>
                {rulerTicksY.map((v) => <span key={v} style={{ top: `${v / H * 100}%` }}>{v}</span>)}
              </div>

              <svg ref={svgRef} className="label-svg editor-svg" viewBox={`0 0 ${W} ${H}`} onClick={(e) => e.stopPropagation()}>
                <rect x={0} y={0} width={W} height={H} fill="#fff" />

                <g className="margin-guides">
                  <line x1={config.marginLeftMm} y1={0} x2={config.marginLeftMm} y2={H} onPointerDown={(e) => beginMarginDrag('left', e)} />
                  <line x1={W - config.marginRightMm} y1={0} x2={W - config.marginRightMm} y2={H} onPointerDown={(e) => beginMarginDrag('right', e)} />
                  <line x1={0} y1={config.marginTopMm} x2={W} y2={config.marginTopMm} onPointerDown={(e) => beginMarginDrag('top', e)} />
                  <line x1={0} y1={H - config.marginBottomMm} x2={W} y2={H - config.marginBottomMm} onPointerDown={(e) => beginMarginDrag('bottom', e)} />
                </g>

                {customGuides.x.map((v, i) => <line key={`x-${i}`} className="custom-guide" x1={v} y1={0} x2={v} y2={H} onPointerDown={(e) => beginCustomGuideDrag('x', i, e)} onDoubleClick={() => setCustomGuides((g) => ({ ...g, x: g.x.filter((_, j) => j !== i) }))} />)}
                {customGuides.y.map((v, i) => <line key={`y-${i}`} className="custom-guide" x1={0} y1={v} x2={W} y2={v} onPointerDown={(e) => beginCustomGuideDrag('y', i, e)} onDoubleClick={() => setCustomGuides((g) => ({ ...g, y: g.y.filter((_, j) => j !== i) }))} />)}
                {guides.x !== undefined && <line className="snap-guide" x1={guides.x} y1={0} x2={guides.x} y2={H} />}
                {guides.y !== undefined && <line className="snap-guide" x1={0} y1={guides.y} x2={W} y2={guides.y} />}

                {L.dividers.map((dv, i) => <rect key={i} x={dv.x} y={dv.y} width={dv.w} height={dv.h} fill="#000" />)}

                {config.showRack && (
                  <g className={`editable-object ${isLocked('rack') ? 'locked-object' : 'draggable'}`} onPointerDown={(e) => beginDrag('rack', L.rack, e)}>
                    <rect x={L.rack.x} y={L.rack.y} width={L.rack.w} height={L.rack.h} fill="transparent" />
                    <text x={rackX} y={L.rack.y + L.rack.h / 2} fontSize={L.rack.fontMm} fontFamily={FONT} fontWeight="bold" textAnchor={rackAnchor} dominantBaseline="central">{data.rack}</text>
                  </g>
                )}

                {config.showColumnBar && (
                  <g className={`editable-object ${isLocked('column') ? 'locked-object' : 'draggable'}`} onPointerDown={(e) => beginDrag('column', L.columnBar, e)}>
                    <rect x={L.columnBar.x} y={L.columnBar.y} width={L.columnBar.w} height={L.columnBar.h} fill="#000" />
                    <text x={L.columnBar.x + L.inset} y={L.columnBar.y + L.columnBar.h / 2} fontSize={L.columnBar.labelFontMm} fontFamily={FONT} fontWeight="bold" fill="#fff" dominantBaseline="central">{config.columnLabel}</text>
                    <text x={L.columnBar.x + L.columnBar.w - L.inset} y={L.columnBar.y + L.columnBar.h / 2} fontSize={L.columnBar.valueFontMm} fontFamily={FONT} fontWeight="bold" fill="#fff" textAnchor="end" dominantBaseline="central">{data.column}</text>
                  </g>
                )}

                {config.showShelf && (
                  <g className={`editable-object ${isLocked('shelf') ? 'locked-object' : 'draggable'}`} onPointerDown={(e) => beginDrag('shelf', L.shelfRow, e)}>
                    <rect x={L.shelfRow.x} y={L.shelfRow.y} width={L.shelfRow.w} height={L.shelfRow.h} fill="transparent" />
                    <text x={L.shelfRow.x + L.inset} y={L.shelfRow.y + L.shelfRow.h / 2} fontSize={L.shelfRow.labelFontMm} fontFamily={FONT} fontWeight="bold" dominantBaseline="central">{config.shelfLabel}</text>
                    <text x={L.shelfRow.x + L.shelfRow.w - L.inset} y={L.shelfRow.y + L.shelfRow.h / 2} fontSize={L.shelfRow.valueFontMm} fontFamily={FONT} fontWeight="bold" textAnchor="end" dominantBaseline="central">{data.shelf}</text>
                  </g>
                )}

                {barcodeUri && (
                  <g className={`editable-object ${isLocked('barcode') ? 'locked-object' : 'draggable'}`} onPointerDown={(e) => beginDrag('barcode', L.barcode, e)}>
                    <image href={barcodeUri} x={L.barcode.x} y={L.barcode.y} width={L.barcode.w} height={L.barcode.h} preserveAspectRatio="none" />
                    <rect x={L.barcode.x} y={L.barcode.y} width={L.barcode.w} height={L.barcode.h} fill="transparent" />
                  </g>
                )}

                {config.showBarcodeText && (
                  <text className={`editable-object ${isLocked('barcodeText') ? 'locked-object' : 'draggable'}`} onPointerDown={(e) => beginDrag('barcodeText', L.barcodeText, e)} x={L.barcodeText.x + L.barcodeText.w / 2} y={L.barcodeText.y + L.barcodeText.h / 2} fontSize={L.barcodeText.fontMm} fontFamily={FONT} fontWeight={config.barcodeTextBold ? 'bold' : 'normal'} textAnchor="middle" dominantBaseline="central">{L.barcodeText.text}</text>
                )}

                {selectBox && isVisible(selected as ElementId) && (
                  <g className={`selection-overlay ${selected && isLocked(selected) ? 'locked-selection' : ''}`} pointerEvents="none">
                    <rect x={selectBox.x} y={selectBox.y} width={selectBox.w} height={selectBox.h} fill="none" vectorEffect="non-scaling-stroke" />
                  </g>
                )}
                {selected && selectBox && isVisible(selected) && !isLocked(selected) && editMode === 'design' && resizeHandles.map((h) => (
                  <circle key={h.id} className={`resize-handle handle-${h.id}`} cx={h.x} cy={h.y} r={Math.max(0.7, W * 0.006)} onPointerDown={(e) => beginResize(selected, h.id, e)} />
                ))}
              </svg>
            </div>
          </div>

          <div className="zoom-dock">
            <button onClick={() => setZoom((z) => clamp(z - 10, 25, 400))}>−</button>
            <span>{Math.round(zoom)}%</span>
            <button onClick={() => setZoom((z) => clamp(z + 10, 25, 400))}>+</button>
            <button onClick={() => setZoom(100)}>100%</button>
            <button onClick={fitToScreen}>Dopasuj</button>
          </div>
        </div>

        <aside className="properties-panel">
          <div className="inspector-tabs">
            <button className={inspectorView === 'element' ? 'active' : ''} onClick={() => setInspectorView('element')}>Element</button>
            <button className={inspectorView === 'printer' ? 'active' : ''} onClick={() => setInspectorView('printer')}>Druk</button>
            <button className={inspectorView === 'templates' ? 'active' : ''} onClick={() => setInspectorView('templates')}>Szablony</button>
          </div>

          {inspectorView === 'element' && selected && (
            <div className="inspector-content">
              <div className="inspector-heading">
                <div><span className="eyebrow">Zaznaczenie</span><strong>{elementName(selected)}</strong></div>
                <button className={isLocked(selected) ? 'lock-button active' : 'lock-button'} onClick={() => toggleLock(selected)}>{isLocked(selected) ? '🔒' : '🔓'}</button>
              </div>

              <div className="xywh-grid">
                {(['x', 'y', 'w', 'h'] as const).map((axis) => {
                  const value = axis === 'x' ? boxFor(selected).x : axis === 'y' ? boxFor(selected).y : axis === 'w' ? boxFor(selected).w : boxFor(selected).h;
                  return <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step={0.1} value={roundMm(value)} onFocus={checkpoint} onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    if (axis === 'x' || axis === 'y') setAbsolutePosition(selected, axis, n);
                    else setAbsoluteSize(selected, axis, Math.max(axis === 'w' ? 2 : 1, n));
                  }} /><em>mm</em></label>;
                })}
              </div>

              <div className="inspector-actions">
                <button onClick={() => resetPosition(selected)}>Reset pozycji</button>
                <button onClick={() => resetSize(selected)}>Auto rozmiar</button>
              </div>

              {selected === 'rack' && (
                <div className="property-section">
                  <label>Kod regału<input value={data.rack} onFocus={checkpoint} onChange={(e) => onDataChange({ ...data, rack: e.target.value })} /></label>
                  <label>Skala tekstu<input type="range" min={0.5} max={1.5} step={0.05} value={config.rackFontScale} onPointerDown={checkpoint} onChange={(e) => onConfigChange({ rackFontScale: Number(e.target.value) })} /></label>
                  <div className="segmented full"><button className={config.rackAlign === 'left' ? 'active' : ''} onClick={() => changeConfig({ rackAlign: 'left' })}>Lewo</button><button className={config.rackAlign === 'center' ? 'active' : ''} onClick={() => changeConfig({ rackAlign: 'center' })}>Środek</button><button className={config.rackAlign === 'right' ? 'active' : ''} onClick={() => changeConfig({ rackAlign: 'right' })}>Prawo</button></div>
                </div>
              )}

              {selected === 'column' && (
                <div className="property-section">
                  <label>Nagłówek<input value={config.columnLabel} onFocus={checkpoint} onChange={(e) => onConfigChange({ columnLabel: e.target.value })} /></label>
                  <label>Wartość<input value={data.column} onFocus={checkpoint} onChange={(e) => onDataChange({ ...data, column: e.target.value })} /></label>
                  <label>Skala nagłówka<input type="range" min={0.5} max={1.5} step={0.05} value={config.headerFontScale} onPointerDown={checkpoint} onChange={(e) => onConfigChange({ headerFontScale: Number(e.target.value) })} /></label>
                  <label>Skala wartości<input type="range" min={0.5} max={1.5} step={0.05} value={config.valueFontScale} onPointerDown={checkpoint} onChange={(e) => onConfigChange({ valueFontScale: Number(e.target.value) })} /></label>
                </div>
              )}

              {selected === 'shelf' && (
                <div className="property-section">
                  <label>Nagłówek<input value={config.shelfLabel} onFocus={checkpoint} onChange={(e) => onConfigChange({ shelfLabel: e.target.value })} /></label>
                  <label>Wartość<input value={data.shelf} onFocus={checkpoint} onChange={(e) => onDataChange({ ...data, shelf: e.target.value })} /></label>
                </div>
              )}

              {selected === 'barcode' && (
                <div className="property-section">
                  <label>Szablon danych<input className="mono-input" value={config.codeTemplate} onFocus={checkpoint} onChange={(e) => onConfigChange({ codeTemplate: e.target.value })} /></label>
                  <div className={`quality-card ${barcodeQuality.level}`}><strong>{barcodeQuality.label}</strong><span>Moduł: {L.barcode.moduleDots} dot · wysokość {roundMm(L.barcode.h)} mm · quiet zone ~{roundMm(quietZoneMm)} mm</span></div>
                </div>
              )}

              {selected === 'barcodeText' && (
                <div className="property-section">
                  <div className="static-code">{L.barcodeText.text}</div>
                  <label className="check-line"><input type="checkbox" checked={config.barcodeTextBold} onChange={() => changeConfig({ barcodeTextBold: !config.barcodeTextBold })} />Pogrubienie</label>
                  <label>Skala tekstu<input type="range" min={0.5} max={1.5} step={0.05} value={config.barcodeTextFontScale} onPointerDown={checkpoint} onChange={(e) => onConfigChange({ barcodeTextFontScale: Number(e.target.value) })} /></label>
                </div>
              )}

              <label className="check-line danger-line"><input type="checkbox" checked={isVisible(selected)} onChange={(e) => setVisibility(selected, e.target.checked)} />Element widoczny</label>
            </div>
          )}

          {inspectorView === 'element' && !selected && <div className="empty-inspector"><strong>Wybierz element</strong><span>Kliknij obiekt na etykiecie albo wybierz go z panelu Warstwy.</span></div>}

          {inspectorView === 'printer' && (
            <div className="inspector-content">
              <div className="inspector-heading"><div><span className="eyebrow">Zebra ZD421</span><strong>Kalibracja wydruku</strong></div></div>
              <p className="panel-note">Te wartości zmieniają tylko ZPL. Projekt na canvasie pozostaje bez zmian.</p>
              <div className="calibration-grid">
                <label>Offset X<input type="number" step={0.1} value={config.printOffsetXmm} onFocus={checkpoint} onChange={(e) => onConfigChange({ printOffsetXmm: Number(e.target.value) || 0 })} /><span>mm</span></label>
                <label>Offset Y<input type="number" step={0.1} value={config.printOffsetYmm} onFocus={checkpoint} onChange={(e) => onConfigChange({ printOffsetYmm: Number(e.target.value) || 0 })} /><span>mm</span></label>
                <label>Skala X<input type="number" min={80} max={120} step={0.1} value={config.printScaleXPercent} onFocus={checkpoint} onChange={(e) => onConfigChange({ printScaleXPercent: clamp(Number(e.target.value) || 100, 80, 120) })} /><span>%</span></label>
                <label>Skala Y<input type="number" min={80} max={120} step={0.1} value={config.printScaleYPercent} onFocus={checkpoint} onChange={(e) => onConfigChange({ printScaleYPercent: clamp(Number(e.target.value) || 100, 80, 120) })} /><span>%</span></label>
              </div>
              <button className="wide-secondary" onClick={() => changeConfig({ printOffsetXmm: 0, printOffsetYmm: 0, printScaleXPercent: 100, printScaleYPercent: 100 })}>Reset kalibracji</button>
              <div className={`quality-card ${barcodeQuality.level}`}><strong>{barcodeQuality.label}</strong><span>Przy {config.dpi} dpi moduł ma {L.barcode.moduleDots} dot.</span></div>
            </div>
          )}

          {inspectorView === 'templates' && (
            <div className="inspector-content">
              <div className="inspector-heading"><div><span className="eyebrow">Layout</span><strong>Szablony etykiet</strong></div></div>
              <div className="template-list">
                {BUILTIN_TEMPLATES.map((t) => <button key={t.name} className="template-card" onClick={() => applyTemplate(t.patch)}><strong>{t.name}</strong><span>{t.description}</span></button>)}
              </div>
              <div className="template-divider">Moje szablony</div>
              {savedTemplates.length === 0 && <p className="panel-note">Nie masz jeszcze własnych szablonów.</p>}
              {savedTemplates.map((t, i) => <div key={`${t.name}-${i}`} className="saved-template"><button onClick={() => applyTemplate(t.config)}>{t.name}</button><button className="delete-template" onClick={() => removeTemplate(i)}>×</button></div>)}
              <button className="wide-primary" onClick={saveTemplate}>Zapisz bieżący jako szablon</button>
              <button className="wide-secondary" onClick={resetLayout}>Reset całego layoutu</button>
            </div>
          )}
        </aside>
      </div>

      <div className="canvas-footer modern-footer">
        <span>Podwójny klik na linijce dodaje prowadnicę</span><span className="dot">•</span><span>Podwójny klik prowadnicy usuwa ją</span><span className="dot">•</span><span>Ctrl + kółko = zoom</span><span className="dot">•</span><span>WYSIWYG → ZPL</span>
      </div>
    </div>
  );
}
