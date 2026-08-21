import { describe, expect, it } from 'vitest';
import {
  CV_HOMOGENEITY_THRESHOLD_PERCENT,
  calculateAverage,
  calculateCV,
  calculateReducedPrice,
  calculateStandardDeviation,
  formatMoney,
  formatMoney4,
  isCvHeterogeneous,
  pricesForStats,
  round,
} from './math';

const normalizeSpaces = (value: string) => value.replace(/\s/g, ' ');

describe('pricesForStats', () => {
  it('исключает нули, отрицательные и пустые значения', () => {
    expect(pricesForStats([100, 0, 200, -5, 0.01])).toEqual([100, 200, 0.01]);
    expect(pricesForStats([])).toEqual([]);
    expect(pricesForStats([0, 0])).toEqual([]);
  });
});

describe('round', () => {
  it('округляет до заданного числа знаков', () => {
    expect(round(1.234, 2)).toBe(1.23);
    expect(round(1.235, 2)).toBe(1.24);
    expect(round(10, 2)).toBe(10);
  });
});

describe('calculateAverage', () => {
  it('считает среднее по ценам > 0 и округляет до 2 знаков', () => {
    expect(calculateAverage([100, 200, 300])).toBe(200);
    expect(calculateAverage([10.125, 20.125])).toBe(15.13);
  });

  it('не включает нули в выборку', () => {
    expect(calculateAverage([100, 0, 200])).toBe(150);
    expect(calculateAverage([0, 0])).toBe(0);
    expect(calculateAverage([])).toBe(0);
  });
});

describe('calculateStandardDeviation', () => {
  it('использует выборку N−1, а не N', () => {
    const sample = [1, 3];
    const avg = calculateAverage(sample);
    expect(avg).toBe(2);
    expect(calculateStandardDeviation(sample, avg)).toBeCloseTo(Math.sqrt(2), 10);
    expect(calculateStandardDeviation(sample, avg)).not.toBeCloseTo(1, 5);
  });

  it('возвращает 0 при N ≤ 1', () => {
    expect(calculateStandardDeviation([], 0)).toBe(0);
    expect(calculateStandardDeviation([42], 42)).toBe(0);
    expect(calculateStandardDeviation([0, 42], 42)).toBe(0);
  });

  it('не включает нули в выборку', () => {
    const numbers = [100, 0, 200];
    const avg = calculateAverage(numbers);
    const expected = Math.sqrt(((100 - 150) ** 2 + (200 - 150) ** 2) / 1);
    expect(avg).toBe(150);
    expect(calculateStandardDeviation(numbers, avg)).toBeCloseTo(expected, 10);
  });
});

describe('calculateCV', () => {
  it('считает (СКО / среднее) × 100 с округлением до 2 знаков', () => {
    expect(calculateCV([100, 200, 300])).toBe(50);
    expect(calculateCV([1, 3])).toBe(70.71);
  });

  it('возвращает 0 при недостаточной выборке', () => {
    expect(calculateCV([])).toBe(0);
    expect(calculateCV([10])).toBe(0);
    expect(calculateCV([0, 10])).toBe(0);
  });

  it('не включает нули и помечает неоднородность при CV > 33%', () => {
    const cv = calculateCV([100, 0, 200]);
    expect(cv).toBe(47.14);
    expect(isCvHeterogeneous(cv)).toBe(true);
    expect(isCvHeterogeneous(33)).toBe(false);
    expect(isCvHeterogeneous(33.01)).toBe(true);
    expect(CV_HOMOGENEITY_THRESHOLD_PERCENT).toBe(33);
  });
});

describe('calculateReducedPrice', () => {
  it('при «С НДС» делит на 1.2 и округляет до 2 знаков', () => {
    expect(calculateReducedPrice(120, 'С НДС')).toBe(100);
    expect(calculateReducedPrice(119.99, 'С НДС')).toBe(99.99);
  });

  it('при УСН и нулевой цене не меняет логику шаблона', () => {
    expect(calculateReducedPrice(100.456, 'УСН')).toBe(100.46);
    expect(calculateReducedPrice(0, 'С НДС')).toBe(0);
  });
});

describe('formatMoney', () => {
  it('форматирует рубли с двумя знаками и разделителями ru-RU', () => {
    expect(normalizeSpaces(formatMoney(1234.5))).toBe('1 234,50');
    expect(normalizeSpaces(formatMoney(0))).toBe('0,00');
    expect(normalizeSpaces(formatMoney(1_000_000.1))).toBe('1 000 000,10');
  });

  it('для СКО даёт четыре знака', () => {
    expect(normalizeSpaces(formatMoney4(Math.sqrt(2)))).toBe('1,4142');
  });
});
