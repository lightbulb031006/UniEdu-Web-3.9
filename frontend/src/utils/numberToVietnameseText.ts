/**
 * Convert number to Vietnamese words
 * Migrated from backup/assets/js/data.js - numberToVietnameseText
 */

export function numberToVietnameseText(amount: number | string | null | undefined): string {
  const n = Number.isFinite(Number(amount)) ? Math.floor(Number(amount)) : NaN;
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'Không đồng';
  
  // Xử lý số âm: lấy giá trị tuyệt đối và thêm "Âm" vào đầu
  const isNegative = n < 0;
  const absN = Math.abs(n);

  const digitWords = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const unitWords = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];

  function readThreeDigits(num: number, full: boolean): string {
    const hundreds = Math.floor(num / 100);
    const tens = Math.floor((num % 100) / 10);
    const units = num % 10;
    let result = '';

    if (hundreds > 0 || full) {
      result += `${digitWords[hundreds]} trăm`;
    }

    if (tens > 1) {
      result += (result ? ' ' : '') + `${digitWords[tens]} mươi`;
      if (units === 1) {
        result += ' mốt';
      } else if (units === 4) {
        result += ' tư';
      } else if (units === 5) {
        result += ' lăm';
      } else if (units > 0) {
        result += ' ' + digitWords[units];
      }
    } else if (tens === 1) {
      result += (result ? ' ' : '') + 'mười';
      if (units === 1) {
        result += ' một';
      } else if (units === 4) {
        result += ' bốn';
      } else if (units === 5) {
        result += ' lăm';
      } else if (units > 0) {
        result += ' ' + digitWords[units];
      }
    } else if (tens === 0 && units > 0) {
      if (hundreds > 0 || full) {
        result += (result ? ' ' : '') + 'lẻ';
      }
      if (units === 4 && tens !== 0) {
        result += ' tư';
      } else if (units === 5 && (hundreds > 0 || full)) {
        result += ' năm';
      } else {
        result += (result ? ' ' : '') + digitWords[units];
      }
    }

    return result.trim();
  }

  let remaining = absN;
  let groupIndex = 0;
  let parts: string[] = [];

  while (remaining > 0 && groupIndex < unitWords.length) {
    const groupValue = remaining % 1000;
    if (groupValue > 0) {
      const full = groupIndex > 0 && groupValue < 100;
      const groupText = readThreeDigits(groupValue, full);
      const suffix = unitWords[groupIndex] ? ' ' + unitWords[groupIndex] : '';
      parts.unshift(groupText + suffix);
    }
    remaining = Math.floor(remaining / 1000);
    groupIndex += 1;
  }

  const sentence = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!sentence) return '';

  const wordsText = sentence.charAt(0).toUpperCase() + sentence.slice(1) + ' đồng';
  // Thêm "Âm" vào đầu nếu là số âm
  return isNegative ? 'Âm ' + wordsText.toLowerCase() : wordsText;
}

