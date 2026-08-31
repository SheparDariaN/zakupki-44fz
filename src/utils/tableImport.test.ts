import { describe, expect, it } from 'vitest';
import type { AppState, Supplier } from '../types';
import {
  applyColumnPaste,
  importTable,
  parseColumnPasteValues,
  parsePrice,
  parseQuantity,
  parseTsvRows,
} from './tableImport';

const suppliers: Supplier[] = [
  { id: 's1', name: 'Поставщик 1', kpDetails: 'Вх. 1' },
  { id: 's2', name: 'Поставщик 2', kpDetails: 'Вх. 2' },
];

function createState(): AppState {
  return {
    requisites: {
      customer: '',
      subject: '',
      date: '',
      executorName: '',
      executorPosition: '',
    },
    suppliers,
    positions: [
      { id: 'p1', name: 'Позиция 1', unit: 'шт', quantity: 1 },
      { id: 'p2', name: 'Позиция 2', unit: 'шт', quantity: 2 },
    ],
    prices: [{ positionId: 'p1', supplierId: 's1', price: 100 }],
  };
}

describe('parseTsvRows', () => {
  it('разбирает TSV-строки и игнорирует пустые строки', () => {
    expect(parseTsvRows('Товар 1\tшт\t2\r\n\r\nТовар 2\tкг\t3\n')).toEqual([
      ['Товар 1', 'шт', '2'],
      ['Товар 2', 'кг', '3'],
    ]);
  });
});

describe('parsePrice', () => {
  it('разбирает русские денежные значения', () => {
    expect(parsePrice('1 234,56 ₽')).toBe(1234.56);
    expect(parsePrice('')).toBe(0);
    expect(parsePrice('нет цены')).toBe(0);
  });
});

describe('parseQuantity', () => {
  it('возвращает целое количество не меньше 1', () => {
    expect(parseQuantity('12,7')).toBe(12);
    expect(parseQuantity('0')).toBe(1);
    expect(parseQuantity('')).toBe(1);
    expect(parseQuantity('-5')).toBe(1);
  });
});

describe('parseColumnPasteValues', () => {
  it('возвращает первый столбец многострочной вставки', () => {
    expect(parseColumnPasteValues('А\tлишнее\nБ\tлишнее\n')).toEqual(['А', 'Б']);
  });

  it('не считает однострочный текст колонкой', () => {
    expect(parseColumnPasteValues('А\tБ')).toBeNull();
    expect(parseColumnPasteValues('А\n')).toBeNull();
  });
});

describe('importTable', () => {
  it('импортирует позиции по первым трём колонкам без цен', () => {
    const result = importTable('Бумага\tупак\t10\nРучка\tшт\t', suppliers, { now: () => 1000 });

    expect(result.positions).toEqual([
      { id: '1000_0', name: 'Бумага', unit: 'упак', quantity: 10 },
      { id: '1000_1', name: 'Ручка', unit: 'шт', quantity: 1 },
    ]);
    expect(result.prices).toEqual([
      { positionId: '1000_0', supplierId: 's1', price: 0 },
      { positionId: '1000_0', supplierId: 's2', price: 0 },
      { positionId: '1000_1', supplierId: 's1', price: 0 },
      { positionId: '1000_1', supplierId: 's2', price: 0 },
    ]);
  });

  it('импортирует цены по поставщикам слева направо', () => {
    const result = importTable(
      'Бумага\tупак\t10\t1 234,56 ₽\t2000\nРучка\tшт\t3\t15,5',
      suppliers,
      { now: () => 2000 },
    );

    expect(result.positions).toEqual([
      { id: '2000_0', name: 'Бумага', unit: 'упак', quantity: 10 },
      { id: '2000_1', name: 'Ручка', unit: 'шт', quantity: 3 },
    ]);
    expect(result.prices).toEqual([
      { positionId: '2000_0', supplierId: 's1', price: 1234.56 },
      { positionId: '2000_0', supplierId: 's2', price: 2000 },
      { positionId: '2000_1', supplierId: 's1', price: 15.5 },
      { positionId: '2000_1', supplierId: 's2', price: 0 },
    ]);
  });

  it('пропускает строки без наименования', () => {
    const result = importTable(
      'Бумага\tупак\t10\t100\t200\n\tшт\t1\t300\t400\nРучка\tшт\t3\t15,5\t20',
      suppliers,
      { now: () => 2500 },
    );

    expect(result.positions).toEqual([
      { id: '2500_0', name: 'Бумага', unit: 'упак', quantity: 10 },
      { id: '2500_1', name: 'Ручка', unit: 'шт', quantity: 3 },
    ]);
    expect(result.prices).toEqual([
      { positionId: '2500_0', supplierId: 's1', price: 100 },
      { positionId: '2500_0', supplierId: 's2', price: 200 },
      { positionId: '2500_1', supplierId: 's1', price: 15.5 },
      { positionId: '2500_1', supplierId: 's2', price: 20 },
    ]);
  });
});

describe('applyColumnPaste', () => {
  it('раскладывает значения вниз и дописывает недостающие позиции', () => {
    const state = createState();
    const nextState = applyColumnPaste(state, 1, 'name', ['Новая 2', 'Новая 3\tлишнее'], undefined, {
      now: () => 3000,
    });

    expect(nextState.positions).toEqual([
      { id: 'p1', name: 'Позиция 1', unit: 'шт', quantity: 1 },
      { id: 'p2', name: 'Новая 2', unit: 'шт', quantity: 2 },
      { id: '3000_2', name: 'Новая 3', unit: 'шт', quantity: 1 },
    ]);
    expect(state.positions).toHaveLength(2);
    expect(state.positions[1].name).toBe('Позиция 2');
  });

  it('парсит количество при вставке столбца', () => {
    const nextState = applyColumnPaste(createState(), 0, 'quantity', ['5', '0', '2,9'], undefined, {
      now: () => 4000,
    });

    expect(nextState.positions.map(position => position.quantity)).toEqual([5, 1, 2]);
  });

  it('обновляет или создаёт цены для выбранного поставщика', () => {
    const nextState = applyColumnPaste(
      createState(),
      0,
      'price',
      ['1 500,25 ₽', '42'],
      's1',
      { now: () => 5000 },
    );

    expect(nextState.prices).toEqual([
      { positionId: 'p1', supplierId: 's1', price: 1500.25 },
      { positionId: 'p2', supplierId: 's1', price: 42 },
    ]);
  });
});
