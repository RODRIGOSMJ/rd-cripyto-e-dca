import React, { useEffect, useRef, useState } from 'react';
import { formatEditableNumber, parseFlexibleNumber } from '../utils/calculations';

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
    if (showZero && (!v || v <= 0)) return '0';
    return formatEditableNumber(v, decimalsOnBlur ?? undefined);
  };

  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState<string>(() => formatVal(value));
  const hasEditedRef = useRef(false);

  useEffect(() => {
    if (!isFocused) {
      setText(formatVal(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    hasEditedRef.current = true;
    setText(raw);

    if (raw.trim() === '') {
      onValueChange(0);
      return;
    }

    const parsed = parseFlexibleNumber(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onValueChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!hasEditedRef.current) {
      // Não dispara alteração se o usuário apenas clicou e saiu sem editar
      setText(formatVal(value));
      return;
    }
    hasEditedRef.current = false;

    const parsed = parseFlexibleNumber(text);
    if (!Number.isFinite(parsed) || parsed <= 0) {
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
      onFocus={() => {
        hasEditedRef.current = false;
        setIsFocused(true);
      }}
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

