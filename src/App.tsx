import { useEffect, useMemo, useState } from 'react';
import type { AppState, BatchSpec, LabelConfig, LabelData, Tab } from './types';
import { expandBatch } from './lib/batch';
import { loadState, saveState } from './lib/storage';
import { zplForLabels } from './lib/zpl';
import { BatchPanel } from './components/BatchPanel';
import { LabelForm } from './components/LabelForm';
import { LabelPreview } from './components/LabelPreview';
import { OutputPanel } from './components/OutputPanel';
import { PrintSheet } from './components/PrintSheet';
import { SettingsPanel } from './components/SettingsPanel';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const { config, single, batch, tab } = state;

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Rozmiar strony wydruku = rozmiar etykiety; @page nie czyta zmiennych CSS,
  // więc regułę wstrzykujemy dynamicznie.
  useEffect(() => {
    let el = document.getElementById('page-style') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'page-style';
      document.head.appendChild(el);
    }
    el.textContent = `@page { size: ${config.widthMm}mm ${config.heightMm}mm; margin: 0; }`;
  }, [config.widthMm, config.heightMm]);

  const labels = useMemo<LabelData[]>(
    () => (tab === 'single' ? [single] : expandBatch(batch)),
    [tab, single, batch],
  );
  const zpl = useMemo(() => zplForLabels(labels, config), [labels, config]);

  const setConfig = (c: Partial<LabelConfig>) =>
    setState((s) => ({ ...s, config: { ...s.config, ...c } }));
  const setSingle = (single: LabelData) => setState((s) => ({ ...s, single }));
  const setBatch = (batch: BatchSpec) => setState((s) => ({ ...s, batch }));
  const setTab = (tab: Tab) => setState((s) => ({ ...s, tab }));

  const previewLabel = labels[0] ?? single;

  return (
    <>
      <div className="app">
        <header>
          <h1>🏷️ Etykieciarka</h1>
          <p>Projektowanie etykiet regałowych · Zebra ZD421</p>
        </header>
        <div className="columns">
          <section className="panel">
            <nav className="tabs">
              <button className={tab === 'single' ? 'active' : ''} onClick={() => setTab('single')}>
                Pojedyncza etykieta
              </button>
              <button className={tab === 'batch' ? 'active' : ''} onClick={() => setTab('batch')}>
                Seria etykiet
              </button>
            </nav>
            {tab === 'single' ? (
              <LabelForm value={single} onChange={setSingle} />
            ) : (
              <BatchPanel value={batch} codeTemplate={config.codeTemplate} onChange={setBatch} />
            )}
            <SettingsPanel config={config} onChange={setConfig} />
          </section>
          <section className="panel preview-panel">
            <h3>
              Podgląd{' '}
              <span className="muted">
                ({config.widthMm} × {config.heightMm} mm{labels.length > 1 ? `, 1 z ${labels.length}` : ''})
              </span>
            </h3>
            <div
              className="preview-frame"
              style={{ aspectRatio: `${config.widthMm} / ${config.heightMm}` }}
            >
              <LabelPreview data={previewLabel} config={config} />
            </div>
            <OutputPanel zpl={zpl} count={labels.length} />
          </section>
        </div>
      </div>
      <PrintSheet labels={labels} config={config} />
    </>
  );
}
