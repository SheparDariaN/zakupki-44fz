const ones: string[] = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const onesFemale: string[] = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const teens: string[] = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const tens: string[] = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const hundreds: string[] = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

function getPlural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) {
    return forms[0];
  }
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
    return forms[1];
  }
  return forms[2];
}

function groupToWords(num: number, gender: 'm' | 'f' = 'm'): string {
  if (num === 0) return '';
  const words: string[] = [];
  
  const h = Math.floor(num / 100);
  if (h > 0) words.push(hundreds[h]);
  
  const rem = num % 100;
  if (rem >= 10 && rem < 20) {
    words.push(teens[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (t > 0) words.push(tens[t]);
    if (o > 0) {
      words.push(gender === 'm' ? ones[o] : onesFemale[o]);
    }
  }
  
  return words.join(' ');
}

export function numberToWords(amount: number): { words: string; rublesWord: string; kopecksWord: string; kopecks: string } {
  const rubles = Math.floor(amount);
  const kopecks = Math.round((amount - rubles) * 100);
  const kopecksStr = kopecks.toString().padStart(2, '0');

  const rublesWord = getPlural(rubles, ['рубль', 'рубля', 'рублей']);
  const kopecksWord = getPlural(kopecks, ['копейка', 'копейки', 'копеек']);

  if (rubles === 0) {
    return { words: 'ноль', rublesWord, kopecksWord, kopecks: kopecksStr };
  }

  const parts: string[] = [];
  
  const billions = Math.floor(rubles / 1000000000) % 1000;
  const millions = Math.floor(rubles / 1000000) % 1000;
  const thousands = Math.floor(rubles / 1000) % 1000;
  const units = rubles % 1000;

  if (billions > 0) {
    parts.push(groupToWords(billions, 'm'));
    parts.push(getPlural(billions, ['миллиард', 'миллиарда', 'миллиардов']));
  }
  
  if (millions > 0) {
    parts.push(groupToWords(millions, 'm'));
    parts.push(getPlural(millions, ['миллион', 'миллиона', 'миллионов']));
  }
  
  if (thousands > 0) {
    parts.push(groupToWords(thousands, 'f'));
    parts.push(getPlural(thousands, ['тысяча', 'тысячи', 'тысяч']));
  }
  
  if (units > 0) {
    parts.push(groupToWords(units, 'm'));
  }

  const words = parts.join(' ').trim();

  return {
    words,
    rublesWord,
    kopecksWord,
    kopecks: kopecksStr
  };
}
