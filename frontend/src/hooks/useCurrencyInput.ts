/**
 * Currency Input Hook
 * Handles currency input formatting with thousand separators (.)
 * Migrated from backup/assets/js/ui.js - attachCurrencyInput
 */

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Sanitize currency digits - remove all non-digit characters
 */
function sanitizeCurrencyDigits(value: string): string {
  const str = String(value ?? '').trim();
  const isNegative = str.startsWith('-');
  const digits = str.replace(/[^\d]/g, '');
  if (isNegative) {
    return '-' + digits;
  }
  return digits;
}

/**
 * Format currency digits with thousand separators (.)
 */
function formatCurrencyDigits(digits: string): string {
  if (!digits) return '';
  const isNegative = digits.startsWith('-');
  const numStr = isNegative ? digits.slice(1) : digits;
  const cleaned = numStr.replace(/^0+/, '') || '0';
  const formatted = cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? '-' + formatted : formatted;
}

/**
 * Parse currency string to number
 */
function parseCurrencyString(value: string): number {
  const digits = sanitizeCurrencyDigits(value);
  if (!digits || digits === '-') return 0;
  return digits.startsWith('-') ? -parseInt(digits.slice(1), 10) : parseInt(digits, 10);
}

export interface UseCurrencyInputOptions {
  initialValue?: number;
  required?: boolean;
  onChange?: (value: number) => void;
}

export interface UseCurrencyInputReturn {
  value: string;
  numericValue: number;
  setValue: (value: number | string) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
  handleFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  inputProps: {
    type: 'text';
    inputMode: 'numeric';
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
    autoComplete: 'off';
    spellCheck: false;
  };
}

/**
 * Hook for currency input with thousand separator formatting
 */
export function useCurrencyInput(options: UseCurrencyInputOptions = {}): UseCurrencyInputReturn {
  const { initialValue = 0, required = false, onChange } = options;
  
  // Initialize display value from initialValue immediately (lazy initialization)
  const getInitialDisplayValue = (val: number) => {
    if (val === 0) return '';
    const digits = String(val);
    const sanitized = sanitizeCurrencyDigits(digits);
    return formatCurrencyDigits(sanitized);
  };
  
  const [displayValue, setDisplayValue] = useState<string>(() => getInitialDisplayValue(initialValue));
  const [numericValue, setNumericValue] = useState<number>(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Initialize display value from initialValue when it changes
  useEffect(() => {
    if (initialValue !== undefined && initialValue !== numericValue) {
      const digits = String(initialValue);
      const sanitized = sanitizeCurrencyDigits(digits);
      const formatted = formatCurrencyDigits(sanitized);
      setDisplayValue(formatted);
      setNumericValue(initialValue);
    }
  }, [initialValue]);

  const updateValue = useCallback(
    (newValue: string | number, silent = false) => {
      let digits: string;
      if (typeof newValue === 'number') {
        digits = String(newValue);
      } else {
        digits = sanitizeCurrencyDigits(newValue);
      }

      const isNegativeOnly = digits === '-';
      const hasDigits = digits.length > 0 && digits !== '-';

      let numeric = 0;
      if (hasDigits) {
        numeric = digits.startsWith('-') ? -parseInt(digits.slice(1), 10) : parseInt(digits, 10);
      }

      // Update display value
      if (isNegativeOnly) {
        setDisplayValue('-');
      } else if (hasDigits) {
        setDisplayValue(formatCurrencyDigits(digits));
      } else {
        setDisplayValue('');
      }

      setNumericValue(numeric);

      if (!silent && onChange) {
        onChange(numeric);
      }

      return numeric;
    },
    [onChange]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const currentValue = e.target.value;
      // Allow negative sign at the beginning
      if (currentValue === '-') {
        setDisplayValue('-');
        setNumericValue(0);
        return;
      }
      updateValue(currentValue);
    },
    [updateValue]
  );

  const handleBlur = useCallback(() => {
    const digits = sanitizeCurrencyDigits(displayValue);
    if (digits === '-') {
      setDisplayValue('-');
    } else {
      setDisplayValue(formatCurrencyDigits(digits));
    }
  }, [displayValue]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.select();
    }, 0);
  }, []);

  const setValue = useCallback(
    (value: number | string) => {
      updateValue(value, false);
    },
    [updateValue]
  );

  return {
    value: displayValue,
    numericValue,
    setValue,
    handleChange,
    handleBlur,
    handleFocus,
    inputProps: {
      type: 'text',
      inputMode: 'numeric' as const,
      value: displayValue,
      onChange: handleChange,
      onBlur: handleBlur,
      onFocus: handleFocus,
      autoComplete: 'off',
      spellCheck: false,
    },
  };
}

/**
 * Format currency value for display (with thousand separators)
 */
export function formatCurrencyInputValue(value: number | string): string {
  const digits = String(value || 0);
  const sanitized = sanitizeCurrencyDigits(digits);
  return formatCurrencyDigits(sanitized);
}

/**
 * Parse currency string to number
 */
export { parseCurrencyString };

