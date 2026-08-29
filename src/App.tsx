import { useEffect, useMemo, useState } from 'react';
import type { AppState, BatchSpec, LabelConfig, LabelData, Tab } from './types';
import { expandBatch } from './lib/batch';
import { loadState, saveState } from './lib/storage';
import { zplForLabels } from './lib/zpl';
import { BatchPanel } from './components/BatchPanel';
import { LabelEditor } from './components/LabelEditor';
import { OutputPanel } from './components/OutputPanel';
import { PrintSheet } from './components/PrintSheet';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [batchOpen, setBatchOpen] = useState(false);
  const { config, single, batch, tab } = state;

  useEffect(() => {
    saveState(state);
  }, [state]);

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
      <main className="modern-app">
        <header className="app-topbar">
          <div className="app-title">
            <div className="app-icon">E</div>
            <div>
              <h1>Etykieciarka</h1>
              <p>Zebra ZD421 · edytor WYSIWYG</p>
            </div>
          </div>

          <div className="mode-switch">
            <button
              className={tab === 'single' ? 'active' : ''}
              onClick={() => {
                setTab('single');
                setBatchOpen(false);
              }}
            >
              Jedna etykieta
            </button>
            <button
              className={tab === 'batch' ? 'active' : ''}
              onClick={() => {
                setTab('batch');
                setBatchOpen(true);
              }}
            >
              Seria {tab === 'batch' ? `(${labels.length})` : ''}
            </button>
          </div>
        </header>

        {tab === 'batch' && batchOpen && (
          <div className="batch-drawer">
            <div className="drawer-heading">
              <div>
                <strong>Generator serii</strong>
                <span>Ustaw zakres, a edytor pokaże pierwszą etykietę z serii.</span>
              </div>
              <button className="icon-button" onClick={() => setBatchOpen(false)} aria-label="Zamknij">×</button>
            </div>
            <BatchPanel value={batch} codeTemplate={config.codeTemplate} onChange={setBatch} />
          </div>
        )}

        <LabelEditor
          data={previewLabel}
          config={config}
          onDataChange={tab === 'single' ? setSingle : () => undefined}
          onConfigChange={setConfig}
        />

        <section className="output-dock">
          <div className="output-heading">
            <div>
              <strong>Druk i eksport</strong>
              <span>{labels.length} {labels.length === 1 ? 'etykieta' : 'etykiet'} · {config.dpi} dpi</span>
            </div>
            {tab === 'batch' && !batchOpen && (
              <button className="secondary-action" onClick={() => setBatchOpen(true)}>Edytuj serię</button>
            )}
          </div>
          <OutputPanel zpl={zpl} count={labels.length} />
        </section>
      </main>

      <PrintSheet labels={labels} config={config} />
    </>
  );
}
