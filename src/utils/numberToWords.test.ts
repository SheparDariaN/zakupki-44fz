import { describe, expect, it } from 'vitest';
import { formatAmountInWords, numberToWords } from './numberToWords';

describe('numberToWords', () => {
  it('обрабатывает ноль и копейки', () => {
    expect(numberToWords(0)).toEqual({
      words: 'ноль',
      rublesWord: 'рублей',
      kopecksWord: 'копеек',
      kopecks: '00',
    });
    expect(numberToWords(0.01)).toMatchObject({
      words: 'ноль',
      rublesWord: 'рублей',
      kopecksWord: 'копейка',
      kopecks: '01',
    });
    expect(numberToWords(0.02)).toMatchObject({ kopecksWord: 'копейки', kopecks: '02' });
    expect(numberToWords(0.05)).toMatchObject({ kopecksWord: 'копеек', kopecks: '05' });
  });

  it('склоняет рубли', () => {
    expect(numberToWords(1)).toMatchObject({ words: 'один', rublesWord: 'рубль' });
    expect(numberToWords(2)).toMatchObject({ words: 'два', rublesWord: 'рубля' });
    expect(numberToWords(5)).toMatchObject({ words: 'пять', rublesWord: 'рублей' });
    expect(numberToWords(11)).toMatchObject({ words: 'одиннадцать', rublesWord: 'рублей' });
    expect(numberToWords(21)).toMatchObject({ words: 'двадцать один', rublesWord: 'рубль' });
    expect(numberToWords(22)).toMatchObject({ words: 'двадцать два', rublesWord: 'рубля' });
    expect(numberToWords(111)).toMatchObject({ words: 'сто одиннадцать', rublesWord: 'рублей' });
  });

  it('использует женский род для тысяч', () => {
    expect(numberToWords(1000)).toMatchObject({ words: 'одна тысяча', rublesWord: 'рублей' });
    expect(numberToWords(2000)).toMatchObject({ words: 'две тысячи', rublesWord: 'рублей' });
    expect(numberToWords(5000)).toMatchObject({ words: 'пять тысяч', rublesWord: 'рублей' });
    expect(numberToWords(1234.56)).toMatchObject({
      words: 'одна тысяча двести тридцать четыре',
      rublesWord: 'рубля',
      kopecks: '56',
      kopecksWord: 'копеек',
    });
  });

  it('покрывает миллионы, миллиарды и крайние суммы', () => {
    expect(numberToWords(1_000_000)).toMatchObject({ words: 'один миллион', rublesWord: 'рублей' });
    expect(numberToWords(2_000_000)).toMatchObject({ words: 'два миллиона' });
    expect(numberToWords(5_000_000)).toMatchObject({ words: 'пять миллионов' });
    expect(numberToWords(1_000_000_000)).toMatchObject({ words: 'один миллиард' });
    expect(numberToWords(1_234_567_890.12)).toMatchObject({
      words: 'один миллиард двести тридцать четыре миллиона пятьсот шестьдесят семь тысяч восемьсот девяносто',
      rublesWord: 'рублей',
      kopecks: '12',
      kopecksWord: 'копеек',
    });
  });

  it('переносит 100 копеек в следующий рубль', () => {
    expect(numberToWords(2.995)).toMatchObject({
      words: 'три',
      rublesWord: 'рубля',
      kopecks: '00',
      kopecksWord: 'копеек',
    });
  });

  it('не принимает отрицательные и нечисловые суммы', () => {
    expect(numberToWords(-10.5)).toMatchObject({ words: 'ноль', kopecks: '00' });
    expect(numberToWords(Number.NaN)).toMatchObject({ words: 'ноль', kopecks: '00' });
  });
});

describe('formatAmountInWords', () => {
  it('собирает строку для заключения НМЦК', () => {
    expect(formatAmountInWords(1234.56)).toBe(
      'одна тысяча двести тридцать четыре рубля 56 копеек',
    );
    expect(formatAmountInWords(1)).toBe('один рубль 00 копеек');
    expect(formatAmountInWords(0.5)).toBe('ноль рублей 50 копеек');
  });
});
