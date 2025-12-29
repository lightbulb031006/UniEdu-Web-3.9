/**
 * Formatting Utilities
 * Migrated from backup/assets/js/pages/dashboard.js
 */

/**
 * Format currency to VND
 */
export function formatCurrencyVND(value: number | string | null | undefined): string {
  const numeric = Number(value || 0);
  return `${numeric.toLocaleString('vi-VN')} đ`;
}

/**
 * Format number with Vietnamese locale
 */
export function formatNumber(value: number | string | null | undefined): string {
  return Number(value || 0).toLocaleString('vi-VN');
}

/**
 * Format short currency (K, M, B)
 */
export function formatShortCurrency(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(0)}K`;
  }
  return `${n}`;
}

/**
 * Format date to Vietnamese format
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format month key (YYYY-MM) to display format
 */
export function formatMonthKey(key: string | null | undefined): string {
  if (!key) return '';
  const match = key.match(/^(\d{4})-(\d{2})$/);
  if (!match) return key;
  return `${match[2]}/${match[1].slice(-2)}`;
}

/**
 * Format month label (YYYY-MM) to "MM/YYYY" format
 * Migrated from backup/assets/js/pages/staff.js
 */
export function formatMonthLabel(month: string | null | undefined): string {
  if (!month || typeof month !== 'string') return '';
  const [year, monthPart] = month.split('-');
  if (!year || !monthPart) return month;
  return `${monthPart.padStart(2, '0')}/${year}`;
}

