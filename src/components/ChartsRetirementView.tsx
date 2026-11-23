import React, { useEffect, useRef } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { AppState } from '../types';
import {
  calculateGoalMetrics,
  convertFromUSD,
  formatBRL,
  formatCryptoQty,
  formatMoney,
  formatUSDT,
  getEffectiveUsdtBrlRate,
  getMultiplier
} from '../utils/calculations';
import { NumericInput } from './NumericInput';
import { CryptoLogo } from './CryptoLogo';

Chart.register(...registerables);

interface ChartsRetirementViewProps {
  state: AppState;
  onSelectGoal: (goalId: string) => void;
  onUpdateCycleMultiplier: (val: number) => void;
  onUpdateRetirementGoal: (valDisplay: number) => void;
  onUpdateRetirementPrice: (goalId: string, valDisplay: number) => void;
}

interface ChartCanvasProps {
  config: ChartConfiguration;
}

const ChartCanvas: React.FC<ChartCanvasProps> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    instanceRef.current = new Chart(canvas, config);

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [config]);

  return <canvas ref={canvasRef} />;
};

export const ChartsRetirementView: React.FC<ChartsRetirementViewProps> = ({
  state,
  onSelectGoal,
  onUpdateCycleMultiplier,
  onUpdateRetirementGoal,
  onUpdateRetirementPrice
}) => {
  if (state.goals.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
        Adicione uma meta para visualizar gráficos e projeções.
      </div>
    );
  }

  const fxRate = getEffectiveUsdtBrlRate(state);
  const multCurr = getMultiplier(state.currency, fxRate);
  const isBRL = state.currency === 'BRL';
  const currSymbol = isBRL ? 'R$' : 'USDT';

  const goal = state.goals.find((g) => g.id === state.selectedGoalId) || state.goals[0];
  const m = calculateGoalMetrics(goal, state.pricesUSD, fxRate);

  const summaries = state.goals.map((g) => ({
    goal: g,
    metrics: calculateGoalMetrics(g, state.pricesUSD, fxRate)
  }));

  const multCycle = Number(state.cycleMultiplier) || 1;
  const retirementGoalUSD = Math.max(0, Number(state.retirementGoalUSD) || 0);
  const totalOwnedAtTargetUSD =
    summaries.reduce((acc, s) => acc + s.metrics.ownedAtRetirementPriceUSD, 0) * multCycle;
  const simulatedRetirementTotalUSD =
    summaries.reduce((acc, s) => acc + s.metrics.projectedRetirementTotalUSD, 0) * multCycle;
  const totalCurrentPortfolioUSD = summaries.reduce((acc, s) => acc + s.metrics.totalPositionValueUSD, 0);

  const missingFromOwnedUSD = Math.max(0, retirementGoalUSD - totalOwnedAtTargetUSD);
  const missingFromPlannedUSD = Math.max(0, retirementGoalUSD - simulatedRetirementTotalUSD);
  const goalDisplayVal = Number(convertFromUSD(retirementGoalUSD, state.currency, fxRate).toFixed(2));

  const labels = m.schedule.map((s) => `M${s.month}`);

  const avgPriceConfig: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Preço Médio Acumulado',
          data: m.schedule.map((s) => (s.cumAvgPriceUSD > 0 ? Number((s.cumAvgPriceUSD * multCurr).toFixed(4)) : null)),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
          spanGaps: true
        },
        {
          label: 'Preço Pago Mês',
          data: m.schedule.map((s) => (s.pricePaidUSD > 0 ? Number((s.pricePaidUSD * multCurr).toFixed(4)) : null)),
          borderColor: '#38bdf8',
          borderDash: [4, 4],
          borderWidth: 2,
          spanGaps: true
        },
        {
          label: 'Cotação Atual',
          data: m.schedule.map(() => Number((m.currentPriceUSD * multCurr).toFixed(4))),
          borderColor: '#f59e0b',
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.3)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.3)' } }
      }
    }
  };

  const accumulationConfig: ChartConfiguration<'bar' | 'line'> = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: `Acumulado (${goal.symbol})`,
          data: m.schedule.map((s) => Number(s.cumCoins.toFixed(2))),
          backgroundColor: goal.color || '#8b5cf6',
          borderRadius: 5,
          order: 2
        },
        {
          type: 'line',
          label: 'Meta Planejada',
          data: m.schedule.map((s) => Number(s.plannedCumQty.toFixed(2))),
          borderColor: '#10b981',
          borderWidth: 2,
          pointRadius: 2,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.3)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.3)' } }
      }
    }
  };

  const donutConfig: ChartConfiguration<'doughnut'> = {
    type: 'doughnut',
    data: {
      labels: summaries.map((s) => s.goal.symbol),
      datasets: [
        {
          data: summaries.map((s) => Math.max(0.01, Number((s.metrics.totalPositionValueUSD * multCurr).toFixed(2)))),
          backgroundColor: summaries.map((s) => s.goal.color || '#10b981'),
          borderColor: '#0f172a',
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const prefix = isBRL ? 'R$ ' : '$ ';
              const suffix = isBRL ? '' : ' USDT';
              return ` ${ctx.label}: ${prefix}${Number(ctx.parsed).toFixed(2)}${suffix}`;
            }
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulador de Ciclo & Meta de Aposentadoria */}
      <div className="rounded-2xl bg-[#120b0e]/95 border border-slate-800/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-red-950/60 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              Simulador de Ciclo &amp; Certificação da Aposentadoria
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina o patrimônio desejado para a aposentadoria e confira quanto já está garantido pelas criptos compradas e quanto ainda falta.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-amber-300 whitespace-nowrap">
                Meu Alvo ({currSymbol}):
              </label>
              <NumericInput
                value={goalDisplayVal}
                onValueChange={onUpdateRetirementGoal}
                decimalsOnBlur={2}
                showZero
                ariaLabel={`Alvo financeiro da aposentadoria em ${currSymbol}`}
                className="w-32 rounded-xl bg-slate-950 border border-amber-500/50 px-3 py-2 text-xs font-mono font-bold text-white tabular-nums focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Ativo nos Gráficos:</span>
              <select
                value={goal.id}
                onChange={(e) => onSelectGoal(e.target.value)}
                className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                {state.goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Slider Multiplicador + Comparativo Aposentadoria */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-6 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="cycle-multiplier-slider" className="text-xs font-bold text-slate-300">
                Multiplicador sobre o Preço de Venda Alvo
              </label>
              <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-extrabold text-sm tabular-nums">
                {multCycle.toFixed(1)}x
              </span>
            </div>
            <input
              id="cycle-multiplier-slider"
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={multCycle}
              onChange={(e) => onUpdateCycleMultiplier(parseFloat(e.target.value) || 1)}
              className="w-full accent-[#E11D2E] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>1.0x (Alvo Base)</span>
              <span>5.0x</span>
              <span>10.0x</span>
              <span>15.0x</span>
              <span>20.0x (Superciclo)</span>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1">
              <div className="text-[11px] font-bold text-emerald-400">
                Já Compradas no Alvo ({multCycle.toFixed(1)}x)
              </div>
              <div className="text-xl font-extrabold text-white font-mono tabular-nums">
                {formatUSDT(totalOwnedAtTargetUSD, 2)}
              </div>
              <div className="text-xs font-mono text-slate-400 tabular-nums">
                ≈ {formatBRL(totalOwnedAtTargetUSD * fxRate, 2)}
              </div>
              <div className="text-[11px] pt-1 border-t border-slate-800 tabular-nums">
                {missingFromOwnedUSD > 0 ? (
                  <span className="text-slate-300">
                    Falta:{' '}
                    <strong className="text-amber-300 font-mono">
                      {formatMoney(missingFromOwnedUSD, state.currency, fxRate, 2)}
                    </strong>
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold">Alvo atingido com o saldo atual!</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/15 to-emerald-500/10 border border-amber-500/30 space-y-1">
              <div className="text-[11px] font-bold text-amber-300">
                Projetado c/ Metas DCA ({multCycle.toFixed(1)}x)
              </div>
              <div className="text-xl font-extrabold text-white font-mono tabular-nums">
                {formatUSDT(simulatedRetirementTotalUSD, 2)}
              </div>
              <div className="text-xs font-mono text-emerald-400 tabular-nums">
                ≈ {formatBRL(simulatedRetirementTotalUSD * fxRate, 2)}
              </div>
              <div className="text-[11px] pt-1 border-t border-amber-500/20 tabular-nums">
                {missingFromPlannedUSD > 0 ? (
                  <span className="text-slate-300">
                    Ainda faltará:{' '}
                    <strong className="text-white font-mono">
                      {formatMoney(missingFromPlannedUSD, state.currency, fxRate, 2)}
                    </strong>
                  </span>
                ) : (
                  <span className="text-emerald-300 font-bold">
                    Excedente: +{formatMoney(simulatedRetirementTotalUSD - retirementGoalUSD, state.currency, fxRate, 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Gráficos Chart.js */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-[#120b0e]/95 border border-slate-800/90 p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CryptoLogo symbol={goal.symbol} color={goal.color} size={18} />
              <span>
                Preço Médio Pago ({goal.symbol} em {currSymbol})
              </span>
            </h3>
            <p className="text-xs text-slate-400">Preço médio acumulado mês a mês vs cotação atual</p>
          </div>
          <div className="relative h-64 w-full">
            <ChartCanvas config={avgPriceConfig} />
          </div>
        </div>

        <div className="rounded-2xl bg-[#120b0e]/95 border border-slate-800/90 p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CryptoLogo symbol={goal.symbol} color={goal.color} size={18} />
              <span>Acúmulo de Moedas ({goal.symbol})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Progresso real vs trajetória da meta ({formatCryptoQty(goal.targetAmount)})
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ChartCanvas config={accumulationConfig as ChartConfiguration} />
          </div>
        </div>

        <div className="rounded-2xl bg-[#120b0e]/95 border border-slate-800/90 p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-white">Distribuição Atual da Carteira</h3>
            <p className="text-xs text-slate-400">
              Proporção do patrimônio atual ({formatMoney(totalCurrentPortfolioUSD, state.currency, fxRate, 2)})
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ChartCanvas config={donutConfig as ChartConfiguration} />
          </div>
        </div>
      </div>

      {/* Tabela Resumo Consolidado Multi-Cripto com Edição de Preço-Alvo de Venda */}
      <div className="rounded-2xl bg-[#120b0e]/95 border border-slate-800/90 overflow-hidden">
        <div className="p-5 border-b border-red-950/60 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white">Somatório Consolidado &amp; Preços-Alvo de Venda</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Edite o preço de venda pretendido de cada cripto para ver quanto suas moedas compradas garantem e o que ainda falta.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-bold tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Ativo</th>
                <th className="py-3.5 px-4">Compradas / Meta</th>
                <th className="py-3.5 px-4">Preço de Venda ({currSymbol})</th>
                <th className="py-3.5 px-4">Já Compradas no Alvo</th>
                <th className="py-3.5 px-4">Meta DCA no Alvo ({multCycle.toFixed(1)}x)</th>
                <th className="py-3.5 px-4">Faltam Comprar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm tabular-nums">
              {summaries.map(({ goal: g, metrics: gm }) => (
                <tr key={g.id} className="hover:bg-red-950/20">
                  <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <CryptoLogo symbol={g.symbol} color={g.color} size={22} />
                      <span>{g.name}</span>
                      <span className="text-[11px] font-mono text-slate-400">{g.symbol}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                    {formatCryptoQty(gm.totalAccumulatedCoins)} / {formatCryptoQty(g.targetAmount, g.symbol)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <NumericInput
                      value={Number(convertFromUSD(g.retirementTargetPriceUSD, state.currency, fxRate).toFixed(4))}
                      onValueChange={(val) => onUpdateRetirementPrice(g.id, val)}
                      decimalsOnBlur={4}
                      ariaLabel={`Preço de venda de ${g.symbol}`}
                      className="w-24 rounded-lg bg-slate-950 border border-amber-500/40 px-2.5 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-400 font-semibold whitespace-nowrap">
                    {formatMoney(gm.ownedAtRetirementPriceUSD * multCycle, state.currency, fxRate, 2)}
                  </td>
                  <td className="py-3 px-4 font-mono text-amber-400 font-bold whitespace-nowrap">
                    {formatMoney(gm.projectedRetirementTotalUSD * multCycle, state.currency, fxRate, 2)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                    {formatCryptoQty(gm.remainingCoinsToBuy, g.symbol)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950/90 border-t border-slate-700 text-xs sm:text-sm font-bold tabular-nums">
                <td className="py-3.5 px-4 text-white" colSpan={3}>
                  Total vs Alvo Aposentadoria ({formatMoney(retirementGoalUSD, state.currency, fxRate, 2)})
                </td>
                <td className="py-3.5 px-4 font-mono text-emerald-400 whitespace-nowrap">
                  {formatMoney(totalOwnedAtTargetUSD, state.currency, fxRate, 2)}
                </td>
                <td className="py-3.5 px-4 font-mono text-amber-400 whitespace-nowrap">
                  {formatMoney(simulatedRetirementTotalUSD, state.currency, fxRate, 2)}
                </td>
                <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                  {missingFromOwnedUSD > 0 ? (
                    <span className="text-rose-300">
                      Falta {formatMoney(missingFromOwnedUSD, state.currency, fxRate, 0)}
                    </span>
                  ) : (
                    <span className="text-emerald-400">Meta Garantida</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
