import React, { useEffect, useRef, useState } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  DollarSign,
  Pencil,
  Plus,
  Trash2,
  ArrowRightLeft
} from 'lucide-react';
import { AppState } from '../types';
import {
  calculateGoalMetrics,
  calculateMonthlyPortfolioBudget,
  convertFromUSD,
  formatBRL,
  formatCryptoQty,
  formatMoney,
  formatUSDT,
  getEffectiveUsdtBrlRate,
  getMaxGoalMonths,
  getMultiplier,
  getNextActiveMonthIndex
} from '../utils/calculations';
import { DualMoney } from './DualMoney';
import { NumericInput } from './NumericInput';

Chart.register(...registerables);

type DcaChartMode = 'SPENT' | 'ACCUMULATION' | 'AVG_PRICE';
type MonthFilter = 'ALL' | 'PENDING' | 'DONE';

interface DcaPlannerViewProps {
  state: AppState;
  onSelectGoal: (goalId: string) => void;
  onOpenGoalModal: (goalId?: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onUpdateRetirementPrice: (goalId: string, valDisplay: number) => void;
  onUpdateMonthlyRecordNumber: (
    goalId: string,
    monthIndex: number,
    field: 'boughtQty' | 'pricePaid',
    numValue: number
  ) => void;
  onQuickCompleteMonth: (goalId: string, monthIndex: number, plannedQty: number) => void;
  onAutoFillNextEmptyMonth: (goalId: string) => void;
  onGoToConverter: () => void;
  onSendMonthlyUsdToConverter: (amountUSD: number) => void;
}

export const DcaPlannerView: React.FC<DcaPlannerViewProps> = ({
  state,
  onSelectGoal,
  onOpenGoalModal,
  onDeleteGoal,
  onUpdateRetirementPrice,
  onUpdateMonthlyRecordNumber,
  onQuickCompleteMonth,
  onAutoFillNextEmptyMonth,
  onGoToConverter,
  onSendMonthlyUsdToConverter
}) => {
  const [chartMode, setChartMode] = useState<DcaChartMode>('SPENT');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('ALL');
  const [budgetMonthIndex, setBudgetMonthIndex] = useState<number>(() =>
    getNextActiveMonthIndex(state.goals, state.pricesUSD, getEffectiveUsdtBrlRate(state))
  );
  const [budgetDetailsOpen, setBudgetDetailsOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const lastChartTypeRef = useRef<string | null>(null);

  const fxRate = getEffectiveUsdtBrlRate(state);
  const mult = getMultiplier(state.currency, fxRate);
  const currSymbol = state.currency === 'BRL' ? 'R$' : 'USDT';

  const maxMonths = getMaxGoalMonths(state.goals);
  const safeBudgetMonthIndex = Math.min(maxMonths - 1, Math.max(0, budgetMonthIndex));
  const monthlyBudget = calculateMonthlyPortfolioBudget(
    state.goals,
    state.pricesUSD,
    fxRate,
    safeBudgetMonthIndex
  );

  const goal = state.goals.find((g) => g.id === state.selectedGoalId) || state.goals[0];
  const m = goal ? calculateGoalMetrics(goal, state.pricesUSD, fxRate) : null;

  // Atualiza gráfico DCA ao vivo sem flicker
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !goal || !m) return;

    const labels = m.schedule.map((s) => `M${s.month}`);

    let nextConfig: ChartConfiguration;
    let typeKey: string;

    if (chartMode === 'SPENT') {
      typeKey = 'SPENT';
      nextConfig = {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: `Valor Comprado/Mês (${currSymbol})`,
              data: m.schedule.map((s) =>
                Number((state.currency === 'BRL' ? s.monthCostBRL : s.monthCostUSD).toFixed(2))
              ),
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              borderRadius: 5,
              order: 2
            },
            {
              type: 'line',
              label: `Total Acumulado (${currSymbol})`,
              data: m.schedule.map((s) =>
                Number((state.currency === 'BRL' ? s.cumInvestedBRL : s.cumInvestedUSD).toFixed(2))
              ),
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              borderWidth: 2,
              tension: 0.25,
              pointRadius: 2.5,
              fill: true,
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 150 },
          plugins: {
            legend: { labels: { color: '#cbd5e1', font: { size: 11 } } }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.25)' } },
            y: {
              beginAtZero: true,
              ticks: { color: '#94a3b8', font: { size: 10 } },
              grid: { color: 'rgba(51,65,85,0.25)' }
            }
          }
        }
      };
    } else if (chartMode === 'ACCUMULATION') {
      typeKey = 'ACCUMULATION';
      nextConfig = {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: `Saldo Acumulado (${goal.symbol})`,
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
          animation: { duration: 150 },
          plugins: {
            legend: { labels: { color: '#cbd5e1', font: { size: 11 } } }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.25)' } },
            y: {
              beginAtZero: true,
              ticks: { color: '#94a3b8', font: { size: 10 } },
              grid: { color: 'rgba(51,65,85,0.25)' }
            }
          }
        }
      };
    } else {
      typeKey = 'AVG_PRICE';
      nextConfig = {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: `Preço Médio (${currSymbol})`,
              data: m.schedule.map((s) =>
                s.cumAvgPriceUSD > 0 ? Number((s.cumAvgPriceUSD * mult).toFixed(4)) : null
              ),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.14)',
              borderWidth: 2.5,
              tension: 0.3,
              fill: true,
              spanGaps: true
            },
            {
              label: 'Cotação Atual',
              data: m.schedule.map(() => Number((m.currentPriceUSD * mult).toFixed(4))),
              borderColor: '#f59e0b',
              borderDash: [5, 5],
              borderWidth: 1.5,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 150 },
          plugins: {
            legend: { labels: { color: '#cbd5e1', font: { size: 11 } } }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.25)' } },
            y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.25)' } }
          }
        }
      };
    }

    if (chartRef.current && lastChartTypeRef.current === typeKey) {
      chartRef.current.data = nextConfig.data;
      chartRef.current.update('none');
    } else {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      chartRef.current = new Chart(canvas, nextConfig);
      lastChartTypeRef.current = typeKey;
    }
  }, [goal, m, chartMode, currSymbol, mult, state.currency]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  if (!goal || !m) {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-10 text-center space-y-4">
        <h3 className="text-lg font-bold text-white">Nenhuma meta cripto cadastrada</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Adicione uma meta (ex: 10.000 Polygon em 12 meses) para visualizar a quantidade mensal e o gráfico DCA.
        </p>
        <button
          type="button"
          onClick={() => onOpenGoalModal()}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
        >
          Criar Primeira Meta
        </button>
      </div>
    );
  }

  const filteredSchedule = m.schedule.filter((row) => {
    if (monthFilter === 'DONE') return row.boughtQty > 0;
    if (monthFilter === 'PENDING') return row.boughtQty <= 0;
    return true;
  });

  const amountForConverterUSD =
    monthlyBudget.totalRemainingToBuyUSD > 0.0001
      ? monthlyBudget.totalRemainingToBuyUSD
      : monthlyBudget.totalPlannedUSD;

  return (
    <div className="space-y-5">
      {/* Orçamento Consolidado do Mês em Dólares (Todas as Criptos) */}
      <section className="rounded-2xl bg-slate-900 border border-sky-500/30 p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">
                Dólares Necessários no Mês (Todas as Criptos)
              </h2>
              <p className="text-[11px] text-slate-400 tabular-nums">
                Soma de {monthlyBudget.activeGoalsCount} cripto(s) ativas no Mês {monthlyBudget.monthNumber} (
                {monthlyBudget.monthLabel}) na cotação ao vivo
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Mês */}
            <div className="inline-flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
              <button
                type="button"
                disabled={safeBudgetMonthIndex <= 0}
                onClick={() => setBudgetMonthIndex((prev) => Math.max(0, prev - 1))}
                aria-label="Mês anterior"
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <select
                value={safeBudgetMonthIndex}
                onChange={(e) => setBudgetMonthIndex(parseInt(e.target.value, 10) || 0)}
                aria-label="Selecionar mês do cálculo consolidado"
                className="bg-transparent text-xs font-bold text-slate-200 px-1.5 py-0.5 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: monthlyBudget.maxMonths }, (_, idx) => {
                  const sampleLabel =
                    state.goals.find((g) => g.monthlyRecords[idx])?.monthlyRecords[idx]?.label ||
                    `Mês ${idx + 1}`;
                  return (
                    <option key={idx} value={idx} className="bg-slate-900 text-white">
                      Mês {idx + 1} · {sampleLabel}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                disabled={safeBudgetMonthIndex >= monthlyBudget.maxMonths - 1}
                onClick={() => setBudgetMonthIndex((prev) => Math.min(monthlyBudget.maxMonths - 1, prev + 1))}
                aria-label="Próximo mês"
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onSendMonthlyUsdToConverter(amountForConverterUSD)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-[11px] font-bold text-sky-300 transition-colors whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>Simular em R$</span>
            </button>

            <button
              type="button"
              onClick={() => setBudgetDetailsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-200 transition-colors whitespace-nowrap"
            >
              <span>{budgetDetailsOpen ? 'Ocultar cálculo' : 'Ver por cripto'}</span>
              {budgetDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Resumo Principal: Total em Dólares + Falta no Mês + Criptos do Mês */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-800/80 items-center">
          <div className="md:col-span-4 rounded-xl bg-slate-950/70 border border-sky-500/25 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold text-sky-300">
              Total para Comprar no Mês {monthlyBudget.monthNumber}
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-white tabular-nums mt-0.5">
              {formatUSDT(monthlyBudget.totalPlannedUSD, 2)}
            </div>
            <div className="text-[11px] font-mono text-slate-400 tabular-nums">
              ≈ {formatBRL(monthlyBudget.totalPlannedUSD * fxRate, 2)} (cotação atual)
            </div>
          </div>

          <div className="md:col-span-3 rounded-xl bg-slate-950/70 border border-slate-800 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold text-slate-400">Falta Comprar neste Mês</div>
            {monthlyBudget.totalRemainingToBuyUSD > 0.0001 ? (
              <>
                <div className="text-lg font-extrabold font-mono text-emerald-400 tabular-nums mt-0.5">
                  {formatUSDT(monthlyBudget.totalRemainingToBuyUSD, 2)}
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {monthlyBudget.completedGoalsCount}/{monthlyBudget.activeGoalsCount} criptos concluídas
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-extrabold text-emerald-400 mt-1">Mês 100% concluído!</div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                  Investido: {formatUSDT(monthlyBudget.totalAlreadySpentUSD, 2)}
                </div>
              </>
            )}
          </div>

          {/* Chips rápidos de cada cripto incluída no cálculo */}
          <div className="md:col-span-5 flex flex-wrap gap-1.5">
            {monthlyBudget.items.map((item) => (
              <button
                key={item.goalId}
                type="button"
                onClick={() => onSelectGoal(item.goalId)}
                title={`${item.name}: ${formatCryptoQty(item.plannedQty, item.symbol)} × ${formatUSDT(item.currentPriceUSD)} = ${formatUSDT(item.plannedCostUSD, 2)}`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors tabular-nums ${
                  item.isCompleted
                    ? 'bg-emerald-950/35 border-emerald-500/35 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 hover:border-sky-500/50 text-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-bold">{item.symbol}</span>
                <span className="font-mono font-semibold text-sky-300">{formatUSDT(item.plannedCostUSD, 2)}</span>
                {item.isCompleted && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Detalhamento Expandível por Cripto */}
        {budgetDetailsOpen && (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400">
                <tr>
                  <th className="py-2 px-3.5">Cripto</th>
                  <th className="py-2 px-3 text-right">Preço Atual</th>
                  <th className="py-2 px-3 text-right">Qtd no Mês {monthlyBudget.monthNumber}</th>
                  <th className="py-2 px-3 text-right">Total em Dólares</th>
                  <th className="py-2 px-3.5 text-right">Falta neste Mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {monthlyBudget.items.map((item) => (
                  <tr
                    key={item.goalId}
                    onClick={() => onSelectGoal(item.goalId)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-bold text-white">{item.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">{item.symbol}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                      {formatUSDT(item.currentPriceUSD)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-200 whitespace-nowrap">
                      {formatCryptoQty(item.plannedQty, item.symbol)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-sky-400 whitespace-nowrap">
                      {formatUSDT(item.plannedCostUSD, 2)}
                    </td>
                    <td className="py-2 px-3.5 text-right font-mono whitespace-nowrap">
                      {item.isCompleted ? (
                        <span className="text-emerald-400 font-bold">Comprado</span>
                      ) : (
                        <span className="text-amber-300 font-semibold">{formatUSDT(item.remainingCostUSD, 2)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900/90 border-t border-slate-700 font-bold">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3.5 text-slate-200">
                    TOTAL GERAL — MÊS {monthlyBudget.monthNumber} ({monthlyBudget.activeGoalsCount} criptos)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sky-300 whitespace-nowrap">
                    <div>{formatUSDT(monthlyBudget.totalPlannedUSD, 2)}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      ≈ {formatBRL(monthlyBudget.totalPlannedUSD * fxRate, 2)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-mono text-emerald-400 whitespace-nowrap">
                    {formatUSDT(monthlyBudget.totalRemainingToBuyUSD, 2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Seletor Compacto de Ativos */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {state.goals.map((g) => {
            const gm = calculateGoalMetrics(g, state.pricesUSD, fxRate);
            const isSelected = g.id === goal.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGoal(g.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-emerald-500/15 text-white border border-emerald-500'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color || '#10b981' }} />
                <span>{g.name}</span>
                <span className="font-mono text-emerald-400 tabular-nums">{gm.progressPct.toFixed(0)}%</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenGoalModal(goal.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors whitespace-nowrap"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editar Meta</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteGoal(goal.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/50 text-xs font-semibold text-rose-300 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remover</span>
          </button>
        </div>
      </div>

      {/* Resumo Objetivo da Meta */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0"
              style={{ backgroundColor: goal.color || '#8b5cf6' }}
            >
              {goal.symbol.slice(0, 4)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-extrabold text-white">{goal.name}</h2>
                <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                  {formatMoney(m.currentPriceUSD, state.currency, fxRate)}
                  {state.currency === 'HYBRID' && (
                    <span className="text-slate-400 font-normal"> ({formatBRL(m.currentPriceUSD * fxRate)})</span>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                Meta: <strong className="text-white">{formatCryptoQty(goal.targetAmount, goal.symbol)}</strong> · Já possui{' '}
                <strong className="text-white">{formatCryptoQty(goal.initialBalance)}</strong> · Comprar{' '}
                <strong className="text-emerald-400">{formatCryptoQty(m.baseMonthlyTargetQty, goal.symbol)}/mês</strong> em{' '}
                <strong className="text-white">{goal.monthsCount} meses</strong>
              </p>
            </div>
          </div>

          {/* Barra de Progresso compacta */}
          <div className="w-full md:w-64 space-y-1">
            <div className="flex justify-between text-[11px] tabular-nums">
              <span className="text-slate-400 font-mono">
                {formatCryptoQty(m.totalAccumulatedCoins)} / {formatCryptoQty(goal.targetAmount, goal.symbol)}
              </span>
              <span className="font-bold text-emerald-400 font-mono">{m.progressPct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${m.progressPct}%`, backgroundColor: goal.color || '#10b981' }}
              />
            </div>
          </div>
        </div>

        {/* 4 Indicadores Essenciais do Ativo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div>
            <div className="text-[11px] text-slate-400">Comprar por Mês</div>
            <div className="text-base font-extrabold text-white font-mono tabular-nums mt-0.5">
              {formatCryptoQty(m.baseMonthlyTargetQty, goal.symbol)}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              Ajustado: <span className="text-violet-400 font-mono">{formatCryptoQty(m.dynamicMonthlyQty)}/mês</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400">Custo Estimado / Mês</div>
            <div className="text-base font-extrabold text-sky-400 font-mono tabular-nums mt-0.5">
              <DualMoney amountUSD={m.estimatedMonthlyCostUSD} currency={state.currency} fxRate={fxRate} forceDecimals={2} />
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              Restante: <span className="font-mono">{formatMoney(m.estimatedRemainingTotalCostUSD, state.currency, fxRate, 2)}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400">Preço Médio Pago</div>
            <div className="text-base font-extrabold text-emerald-400 font-mono tabular-nums mt-0.5">
              {m.avgBuyPriceUSD > 0 ? (
                <DualMoney amountUSD={m.avgBuyPriceUSD} currency={state.currency} fxRate={fxRate} customBrlVal={m.avgBuyPriceBRL} />
              ) : (
                <span className="text-sm text-slate-500 font-sans font-semibold">Sem compras</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              Comprado DCA: <span className="font-mono text-slate-300">{formatMoney(m.totalInvestedUSD, state.currency, fxRate, 2)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-1 text-[11px] text-amber-400 font-semibold">
              <span>Preço de Venda Alvo ({currSymbol})</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <NumericInput
                value={Number(convertFromUSD(goal.retirementTargetPriceUSD, state.currency, fxRate).toFixed(4))}
                onValueChange={(val) => onUpdateRetirementPrice(goal.id, val)}
                decimalsOnBlur={4}
                ariaLabel={`Preço de venda alvo de ${goal.symbol} em ${currSymbol}`}
                className="w-24 rounded-lg bg-slate-950 border border-amber-500/50 px-2.5 py-1 text-sm font-mono font-bold text-white tabular-nums focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs font-mono font-bold text-amber-300 tabular-nums truncate">
                = {formatMoney(m.projectedRetirementTotalUSD, state.currency, fxRate, 0)}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
              Já compradas no alvo:{' '}
              <span className="font-mono text-emerald-400 font-semibold">
                {formatMoney(m.ownedAtRetirementPriceUSD, state.currency, fxRate, 2)}
              </span>
            </div>
          </div>
        </div>

        {/* Certificação do Alvo de Aposentadoria */}
        {(() => {
          const allMetrics = state.goals.map((g) => calculateGoalMetrics(g, state.pricesUSD, fxRate));
          const totalOwnedAtTargetUSD = allMetrics.reduce((acc, gm) => acc + gm.ownedAtRetirementPriceUSD, 0);
          const totalPlannedAtTargetUSD = allMetrics.reduce((acc, gm) => acc + gm.projectedRetirementTotalUSD, 0);
          const retGoalUSD = Math.max(0, Number(state.retirementGoalUSD) || 0);
          const missingFromOwnedUSD = Math.max(0, retGoalUSD - totalOwnedAtTargetUSD);
          const missingFromPlannedUSD = Math.max(0, retGoalUSD - totalPlannedAtTargetUSD);
          const coinsNeededForRemainingGap =
            m.retirementPriceUSD > 0 ? missingFromOwnedUSD / m.retirementPriceUSD : 0;

          return (
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300">
                <span className="font-semibold text-amber-300">Certificação Aposentadoria:</span>
                <span>
                  Compradas no alvo:{' '}
                  <strong className="font-mono text-emerald-400">
                    {formatMoney(totalOwnedAtTargetUSD, state.currency, fxRate, 2)}
                  </strong>
                </span>
                <span className="text-slate-600">·</span>
                {missingFromOwnedUSD > 0 ? (
                  <span>
                    Falta atingir:{' '}
                    <strong className="font-mono text-white">
                      {formatMoney(missingFromOwnedUSD, state.currency, fxRate, 2)}
                    </strong>
                    {m.retirementPriceUSD > 0 && (
                      <span className="text-slate-400">
                        {' '}
                        (equivale a{' '}
                        <strong className="font-mono text-amber-300">
                          {formatCryptoQty(coinsNeededForRemainingGap, goal.symbol)}
                        </strong>{' '}
                        a {formatMoney(m.retirementPriceUSD, state.currency, fxRate)})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-400">
                    Alvo de aposentadoria já garantido com suas criptos compradas!
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {missingFromPlannedUSD > 0
                  ? `Com todas as metas DCA ainda faltam ${formatMoney(missingFromPlannedUSD, state.currency, fxRate, 0)}`
                  : 'Metas DCA cobrem 100% da aposentadoria'}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Área Principal Lado a Lado: Mês a Mês Compacto (Esquerda) + Gráfico DCA Ao Vivo (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Esquerda: Mês a Mês Clean e Resumido */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Compras Mês a Mês ({goal.symbol})</h3>
              <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
                {(
                  [
                    { id: 'ALL', label: `Todos (${m.schedule.length})` },
                    { id: 'PENDING', label: `Faltam (${m.remainingMonths})` },
                    { id: 'DONE', label: `Feitos (${m.monthsCompleted})` }
                  ] as Array<{ id: MonthFilter; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setMonthFilter(f.id)}
                    className={`px-2 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                      monthFilter === f.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onGoToConverter}
                title="Abrir Conversor BRL → USDT"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-[11px] font-bold text-sky-300 transition-colors whitespace-nowrap"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>BRL→USDT</span>
              </button>
              <button
                type="button"
                onClick={() => onAutoFillNextEmptyMonth(goal.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                <span>Lançar Próximo</span>
              </button>
            </div>
          </div>

          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400">
                <tr>
                  <th className="py-2.5 px-3.5">Mês</th>
                  <th className="py-2.5 px-3">Precisa Comprar</th>
                  <th className="py-2.5 px-3">Qtd &amp; Preço ({currSymbol})</th>
                  <th className="py-2.5 px-3.5 text-right">Valor Comprado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs tabular-nums">
                {filteredSchedule.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Nenhum mês neste filtro.
                    </td>
                  </tr>
                ) : (
                  filteredSchedule.map((row) => {
                    const isCompleted = row.boughtQty > 0;
                    const priceDisplayVal =
                      row.pricePaidUSD > 0 ? convertFromUSD(row.pricePaidUSD, state.currency, fxRate) : 0;

                    return (
                      <tr
                        key={`${goal.id}-${row.index}`}
                        className={`hover:bg-slate-800/35 transition-colors ${
                          isCompleted ? 'bg-emerald-950/10' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold font-mono ${
                                isCompleted ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {row.month}
                            </span>
                            <span className="font-semibold text-slate-200">{row.label}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                          {formatCryptoQty(row.plannedQty, goal.symbol)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <NumericInput
                              value={row.boughtQty}
                              onValueChange={(val) =>
                                onUpdateMonthlyRecordNumber(goal.id, row.index, 'boughtQty', val)
                              }
                              placeholder={row.plannedQty.toFixed(2)}
                              decimalsOnBlur={4}
                              ariaLabel={`Quantidade comprada no mês ${row.month}`}
                              className={`w-20 rounded-md bg-slate-950 border ${
                                isCompleted ? 'border-emerald-500/40' : 'border-slate-700'
                              } px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-emerald-500`}
                            />
                            <span className="text-slate-600">@</span>
                            <NumericInput
                              value={priceDisplayVal}
                              onValueChange={(val) =>
                                onUpdateMonthlyRecordNumber(goal.id, row.index, 'pricePaid', val)
                              }
                              placeholder={convertFromUSD(m.currentPriceUSD, state.currency, fxRate).toFixed(2)}
                              decimalsOnBlur={4}
                              ariaLabel={`Preço pago no mês ${row.month}`}
                              className={`w-20 rounded-md bg-slate-950 border ${
                                row.pricePaidUSD > 0 ? 'border-emerald-500/40' : 'border-slate-700'
                              } px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-emerald-500`}
                            />
                            <button
                              type="button"
                              title="Preencher meta do mês na cotação atual"
                              onClick={() => onQuickCompleteMonth(goal.id, row.index, row.plannedQty)}
                              className="p-1.5 rounded-md bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap">
                          {row.monthCostUSD > 0 ? (
                            <div>
                              <div className="font-bold text-emerald-400">
                                <DualMoney
                                  amountUSD={row.monthCostUSD}
                                  currency={state.currency}
                                  fxRate={fxRate}
                                  forceDecimals={2}
                                  customBrlVal={row.monthCostBRL}
                                  subClassName="text-[10px] font-normal text-slate-400"
                                />
                              </div>
                              <div className="text-[10px] text-slate-500">
                                PM: {formatMoney(row.cumAvgPriceUSD, state.currency, fxRate)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Direita: Gráfico DCA Automático em Tempo Real */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">Gráfico DCA em Tempo Real</h3>
              <p className="text-[11px] text-slate-400">Atualiza automaticamente ao lançar suas compras</p>
            </div>

            <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
              {(
                [
                  { id: 'SPENT', label: 'Valor Comprado' },
                  { id: 'ACCUMULATION', label: 'Moedas' },
                  { id: 'AVG_PRICE', label: 'Preço Médio' }
                ] as Array<{ id: DcaChartMode; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChartMode(tab.id)}
                  className={`px-2 py-1 rounded-md font-bold transition-colors whitespace-nowrap ${
                    chartMode === tab.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-72 w-full">
            <canvas ref={canvasRef} />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-xs tabular-nums">
            <div>
              <div className="text-[11px] text-slate-400">Comprado</div>
              <div className="font-mono font-bold text-white mt-0.5">
                {formatCryptoQty(m.totalBoughtDCA, goal.symbol)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Total Investido</div>
              <div className="font-mono font-bold text-emerald-400 mt-0.5">
                {formatMoney(m.totalInvestedUSD, state.currency, fxRate, 2)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Falta Comprar</div>
              <div className="font-mono font-bold text-slate-300 mt-0.5">
                {formatCryptoQty(m.remainingCoinsToBuy, goal.symbol)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
