export const CV_HOMOGENEITY_THRESHOLD_PERCENT = 33;

/** Цены, которые входят в среднее, СКО и CV: строго больше нуля. */
export const pricesForStats = (numbers: number[]): number[] =>
  numbers.filter((n) => n > 0);

export const isCvHeterogeneous = (cv: number): boolean =>
  cv > CV_HOMOGENEITY_THRESHOLD_PERCENT;

export const round = (num: number, decimals: number = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

export const calculateReducedPrice = (price: number, taxType: 'С НДС' | 'УСН'): number => {
  if (!price) return 0;
  if (taxType === 'С НДС') {
    return round(price / 1.2);
  }
  return round(price);
};

export const calculateAverage = (numbers: number[]): number => {
  const sample = pricesForStats(numbers);
  if (sample.length === 0) return 0;
  const sum = sample.reduce((a, b) => a + b, 0);
  return round(sum / sample.length);
};

export const calculateStandardDeviation = (numbers: number[], average: number): number => {
  const sample = pricesForStats(numbers);
  if (sample.length <= 1) return 0;
  const variance = sample.reduce((sum, num) => sum + Math.pow(num - average, 2), 0) / (sample.length - 1);
  return Math.sqrt(variance);
};

export const calculateCV = (numbers: number[]): number => {
  const sample = pricesForStats(numbers);
  if (sample.length <= 1) return 0;
  const avg = calculateAverage(sample);
  if (avg === 0) return 0;
  const stdDev = calculateStandardDeviation(sample, avg);
  return round((stdDev / avg) * 100);
};

export const formatMoney = (amount: number): string => {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\s/g, ' ');
};

export const formatMoney4 = (amount: number): string => {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).replace(/\s/g, ' ');
};
