import { useState } from 'react';

export function OutputPanel({ zpl, count }: { zpl: string; count: number }) {
  const [copied, setCopied] = useState(false);

  const downloadZpl = () => {
    const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'etykiety.zpl';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyZpl = async () => {
    try {
      await navigator.clipboard.writeText(zpl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Skopiuj ZPL ręcznie:', zpl);
    }
  };

  return (
    <div className="output">
      <div className="button-row">
        <button className="primary" onClick={() => window.print()}>
          🖨️ Drukuj ({count} {count === 1 ? 'etykieta' : 'etykiet'})
        </button>
        <button onClick={downloadZpl}>Pobierz .zpl</button>
        <button onClick={copyZpl}>{copied ? 'Skopiowano ✓' : 'Kopiuj ZPL'}</button>
      </div>
      <p className="hint">
        Druk z przeglądarki: w oknie drukowania wybierz drukarkę Zebra, ustaw skalę <strong>100%</strong>{' '}
        (bez dopasowania do strony) i marginesy <strong>0</strong>. W sterowniku Zebra ustaw ten sam
        rozmiar etykiety co w aplikacji. Plik .zpl możesz alternatywnie wysłać bezpośrednio do
        drukarki (USB/sieć, port 9100).
      </p>
      <details>
        <summary>Podgląd kodu ZPL</summary>
        <textarea readOnly value={zpl} rows={14} spellCheck={false} />
      </details>
    </div>
  );
}
