import React from 'react';
import { CurrencyMode } from '../types';
import { formatBRL, formatUSDT } from '../utils/calculations';

interface DualMoneyProps {
  amountUSD: number;
  currency: CurrencyMode;
  fxRate: number;
  forceDecimals?: number | null;
  customBrlVal?: number | null;
  subClassName?: string;
  prefix?: string;
}

export const DualMoney: React.FC<DualMoneyProps> = ({
  amountUSD,
  currency,
  fxRate,
  forceDecimals = null,
  customBrlVal = null,
  subClassName = 'text-[11px] font-mono font-normal text-slate-400 mt-0.5',
  prefix = ''
}) => {
  const valUSD = Number(amountUSD) || 0;
  const valBRL = customBrlVal !== null ? Number(customBrlVal) : valUSD * fxRate;

  if (currency === 'HYBRID') {
    return (
      <>
        <div>
          {prefix}
          {formatUSDT(valUSD, forceDecimals)}
        </div>
        <div className={subClassName}>
          ≈ {prefix}
          {formatBRL(valBRL, forceDecimals)}
        </div>
      </>
    );
  }

  if (currency === 'BRL') {
    return (
      <>
        {prefix}
        {formatBRL(valBRL, forceDecimals)}
      </>
    );
  }

  return (
    <>
      {prefix}
      {formatUSDT(valUSD, forceDecimals)}
    </>
  );
};
