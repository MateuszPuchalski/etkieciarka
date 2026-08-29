/** Dane jednej fizycznej etykiety lokalizacyjnej. */
export interface LabelData {
  rack: string;
  column: string;
  shelf: string;
}

export type HorizontalAlign = 'left' | 'center' | 'right';

export interface LabelConfig {
  widthMm: number;
  heightMm: number;
  dpi: 203 | 300;

  // Obszar roboczy
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
  lockRack: boolean;
  rackFontScale: number;
  rackAlign: HorizontalAlign;
  rackOffsetX: number;
  rackOffsetY: number;
  rackWidthMm: number; // 0 = auto
  rackHeightMm: number; // 0 = auto

  // Kolumna
  showColumnBar: boolean;
  lockColumn: boolean;
  columnOffsetX: number;
  columnOffsetY: number;
  columnWidthMm: number; // 0 = auto
  columnHeightMm: number; // 0 = auto

  // Półka
  showShelf: boolean;
  lockShelf: boolean;
  shelfOffsetX: number;
  shelfOffsetY: number;
  shelfWidthMm: number; // 0 = auto
  shelfHeightMm: number; // 0 = auto

  // Teksty kolumny / półki
  headerFontScale: number;
  valueFontScale: number;
  rightRowHeightPercent: number;
  showDividers: boolean;

  // Pola legacy pozostawione dla zgodności starszych zapisów localStorage.
  rightOffsetX: number;
  rightOffsetY: number;

  // Kod kreskowy
  showBarcode: boolean;
  lockBarcode: boolean;
  barcodeHeightMm: number;
  barcodeWidthPercent: number;
  barcodeWidthMm: number; // 0 = auto / barcodeWidthPercent
  barcodeOffsetX: number;
  barcodeOffsetY: number;

  // Tekst pod kodem
  showBarcodeText: boolean;
  lockBarcodeText: boolean;
  barcodeTextFontScale: number;
  barcodeTextBold: boolean;
  barcodeTextOffsetX: number;
  barcodeTextOffsetY: number;
  barcodeTextWidthMm: number; // 0 = auto
  barcodeTextHeightMm: number; // 0 = auto

  columnLabel: string;
  shelfLabel: string;
  codeTemplate: string;
  asciiFallback: boolean;

  // Kalibracja fizycznego wydruku. Nie wpływa na projekt/canvas.
  printOffsetXmm: number;
  printOffsetYmm: number;
  printScaleXPercent: number;
  printScaleYPercent: number;
}

export interface BatchSpec {
  racks: string;
  colFrom: number;
  colTo: number;
  shelfFrom: number;
  shelfTo: number;
  pad: number;
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
  { name: '80 × 50 mm', widthMm: 80, heightMm: 50 },
  { name: '80 × 40 mm', widthMm: 80, heightMm: 40 },
  { name: '70 × 50 mm', widthMm: 70, heightMm: 50 },
  { name: '60 × 40 mm', widthMm: 60, heightMm: 40 },
  { name: '57 × 32 mm', widthMm: 57, heightMm: 32 },
  { name: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  { name: '40 × 30 mm', widthMm: 40, heightMm: 30 },
];

/**
 * Domyślny układ 80 × 50 mm odwzorowuje fizyczną etykietę magazynową:
 * duży regał po lewej, KOLUMNA/PÓŁKA po prawej i szeroki barcode na dole.
 */
export const DEFAULT_CONFIG: LabelConfig = {
  widthMm: 80,
  heightMm: 50,
  dpi: 203,

  marginTopMm: 0.7,
  marginRightMm: 0.5,
  marginBottomMm: 1.2,
  marginLeftMm: 0.5,
  sectionGapMm: 0.5,
  rackWidthPercent: 49,
  rowGapMm: 0.6,
  dividerThicknessMm: 0.35,

  showRack: true,
  lockRack: false,
  rackFontScale: 0.95,
  rackAlign: 'center',
  rackOffsetX: 0,
  rackOffsetY: 0,
  rackWidthMm: 0,
  rackHeightMm: 0,

  showColumnBar: true,
  lockColumn: false,
  columnOffsetX: 0,
  columnOffsetY: 0,
  columnWidthMm: 0,
  columnHeightMm: 0,

  showShelf: true,
  lockShelf: false,
  shelfOffsetX: 0,
  shelfOffsetY: 0,
  shelfWidthMm: 0,
  shelfHeightMm: 0,

  headerFontScale: 0.86,
  valueFontScale: 1.12,
  rightRowHeightPercent: 49,
  showDividers: true,
  rightOffsetX: 0,
  rightOffsetY: 0,

  showBarcode: true,
  lockBarcode: false,
  barcodeHeightMm: 12,
  barcodeWidthPercent: 70,
  barcodeWidthMm: 0,
  barcodeOffsetX: 0,
  barcodeOffsetY: 0,

  showBarcodeText: true,
  lockBarcodeText: false,
  barcodeTextFontScale: 1.15,
  barcodeTextBold: true,
  barcodeTextOffsetX: 0,
  barcodeTextOffsetY: 0,
  barcodeTextWidthMm: 0,
  barcodeTextHeightMm: 0,

  columnLabel: 'KOLUMNA',
  shelfLabel: 'PÓŁKA',
  codeTemplate: '{regal}-{kolumna}-{polka}',
  asciiFallback: false,

  printOffsetXmm: 0,
  printOffsetYmm: 0,
  printScaleXPercent: 100,
  printScaleYPercent: 100,
};

export const DEFAULT_STATE: AppState = {
  config: DEFAULT_CONFIG,
  single: { rack: 'A10', column: '06', shelf: '03' },
  batch: { racks: 'A10', colFrom: 1, colTo: 6, shelfFrom: 1, shelfTo: 4, pad: 2 },
  tab: 'single',
};
