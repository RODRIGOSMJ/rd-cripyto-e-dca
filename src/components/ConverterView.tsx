import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { AppState, ConverterState } from '../types';
import { SUPPORTED_CRYPTOS } from '../constants';
import {
  calculateConverterResults,
  formatBRL,
  formatCryptoQty,
  formatUSDT,
  getEffectiveUsdtBrlRate
} from '../utils/calculations';

interface ConverterViewProps {
  state: AppState;
  onToggleDirection: () => void;
  onUpdateField: (field: keyof ConverterState, value: string | number) => void;
  onSetPresetBRL: (val: number) => void;
  onSetPresetUSDT: (val: number) => void;
  onToggleManualFx: (checked: boolean) => void;
  onUpdateManualFxValue: (rawVal: string) => void;
  onApplyConversionToSchedule: () => void;
}

export const ConverterView: React.FC<ConverterViewProps> = ({
  state,
  onToggleDirection,
  onUpdateField,
  onSetPresetBRL,
  onSetPresetUSDT,
  onToggleManualFx,
  onUpdateManualFxValue,
  onApplyConversionToSchedule
}) => {
  const c = state.converter;
  const spotFx = getEffectiveUsdtBrlRate(state);
  const res = calculateConverterResults(c, spotFx, state.pricesUSD);
  const isBrlToUsdt = c.direction === 'BRL_TO_USDT';

  const selectedGoal = state.goals.find((g) => g.id === c.targetGoalId) || state.goals[0];

  // Garante lista de ativos para simulação incluindo moedas customizadas
  const assetOptions = [...SUPPORTED_CRYPTOS.map((cr) => ({ symbol: cr.symbol, name: cr.name }))];
  for (const g of state.goals) {
    if (!assetOptions.some((a) => a.symbol === g.symbol)) {
      assetOptions.push({ symbol: g.symbol, name: g.name });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Calculadora Bidirecional */}
      <div className="lg:col-span-7 rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">Conversor Avançado USDT ↔ BRL</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simule conversão Pix BRL → USDT líquido com taxas de corretora, spread e taxa de rede.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleDirection}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-xs font-bold text-sky-300 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{isBrlToUsdt ? 'Modo: BRL → USDT' : 'Modo: USDT → BRL'}</span>
          </button>
        </div>

        {/* Taxa de Câmbio & Trava Manual */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-400">Cotação Base USDT/BRL</div>
            <div className="text-base font-mono font-extrabold text-emerald-400 mt-0.5 tabular-nums">
              1 USDT = R$ {res.spotFx.toFixed(4).replace('.', ',')}{' '}
              <span className="text-[11px] font-sans font-normal text-slate-400 ml-1">
                ({state.manualFxOverride ? 'Trava Manual' : state.priceSource})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={state.manualFxOverride}
                onChange={(e) => onToggleManualFx(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Travar Câmbio:</span>
            </label>
            <input
              type="number"
              step="0.0001"
              min="0.1"
              key={`manual-fx-${state.manualFxOverride}-${res.spotFx}`}
              defaultValue={res.spotFx.toFixed(4)}
              disabled={!state.manualFxOverride}
              onBlur={(e) => onUpdateManualFxValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onUpdateManualFxValue((e.target as HTMLInputElement).value);
              }}
              className={`w-24 rounded-lg bg-slate-900 border ${
                state.manualFxOverride ? 'border-amber-500/60 text-white' : 'border-slate-800 text-slate-500'
              } px-2.5 py-1.5 text-xs font-mono tabular-nums focus:outline-none`}
            />
          </div>
        </div>

        {/* Inputs BRL / USDT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            className={`p-4 rounded-xl ${
              isBrlToUsdt ? 'bg-emerald-950/20 border border-emerald-500/60' : 'bg-slate-950 border border-slate-800'
            }`}
          >
            <label
              className={`block text-xs font-bold mb-1.5 ${isBrlToUsdt ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              {isBrlToUsdt ? '1. Valor Enviado em Reais (BRL)' : 'Total Necessário em Reais (BRL)'}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm font-mono font-bold text-slate-400">R$</span>
              <input
                type="number"
                step="any"
                min="0"
                value={isBrlToUsdt ? c.amountBRL : Number(res.grossBRL.toFixed(2))}
                readOnly={!isBrlToUsdt}
                onChange={(e) => onUpdateField('amountBRL', e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 pl-10 pr-3.5 py-3 text-lg font-mono font-extrabold text-white tabular-nums focus:outline-none focus:border-emerald-500"
              />
            </div>
            {isBrlToUsdt && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[500, 1000, 2500, 5000].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onSetPresetBRL(p)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors"
                  >
                    R$ {p.toLocaleString('pt-BR')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className={`p-4 rounded-xl ${
              !isBrlToUsdt ? 'bg-emerald-950/20 border border-emerald-500/60' : 'bg-slate-950 border border-slate-800'
            }`}
          >
            <label
              className={`block text-xs font-bold mb-1.5 ${!isBrlToUsdt ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              {!isBrlToUsdt ? '1. USDT Líquido Desejado' : 'USDT Líquido Recebido'}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm font-mono font-bold text-emerald-400">$</span>
              <input
                type="number"
                step="any"
                min="0"
                value={!isBrlToUsdt ? c.amountUSDT : Number(res.netUSDT.toFixed(2))}
                readOnly={isBrlToUsdt}
                onChange={(e) => onUpdateField('amountUSDT', e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 pl-8 pr-14 py-3 text-lg font-mono font-extrabold text-emerald-400 tabular-nums focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute right-3.5 text-xs font-mono font-bold text-slate-400">USDT</span>
            </div>
            {!isBrlToUsdt && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[100, 250, 500, 1000].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onSetPresetUSDT(p)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors"
                  >
                    ${p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Taxas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Taxa Corretora (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="50"
              value={c.exchangeFeePct}
              onChange={(e) => onUpdateField('exchangeFeePct', e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-sky-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Binance Spot: 0,10%</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Spread Pix / P2P (%)</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="50"
              value={c.pixSpreadPct}
              onChange={(e) => onUpdateField('pixSpreadPct', e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-sky-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Ágio acima do USDTBRL</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Taxa Rede (USDT)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="500"
              value={c.networkFeeUSDT}
              onChange={(e) => onUpdateField('networkFeeUSDT', e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-sky-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Opcional (saque carteira)</span>
          </div>
        </div>
      </div>

      {/* Resumo Efetivo & Lançamento Direto */}
      <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-300">Resumo Efetivo &amp; Poder de Compra</h3>

        <div className="space-y-2 text-xs sm:text-sm tabular-nums">
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">Total em Reais (BRL):</span>
            <span className="font-mono font-semibold text-white">{formatBRL(res.grossBRL, 2)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">Taxas &amp; Spread:</span>
            <span className="font-mono font-semibold text-rose-400">
              -{formatBRL(res.totalFeesBRL, 2)} (-{formatUSDT(res.totalFeesUSDT, 2)})
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">Câmbio Efetivo Real:</span>
            <span className="font-mono font-bold text-amber-400">
              R$ {res.effectiveFxRate.toFixed(4).replace('.', ',')} / USDT
            </span>
          </div>
          <div className="flex justify-between items-center py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 mt-2">
            <span className="font-bold text-emerald-300">USDT Líquido:</span>
            <span className="font-mono font-extrabold text-emerald-400 text-base">{formatUSDT(res.netUSDT, 2)}</span>
          </div>
        </div>

        {/* Poder de Compra na Cripto */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300">Compra Direta de:</span>
            <select
              value={c.targetSymbol}
              onChange={(e) => onUpdateField('targetSymbol', e.target.value)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
            >
              {assetOptions.map((cr) => (
                <option key={cr.symbol} value={cr.symbol}>
                  {cr.symbol} ({cr.name})
                </option>
              ))}
            </select>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
            {formatCryptoQty(res.purchasableCryptoQty, c.targetSymbol)}
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            Cotação {c.targetSymbol}/USDT: {formatUSDT(res.targetPriceUSD)}
          </div>
        </div>

        {/* Enviar para o Cronograma DCA */}
        {state.goals.length > 0 && selectedGoal && (
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300">Lançar esta Compra no Cronograma DCA:</div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedGoal.id}
                onChange={(e) => onUpdateField('targetGoalId', e.target.value)}
                className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {state.goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    Meta: {g.symbol}
                  </option>
                ))}
              </select>
              <select
                value={Math.min(selectedGoal.monthlyRecords.length - 1, Math.max(0, c.targetMonthIndex))}
                onChange={(e) => onUpdateField('targetMonthIndex', parseInt(e.target.value, 10) || 0)}
                className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {selectedGoal.monthlyRecords.map((r, idx) => (
                  <option key={r.month} value={idx}>
                    Mês {r.month} ({r.label})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onApplyConversionToSchedule}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-colors"
            >
              Aplicar Compra ao Mês Selecionado
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
