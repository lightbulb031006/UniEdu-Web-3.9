/**
 * Currency Input Component
 * Input component with automatic thousand separator formatting
 * Migrated from backup/assets/js/ui.js - attachCurrencyInput
 */

import React from 'react';
import { useCurrencyInput } from '../hooks/useCurrencyInput';
import { numberToVietnameseText } from '../utils/numberToVietnameseText';
import { formatCurrencyInputValue } from '../hooks/useCurrencyInput';

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value?: number;
  onChange?: (value: number) => void;
  required?: boolean;
  initialValue?: number;
  showHint?: boolean; // Show "Bằng chữ" hint below input
}

export function CurrencyInput({
  value,
  onChange,
  required = false,
  initialValue,
  showHint = true,
  ...inputProps
}: CurrencyInputProps) {
  const currencyInput = useCurrencyInput({
    initialValue: initialValue ?? value ?? 0,
    required,
    onChange,
  });

  // Sync external value changes
  React.useEffect(() => {
    if (value !== undefined && value !== currencyInput.numericValue) {
      currencyInput.setValue(value);
    }
  }, [value]);

  // Calculate hint text
  const numericValue = currencyInput.numericValue;
  const hasDigits = currencyInput.value.length > 0 && currencyInput.value !== '-';
  
  let wordsText = 'Bằng chữ: -';
  let digitsText = '= 0 đ';
  
  if (hasDigits) {
    if (numericValue > 0) {
      const words = numberToVietnameseText(numericValue);
      wordsText = `Bằng chữ: ${words || '-'}`;
      digitsText = `= ${formatCurrencyInputValue(String(numericValue))} đ`;
    } else if (numericValue === 0) {
      wordsText = 'Bằng chữ: Không đồng';
      digitsText = '= 0 đ';
    } else if (numericValue < 0) {
      const words = numberToVietnameseText(numericValue);
      wordsText = `Bằng chữ: ${words || '-'}`;
      digitsText = `= ${formatCurrencyInputValue(String(numericValue))} đ`;
    }
  }

  return (
    <div>
      <input
        {...currencyInput.inputProps}
        {...inputProps}
        className={`currency-input ${inputProps.className || ''}`}
      />
      {showHint && (
        <div className="currency-hint" style={{ marginTop: 'var(--spacing-1)', fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
          <div className="currency-hint-line">{wordsText}</div>
          <div className="currency-hint-line">{digitsText}</div>
        </div>
      )}
    </div>
  );
}

