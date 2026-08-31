import type { AppState, Position, PriceEntry, Supplier } from '../types';

export type ColumnPasteField = 'name' | 'unit' | 'quantity' | 'price';

export interface ImportTableResult {
  positions: Position[];
  prices: PriceEntry[];
}

export interface TableImportOptions {
  now?: () => number;
}

const DEFAULT_UNIT = 'шт';

function timestamp(options?: TableImportOptions): number {
  return options?.now ? options.now() : Date.now();
}

function createPositionId(baseTimestamp: number, index: number): string {
  return `${baseTimestamp}_${index}`;
}

function createEmptyPosition(id: string): Position {
  return {
    id,
    name: '',
    unit: DEFAULT_UNIT,
    quantity: 1,
  };
}

export function parseTsvRows(text: string): string[][] {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return normalizedText
    .split('\n')
    .map(line => line.split('\t').map(cell => cell.trim()))
    .filter(row => row.some(cell => cell.length > 0));
}

export function parsePrice(value: string): number {
  const normalizedValue = value
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');
  const parsedValue = Number.parseFloat(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export function parseQuantity(value: string): number {
  const normalizedValue = value
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');
  const parsedValue = Math.floor(Number.parseFloat(normalizedValue));

  return Number.isFinite(parsedValue) && parsedValue >= 1 ? parsedValue : 1;
}

export function parseColumnPasteValues(text: string): string[] | null {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!normalizedText.includes('\n')) {
    return null;
  }

  const lines = normalizedText.split('\n');

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (lines.length <= 1) {
    return null;
  }

  return lines.map(line => line.split('\t')[0].trim());
}

export function importTable(
  text: string,
  suppliers: Supplier[],
  options?: TableImportOptions,
): ImportTableResult {
  const rows = parseTsvRows(text).filter(row => (row[0] ?? '').length > 0);
  const baseTimestamp = timestamp(options);

  const positions = rows.map<Position>((row, index) => ({
    id: createPositionId(baseTimestamp, index),
    name: row[0] ?? '',
    unit: row[1] || DEFAULT_UNIT,
    quantity: parseQuantity(row[2] ?? ''),
  }));

  const prices = positions.flatMap<PriceEntry>((position, positionIndex) =>
    suppliers.map((supplier, supplierIndex) => ({
      positionId: position.id,
      supplierId: supplier.id,
      price: parsePrice(rows[positionIndex]?.[supplierIndex + 3] ?? ''),
    })),
  );

  return { positions, prices };
}

function getFirstCell(value: string): string {
  return value.split('\t')[0].trim();
}

function updatePrice(
  prices: PriceEntry[],
  positionId: string,
  supplierId: string,
  price: number,
): PriceEntry[] {
  const existingIndex = prices.findIndex(
    entry => entry.positionId === positionId && entry.supplierId === supplierId,
  );

  if (existingIndex === -1) {
    return [...prices, { positionId, supplierId, price }];
  }

  return prices.map((entry, index) => (index === existingIndex ? { ...entry, price } : entry));
}

export function applyColumnPaste(
  state: AppState,
  startIndex: number,
  field: ColumnPasteField,
  values: string[],
  supplierId?: string,
  options?: TableImportOptions,
): AppState {
  if (values.length === 0 || (field === 'price' && !supplierId)) {
    return state;
  }

  const normalizedStartIndex = Math.max(0, startIndex);
  const baseTimestamp = timestamp(options);
  const positions = [...state.positions];

  for (let index = positions.length; index < normalizedStartIndex + values.length; index += 1) {
    positions.push(createEmptyPosition(createPositionId(baseTimestamp, index)));
  }

  let prices = state.prices;

  values.forEach((rawValue, valueIndex) => {
    const positionIndex = normalizedStartIndex + valueIndex;
    const position = positions[positionIndex];
    const value = getFirstCell(rawValue);

    if (!position) {
      return;
    }

    if (field === 'price') {
      prices = updatePrice(prices, position.id, supplierId, parsePrice(value));
      return;
    }

    positions[positionIndex] = {
      ...position,
      [field]: field === 'quantity' ? parseQuantity(value) : value,
    };
  });

  return {
    ...state,
    positions,
    prices,
  };
}
