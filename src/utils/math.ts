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
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((a, b) => a + b, 0);
  return round(sum / numbers.length);
};

export const calculateStandardDeviation = (numbers: number[], average: number): number => {
  if (numbers.length === 0) return 0;
  // According to standard formula for sample standard deviation it's N-1, but for small samples N is sometimes used.
  // Standard N-1:
  if (numbers.length === 1) return 0;
  const variance = numbers.reduce((sum, num) => sum + Math.pow(num - average, 2), 0) / (numbers.length - 1);
  return Math.sqrt(variance);
};

export const calculateCV = (numbers: number[]): number => {
  if (numbers.length <= 1) return 0;
  const avg = calculateAverage(numbers);
  if (avg === 0) return 0;
  const stdDev = calculateStandardDeviation(numbers, avg);
  return round((stdDev / avg) * 100);
};

export const formatMoney = (amount: number): string => {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\s/g, ' '); // ensure normal spaces or let locale handle it
};

export const formatMoney4 = (amount: number): string => {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).replace(/\s/g, ' ');
};
