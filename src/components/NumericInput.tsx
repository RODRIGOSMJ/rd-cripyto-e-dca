import React, { useEffect, useState } from 'react';

interface NumericInputProps {
  value: number;
  onValueChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  decimalsOnBlur?: number | null;
  showZero?: boolean;
  ariaLabel?: string;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onValueChange,
  placeholder = '0',
  className = '',
  decimalsOnBlur = null,
  showZero = false,
  ariaLabel
}) => {
  const formatVal = (v: number): string => {
    if (!showZero && (!v || v <= 0)) return '';
    if (decimalsOnBlur !== null) {
      return Number(v.toFixed(decimalsOnBlur)).toString();
    }
    return String(v);
  };

  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState<string>(() => formatVal(value));

  useEffect(() => {
    if (!isFocused) {
      setText(formatVal(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (raw.trim() === '') {
      onValueChange(0);
      return;
    }

    const normalized = raw.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onValueChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const normalized = text.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (Number.isNaN(parsed) || parsed <= 0) {
      onValueChange(0);
      setText(showZero ? '0' : '');
    } else {
      onValueChange(parsed);
      setText(formatVal(parsed));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
    />
  );
};
