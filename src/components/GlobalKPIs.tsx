import React, { useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { AppState } from '../types';
import {
  calculateGoalMetrics,
  calculateMonthlyPortfolioBudget,
  convertFromUSD,
  formatMoney,
  formatUSDT,
  getEffectiveUsdtBrlRate,
  getNextActiveMonthIndex
} from '../utils/calculations';
import { DualMoney } from './DualMoney';
import { NumericInput } from './NumericInput';

interface GlobalKPIsProps {
  state: AppState;
  onUpdateRetirementGoal: (valDisplay: number) => void;
}

export const GlobalKPIs: React.FC<GlobalKPIsProps> = ({ state, onUpdateRetirementGoal }) => {
  const [editingGoal, setEditingGoal] = useState(false);

  const fxRate = getEffectiveUsdtBrlRate(state);
  const currSymbol = state.currency === 'BRL' ? 'R$' : 'USDT';

  let totalPortfolioUSD = 0;
  let totalInvestedUSD = 0;
  let totalInvestedBRL = 0;
  let totalRemainingUSD = 0;
  let totalDcaValueUSD = 0;
  let totalOwnedAtTargetUSD = 0;
  let totalPlannedAtTargetUSD = 0;

  for (const g of state.goals) {
    const m = calculateGoalMetrics(g, state.pricesUSD, fxRate);
    totalPortfolioUSD += m.totalPositionValueUSD;
    totalInvestedUSD += m.totalInvestedUSD;
    totalInvestedBRL += m.totalInvestedHistoricalBRL;
    totalRemainingUSD += m.estimatedRemainingTotalCostUSD;
    totalDcaValueUSD += m.dcaCurrentValueUSD;
    totalOwnedAtTargetUSD += m.ownedAtRetirementPriceUSD;
    totalPlannedAtTargetUSD += m.projectedRetirementTotalUSD;
  }

  const totalPnlUSD = totalDcaValueUSD - totalInvestedUSD;
  const totalPnlPct = totalInvestedUSD > 0 ? (totalPnlUSD / totalInvestedUSD) * 100 : 0;
  const pnlSign = totalPnlUSD >= 0 ? '+' : '';

  const nextMonthIdx = getNextActiveMonthIndex(state.goals, state.pricesUSD, fxRate);
  const activeMonthBudget = calculateMonthlyPortfolioBudget(
    state.goals,
    state.pricesUSD,
    fxRate,
    nextMonthIdx
  );

  const retirementGoalUSD = Math.max(0, Number(state.retirementGoalUSD) || 0);
  const ownedPct =
    retirementGoalUSD > 0 ? Math.min(100, (totalOwnedAtTargetUSD / retirementGoalUSD) * 100) : 0;
  const plannedPct =
    retirementGoalUSD > 0 ? Math.min(100, (totalPlannedAtTargetUSD / retirementGoalUSD) * 100) : 0;
  const missingFromOwnedUSD = Math.max(0, retirementGoalUSD - totalOwnedAtTargetUSD);
  const missingFromPlannedUSD = Math.max(0, retirementGoalUSD - totalPlannedAtTargetUSD);
  const goalDisplayValue = Number(convertFromUSD(retirementGoalUSD, state.currency, fxRate).toFixed(2));

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-3.5">
        <div className="text-[11px] font-semibold text-slate-400">Patrimônio Acumulado</div>
        <div className="text-lg sm:text-xl font-extrabold text-white tabular-nums font-mono mt-0.5">
          <DualMoney
            amountUSD={totalPortfolioUSD}
            currency={state.currency}
            fxRate={fxRate}
            forceDecimals={2}
            subClassName="text-[11px] font-mono font-normal text-slate-400"
          />
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
          {state.goals.length} ativo(s) em acumulação
        </div>
      </div>

      <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-3.5">
        <div className="text-[11px] font-semibold text-slate-400">Total Investido (DCA)</div>
        <div className="text-lg sm:text-xl font-extrabold text-white tabular-nums font-mono mt-0.5">
          <DualMoney
            amountUSD={totalInvestedUSD}
            currency={state.currency}
            fxRate={fxRate}
            forceDecimals={2}
            customBrlVal={totalInvestedBRL}
            subClassName="text-[11px] font-mono font-normal text-slate-400"
          />
        </div>
        <div className="text-[11px] text-sky-400 font-semibold mt-0.5 tabular-nums truncate">
          Mês {activeMonthBudget.monthNumber} (todas):{' '}
          <span className="font-mono">{formatUSDT(activeMonthBudget.totalPlannedUSD, 2)}</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums truncate">
          Falta investir total: {formatMoney(totalRemainingUSD, state.currency, fxRate, 2)}
        </div>
      </div>

      <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-3.5">
        <div className="text-[11px] font-semibold text-slate-400">Resultado das Compras</div>
        <div
          className={`text-lg sm:text-xl font-extrabold tabular-nums font-mono mt-0.5 ${
            totalPnlUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          <DualMoney
            amountUSD={totalPnlUSD}
            currency={state.currency}
            fxRate={fxRate}
            forceDecimals={2}
            prefix={pnlSign}
            subClassName="text-[11px] font-mono font-normal text-slate-400"
          />
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
          {totalInvestedUSD > 0
            ? `${pnlSign}${totalPnlPct.toFixed(2).replace('.', ',')}% sobre o aportado`
            : 'Sem compras registradas'}
        </div>
      </div>

      {/* Card 4: Alvo de Aposentadoria Editável + Certificação */}
      <div className="rounded-xl bg-slate-900/90 border border-amber-500/30 px-4 py-3.5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-300">
          <span>Alvo Aposentadoria</span>
          <button
            type="button"
            onClick={() => setEditingGoal((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold transition-colors whitespace-nowrap"
          >
            {editingGoal ? (
              <>
                <Check className="w-3 h-3" />
                <span>OK</span>
              </>
            ) : (
              <>
                <Pencil className="w-3 h-3" />
                <span>Alterar Alvo</span>
              </>
            )}
          </button>
        </div>

        {editingGoal ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs font-mono font-bold text-amber-400">{currSymbol}</span>
            <NumericInput
              value={goalDisplayValue}
              onValueChange={onUpdateRetirementGoal}
              decimalsOnBlur={2}
              showZero
              ariaLabel={`Valor do alvo de aposentadoria em ${currSymbol}`}
              className="w-full rounded-lg bg-slate-950 border border-amber-500/60 px-2.5 py-1 text-sm font-mono font-bold text-white tabular-nums focus:outline-none focus:border-amber-400"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingGoal(true)}
            title="Clique para alterar seu valor alvo de aposentadoria"
            className="text-left w-full text-lg sm:text-xl font-extrabold text-amber-400 hover:text-amber-300 tabular-nums font-mono mt-0.5 transition-colors"
          >
            <DualMoney
              amountUSD={retirementGoalUSD}
              currency={state.currency}
              fxRate={fxRate}
              forceDecimals={2}
              subClassName="text-[11px] font-mono font-normal text-amber-200/70"
            />
          </button>
        )}

        {/* Barra dupla: garantido (já compradas no alvo) vs planejado (metas DCA no alvo) */}
        <div className="relative w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
          <div
            className="absolute inset-y-0 left-0 bg-amber-400/35 rounded-full transition-all duration-300"
            style={{ width: `${plannedPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${ownedPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] mt-1.5 tabular-nums">
          {missingFromOwnedUSD > 0 ? (
            <span className="text-slate-400 truncate">
              Falta:{' '}
              <strong className="text-white font-mono">
                {formatMoney(missingFromOwnedUSD, state.currency, fxRate, 0)}
              </strong>
            </span>
          ) : (
            <span className="text-emerald-400 font-semibold">Alvo garantido!</span>
          )}
          <span className="font-mono text-emerald-400 font-bold shrink-0">{ownedPct.toFixed(1)}%</span>
        </div>

        <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums truncate">
          Já compradas no alvo: {formatMoney(totalOwnedAtTargetUSD, state.currency, fxRate, 0)} · Metas DCA:{' '}
          {missingFromPlannedUSD > 0
            ? `faltam ${formatMoney(missingFromPlannedUSD, state.currency, fxRate, 0)}`
            : 'cobrem 100%'}
        </div>
      </div>
    </section>
  );
};
