/** Dane jednej fizycznej etykiety lokalizacyjnej. */
export interface LabelData {
  rack: string;   // regał, np. "C03"
  column: string; // kolumna, np. "06"
  shelf: string;  // półka, np. "03"
}

export type HorizontalAlign = 'left' | 'center' | 'right';

export interface LabelConfig {
  widthMm: number;
  heightMm: number;
  dpi: 203 | 300;

  // Ogólna geometria etykiety
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  sectionGapMm: number;
  rackWidthPercent: number;
  rowGapMm: number;
  dividerThicknessMm: number;

  // Regał
  showRack: boolean;
  rackFontScale: number;   // 0.5–1.5
  rackAlign: HorizontalAlign;

  // Kolumna / półka
  headerFontScale: number; // 0.5–1.5
  valueFontScale: number;  // 0.5–1.5
  rightRowHeightPercent: number;
  showColumnBar: boolean;
  showShelf: boolean;
  showDividers: boolean;

  // Kod kreskowy
  barcodeHeightMm: number;
  barcodeWidthPercent: number;
  barcodeTextFontScale: number;
  barcodeTextBold: boolean;
  showBarcode: boolean;
  showBarcodeText: boolean;

  columnLabel: string;
  shelfLabel: string;
  codeTemplate: string; // np. "{regal}-{kolumna}-{polka}"
  asciiFallback: boolean; // transliteracja polskich znaków w ZPL
}

export interface BatchSpec {
  racks: string; // lista regałów po przecinku, np. "C03" lub "C03, C04"
  colFrom: number;
  colTo: number;
  shelfFrom: number;
  shelfTo: number;
  pad: number; // liczba cyfr (zero-padding)
}

export type Tab = 'single' | 'batch';

export interface AppState {
  config: LabelConfig;
  single: LabelData;
  batch: BatchSpec;
  tab: Tab;
}

export interface SizePreset {
  name: string;
  widthMm: number;
  heightMm: number;
}

export const SIZE_PRESETS: SizePreset[] = [
  { name: '100 × 60 mm', widthMm: 100, heightMm: 60 },
  { name: '100 × 50 mm', widthMm: 100, heightMm: 50 },
  { name: '57 × 32 mm', widthMm: 57, heightMm: 32 },
];

export const DEFAULT_CONFIG: LabelConfig = {
  widthMm: 100,
  heightMm: 60,
  dpi: 203,

  marginTopMm: 3,
  marginRightMm: 3,
  marginBottomMm: 3,
  marginLeftMm: 3,
  sectionGapMm: 2,
  rackWidthPercent: 42,
  rowGapMm: 3,
  dividerThicknessMm: 0.4,

  showRack: true,
  rackFontScale: 1,
  rackAlign: 'center',

  headerFontScale: 1,
  valueFontScale: 1,
  rightRowHeightPercent: 44,
  showColumnBar: true,
  showShelf: true,
  showDividers: true,

  barcodeHeightMm: 12,
  barcodeWidthPercent: 100,
  barcodeTextFontScale: 1,
  barcodeTextBold: false,
  showBarcode: true,
  showBarcodeText: true,

  columnLabel: 'KOLUMNA',
  shelfLabel: 'Półka',
  codeTemplate: '{regal}-{kolumna}-{polka}',
  asciiFallback: false,
};

export const DEFAULT_STATE: AppState = {
  config: DEFAULT_CONFIG,
  single: { rack: 'C03', column: '06', shelf: '03' },
  batch: { racks: 'C03', colFrom: 1, colTo: 6, shelfFrom: 1, shelfTo: 4, pad: 2 },
  tab: 'single',
};
