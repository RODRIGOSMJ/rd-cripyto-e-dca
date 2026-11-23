import React, { useEffect, useRef, useState } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  DollarSign,
  LayoutGrid,
  List,
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
import { CryptoLogo } from './CryptoLogo';
import { PartialPurchaseModal } from './PartialPurchaseModal';

Chart.register(...registerables);

type DcaChartMode = 'SPENT' | 'ACCUMULATION' | 'AVG_PRICE';
type MonthFilter = 'ALL' | 'PENDING' | 'PARTIAL' | 'DONE';
type ScheduleViewMode = 'GRID' | 'TABLE';

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
  onAddPartialPurchase: (goalId: string, monthIndex: number, qty: number, priceDisplay: number) => void;
  onRemovePartialPurchase: (goalId: string, monthIndex: number, entryId: string) => void;
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
  onAddPartialPurchase,
  onRemovePartialPurchase,
  onQuickCompleteMonth,
  onAutoFillNextEmptyMonth,
  onGoToConverter,
  onSendMonthlyUsdToConverter
}) => {
  const [chartMode, setChartMode] = useState<DcaChartMode>('SPENT');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('ALL');
  const [scheduleView, setScheduleView] = useState<ScheduleViewMode>('GRID');
  const [budgetMonthIndex, setBudgetMonthIndex] = useState<number>(() =>
    getNextActiveMonthIndex(state.goals, state.pricesUSD, getEffectiveUsdtBrlRate(state))
  );
  const [budgetDetailsOpen, setBudgetDetailsOpen] = useState(false);
  const [partialModalMonthIndex, setPartialModalMonthIndex] = useState<number | null>(null);

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
          className="px-5 py-2.5 rounded-xl spfc-gradient-btn text-white font-bold text-sm transition-all shadow-md shadow-red-950/50"
        >
          Criar Primeira Meta
        </button>
      </div>
    );
  }

  const filteredSchedule = m.schedule.filter((row) => {
    if (monthFilter === 'DONE') return row.isCompleted;
    if (monthFilter === 'PARTIAL') return row.isPartial;
    if (monthFilter === 'PENDING') return !row.isCompleted;
    return true;
  });

  const activePartialRow =
    partialModalMonthIndex !== null ? m.schedule[partialModalMonthIndex] || null : null;

  const amountForConverterUSD =
    monthlyBudget.totalRemainingToBuyUSD > 0.0001
      ? monthlyBudget.totalRemainingToBuyUSD
      : monthlyBudget.totalPlannedUSD;

  return (
    <div className="space-y-3">
      {/* Barra Compacta: Dólares Necessários no Mês (Todas as Criptos) */}
      <section className="rounded-xl bg-gradient-to-r from-[#21090f]/95 via-[#140b0e]/95 to-[#120b0e]/95 border border-red-500/35 px-3 py-2.5 space-y-2 shadow-sm shadow-red-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#D91E2A]/20 border border-[#E11D2E]/45 flex items-center justify-center text-[#ff4d5a] shrink-0">
                <DollarSign className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-extrabold text-white whitespace-nowrap">
                Total Mês {monthlyBudget.monthNumber}:
              </span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-white tabular-nums whitespace-nowrap">
                {formatUSDT(monthlyBudget.totalPlannedUSD, 2)}
              </span>
              <span className="text-[11px] font-mono text-red-200/70 tabular-nums whitespace-nowrap hidden sm:inline">
                (≈ {formatBRL(monthlyBudget.totalPlannedUSD * fxRate, 2)})
              </span>
            </div>

            <span className="text-slate-700 hidden md:inline">|</span>

            <div className="text-[11px] tabular-nums whitespace-nowrap">
              {monthlyBudget.totalRemainingToBuyUSD > 0.0001 ? (
                <span className="text-slate-300">
                  Falta:{' '}
                  <strong className="font-mono text-emerald-400">
                    {formatUSDT(monthlyBudget.totalRemainingToBuyUSD, 2)}
                  </strong>{' '}
                  <span className="text-slate-500">
                    ({monthlyBudget.completedGoalsCount}/{monthlyBudget.activeGoalsCount} ok)
                  </span>
                </span>
              ) : (
                <span className="font-bold text-emerald-400">
                  Mês {monthlyBudget.monthNumber} 100% concluído!
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Seletor de Mês */}
            <div className="inline-flex items-center rounded-md bg-slate-950 border border-slate-800 p-0.5">
              <button
                type="button"
                disabled={safeBudgetMonthIndex <= 0}
                onClick={() => setBudgetMonthIndex((prev) => Math.max(0, prev - 1))}
                aria-label="Mês anterior"
                className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <select
                value={safeBudgetMonthIndex}
                onChange={(e) => setBudgetMonthIndex(parseInt(e.target.value, 10) || 0)}
                aria-label="Selecionar mês do cálculo consolidado"
                className="bg-transparent text-[11px] font-bold text-slate-200 px-1 py-0.5 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: monthlyBudget.maxMonths }, (_, idx) => {
                  const sampleLabel =
                    state.goals.find((g) => g.monthlyRecords[idx])?.monthlyRecords[idx]?.label ||
                    `Mês ${idx + 1}`;
                  return (
                    <option key={idx} value={idx} className="bg-slate-900 text-white">
                      M{idx + 1} · {sampleLabel}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                disabled={safeBudgetMonthIndex >= monthlyBudget.maxMonths - 1}
                onClick={() => setBudgetMonthIndex((prev) => Math.min(monthlyBudget.maxMonths - 1, prev + 1))}
                aria-label="Próximo mês"
                className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onSendMonthlyUsdToConverter(amountForConverterUSD)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-[10px] font-bold text-sky-300 transition-colors whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>Simular R$</span>
            </button>

            <button
              type="button"
              onClick={() => setBudgetDetailsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-200 transition-colors whitespace-nowrap"
            >
              <span>{budgetDetailsOpen ? 'Ocultar' : 'Detalhar'}</span>
              {budgetDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Chips rápidos das criptos do mês em linha única rolável */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {monthlyBudget.items.map((item) => {
            const isPartialItem = item.boughtQty > 0 && !item.isCompleted;
            return (
              <button
                key={item.goalId}
                type="button"
                onClick={() => onSelectGoal(item.goalId)}
                title={
                  isPartialItem
                    ? `${item.name} (Parcial): comprado ${formatCryptoQty(item.boughtQty, item.symbol)} de ${formatCryptoQty(item.plannedQty, item.symbol)} · Falta ${formatCryptoQty(item.remainingQty, item.symbol)} (${formatUSDT(item.remainingCostUSD, 2)})`
                    : `${item.name}: ${formatCryptoQty(item.plannedQty, item.symbol)} × ${formatUSDT(item.currentPriceUSD)} = ${formatUSDT(item.plannedCostUSD, 2)}`
                }
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                  item.isCompleted
                    ? 'bg-emerald-950/35 border-emerald-500/35 text-emerald-300'
                    : isPartialItem
                      ? 'bg-amber-950/35 border-amber-500/45 text-amber-200'
                      : 'bg-[#0e080b] border-red-950/70 hover:border-[#E11D2E]/60 text-slate-200'
                }`}
              >
                <CryptoLogo symbol={item.symbol} color={item.color} size={14} />
                <span className="font-bold">{item.symbol}</span>
                <span className={`font-mono ${isPartialItem ? 'text-amber-300' : 'text-sky-300'}`}>
                  {isPartialItem ? `falta ${formatUSDT(item.remainingCostUSD, 2)}` : formatUSDT(item.plannedCostUSD, 2)}
                </span>
                {item.isCompleted && <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Detalhamento Expandível por Cripto */}
        {budgetDetailsOpen && (
          <div className="overflow-x-auto rounded-lg border border-red-950/60 bg-[#0c070a]/80">
            <table className="w-full text-left border-collapse text-[11px] tabular-nums">
              <thead className="bg-[#0a0608] border-b border-red-950/60 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <tr>
                  <th className="py-1.5 px-3">Cripto</th>
                  <th className="py-1.5 px-2.5 text-right">Preço Atual</th>
                  <th className="py-1.5 px-2.5 text-right">Qtd Mês {monthlyBudget.monthNumber}</th>
                  <th className="py-1.5 px-2.5 text-right">Total (USDT)</th>
                  <th className="py-1.5 px-3 text-right">Falta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {monthlyBudget.items.map((item) => (
                  <tr
                    key={item.goalId}
                    onClick={() => onSelectGoal(item.goalId)}
                    className="hover:bg-red-950/25 cursor-pointer transition-colors"
                  >
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CryptoLogo symbol={item.symbol} color={item.color} size={18} />
                        <span className="font-bold text-white">{item.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{item.symbol}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono text-slate-300 whitespace-nowrap">
                      {formatUSDT(item.currentPriceUSD)}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono text-slate-200 whitespace-nowrap">
                      {formatCryptoQty(item.plannedQty, item.symbol)}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold text-sky-400 whitespace-nowrap">
                      {formatUSDT(item.plannedCostUSD, 2)}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono whitespace-nowrap">
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
                  <td colSpan={3} className="py-1.5 px-3 text-slate-200">
                    TOTAL — MÊS {monthlyBudget.monthNumber} ({monthlyBudget.activeGoalsCount} criptos)
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono text-sky-300 whitespace-nowrap">
                    {formatUSDT(monthlyBudget.totalPlannedUSD, 2)}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-emerald-400 whitespace-nowrap">
                    {formatUSDT(monthlyBudget.totalRemainingToBuyUSD, 2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Seletor de Ativos + Ações da Meta */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
          {state.goals.map((g) => {
            const gm = calculateGoalMetrics(g, state.pricesUSD, fxRate);
            const isSelected = g.id === goal.id;
            return (
                <button
                key={g.id}
                type="button"
                onClick={() => onSelectGoal(g.id)}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#D91E2A]/25 to-[#7F0A14]/20 text-white border border-[#E11D2E]/80 shadow-sm shadow-red-950/40'
                    : 'bg-[#120b0e] text-slate-400 hover:text-white border border-slate-800 hover:border-red-900/60'
                }`}
              >
                <CryptoLogo symbol={g.symbol} color={g.color} size={18} />
                <span>{g.name}</span>
                <span className="text-[10px] font-mono text-slate-400">{g.symbol}</span>
                <span className="font-mono text-[11px] text-emerald-400 tabular-nums">{gm.progressPct.toFixed(0)}%</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenGoalModal(goal.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#120b0e] hover:bg-[#1e1015] border border-slate-800 text-[11px] font-semibold text-slate-300 transition-colors whitespace-nowrap"
          >
            <Pencil className="w-3 h-3" />
            <span>Editar</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteGoal(goal.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/50 text-[11px] font-semibold text-rose-300 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remover</span>
          </button>
        </div>
      </div>

      {/* Faixa Compacta de Resumo da Meta Ativa */}
      <div className="rounded-xl bg-[#120b0e]/95 border border-slate-800/90 px-3.5 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* Identidade + Cotação + Progresso */}
          <div className="flex items-center gap-2.5 min-w-0">
            <CryptoLogo symbol={goal.symbol} color={goal.color} size={36} className="ring-1 ring-white/15 rounded-full" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-white">{goal.name}</h2>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300">
                  {goal.symbol}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                  {formatMoney(m.currentPriceUSD, state.currency, fxRate)}
                </span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  · {formatCryptoQty(m.totalAccumulatedCoins)} / {formatCryptoQty(goal.targetAmount, goal.symbol)}{' '}
                  <strong className="text-emerald-400">({m.progressPct.toFixed(1)}%)</strong>
                </span>
              </div>
              <div className="w-48 sm:w-64 h-1.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${m.progressPct}%`, backgroundColor: goal.color || '#10b981' }}
                />
              </div>
            </div>
          </div>

          {/* 4 Indicadores Inline sem cartões grandes */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs tabular-nums">
            <div>
              <div className="text-[10px] text-slate-500">Meta / Mês</div>
              <div className="font-mono font-bold text-white">
                {formatCryptoQty(m.baseMonthlyTargetQty, goal.symbol)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Custo / Mês</div>
              <div className="font-mono font-bold text-sky-400">
                <DualMoney amountUSD={m.estimatedMonthlyCostUSD} currency={state.currency} fxRate={fxRate} forceDecimals={2} />
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Preço Médio</div>
              <div className="font-mono font-bold text-emerald-400">
                {m.avgBuyPriceUSD > 0 ? (
                  formatMoney(m.avgBuyPriceUSD, state.currency, fxRate)
                ) : (
                  <span className="text-slate-500 font-sans font-medium">--</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <div>
                <div className="text-[10px] text-amber-400 font-semibold">Venda Alvo ({currSymbol})</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <NumericInput
                    value={Number(convertFromUSD(goal.retirementTargetPriceUSD, state.currency, fxRate).toFixed(4))}
                    onValueChange={(val) => onUpdateRetirementPrice(goal.id, val)}
                    decimalsOnBlur={4}
                    ariaLabel={`Preço de venda alvo de ${goal.symbol} em ${currSymbol}`}
                    className="w-20 h-6 rounded bg-slate-950 border border-amber-500/50 px-1.5 text-xs font-mono font-bold text-white tabular-nums focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] font-mono font-bold text-amber-300">
                    = {formatMoney(m.projectedRetirementTotalUSD, state.currency, fxRate, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Linha única de Certificação Aposentadoria */}
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
            <div className="pt-1.5 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-300">
                <span className="font-semibold text-amber-300">Aposentadoria:</span>
                <span>
                  Compradas no alvo:{' '}
                  <strong className="font-mono text-emerald-400">
                    {formatMoney(totalOwnedAtTargetUSD, state.currency, fxRate, 0)}
                  </strong>
                </span>
                <span className="text-slate-700">·</span>
                {missingFromOwnedUSD > 0 ? (
                  <span>
                    Falta:{' '}
                    <strong className="font-mono text-white">
                      {formatMoney(missingFromOwnedUSD, state.currency, fxRate, 0)}
                    </strong>
                    {m.retirementPriceUSD > 0 && (
                      <span className="text-slate-400">
                        {' '}
                        (≈ <strong className="font-mono text-amber-300">{formatCryptoQty(coinsNeededForRemainingGap, goal.symbol)}</strong>)
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-400">Alvo já garantido!</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {missingFromPlannedUSD > 0
                  ? `Metas DCA: faltam ${formatMoney(missingFromPlannedUSD, state.currency, fxRate, 0)}`
                  : 'Metas DCA cobrem 100%'}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Área Principal: Registros Mensais em Grade Compacta / Tabela Inline (8 cols) + Gráfico Ao Vivo (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Esquerda: Grade Compacta Multi-Mês ou Tabela Inline Densa */}
        <div className="lg:col-span-8 rounded-xl bg-[#120b0e]/95 border border-slate-800/90 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5">
                <CryptoLogo symbol={goal.symbol} color={goal.color} size={17} />
                <h3 className="text-xs font-extrabold text-white tracking-tight">
                  Registros Mensais · {goal.symbol}
                </h3>
              </div>

              {/* Toggle Grade Compacta vs Tabela Inline */}
              <div className="inline-flex rounded-md bg-slate-950 p-0.5 border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setScheduleView('GRID')}
                  title="Visualização em grade compacta (vários meses por linha)"
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold transition-all ${
                    scheduleView === 'GRID' ? 'spfc-gradient-btn text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Grade</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleView('TABLE')}
                  title="Visualização em tabela inline densa"
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold transition-all ${
                    scheduleView === 'TABLE' ? 'spfc-gradient-btn text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <List className="w-3 h-3" />
                  <span>Tabela</span>
                </button>
              </div>

              <div className="inline-flex rounded-md bg-slate-950 p-0.5 border border-slate-800 text-[10px]">
                {(
                  [
                    { id: 'ALL', label: `Todos (${m.schedule.length})` },
                    { id: 'PENDING', label: `Faltam (${m.remainingMonths})` },
                    ...(m.monthsPartial > 0
                      ? [{ id: 'PARTIAL' as MonthFilter, label: `Parciais (${m.monthsPartial})` }]
                      : []),
                    { id: 'DONE', label: `Feitos (${m.monthsCompleted})` }
                  ] as Array<{ id: MonthFilter; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setMonthFilter(f.id)}
                    className={`px-1.5 py-0.5 rounded font-semibold transition-colors whitespace-nowrap ${
                      monthFilter === f.id
                        ? f.id === 'PARTIAL'
                          ? 'bg-amber-500/25 text-amber-200'
                          : 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-[10px] font-bold text-sky-300 transition-colors whitespace-nowrap"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>BRL→USDT</span>
              </button>
              <button
                type="button"
                onClick={() => onAutoFillNextEmptyMonth(goal.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                <span>Lançar Próximo</span>
              </button>
            </div>
          </div>

          {filteredSchedule.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">Nenhum mês neste filtro.</div>
          ) : scheduleView === 'GRID' ? (
            /* MODO GRADE COMPACTA: 2 a 3 meses por linha, com suporte a compras parciais */
            <div className="p-2.5 max-h-[540px] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
                {filteredSchedule.map((row) => {
                  const priceDisplayVal =
                    row.pricePaidUSD > 0 ? convertFromUSD(row.pricePaidUSD, state.currency, fxRate) : 0;
                  const monthPct =
                    row.plannedQty > 0 ? Math.min(100, (row.boughtQty / row.plannedQty) * 100) : 0;

                  return (
                    <div
                      key={`${goal.id}-${row.index}`}
                      className={`rounded-lg border px-2 py-1.5 transition-colors tabular-nums ${
                        row.isCompleted
                          ? 'bg-emerald-950/20 border-emerald-500/35'
                          : row.isPartial
                            ? 'bg-amber-950/20 border-amber-500/45'
                            : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      {/* Linha 1: Mês + Meta + Custo + Botões (+ Parcial e Check) */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className={`inline-flex items-center justify-center min-w-[20px] h-4 px-1 rounded text-[10px] font-bold font-mono shrink-0 ${
                              row.isCompleted
                                ? 'bg-emerald-500 text-slate-950'
                                : row.isPartial
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            M{row.month}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-200 truncate">{row.label}</span>
                          <span className="text-[10px] font-mono text-slate-500 truncate">
                            ({formatCryptoQty(row.plannedQty)})
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              row.monthCostUSD > 0
                                ? row.isPartial
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                                : 'text-slate-500'
                            }`}
                            title={
                              row.monthCostUSD > 0
                                ? `Pago: ${formatMoney(row.monthCostUSD, state.currency, fxRate, 2)} · PM acumulado: ${formatMoney(row.cumAvgPriceUSD, state.currency, fxRate)}`
                                : `Estimativa atual: ${formatMoney(row.estimatedMonthCostAtLivePriceUSD, state.currency, fxRate, 2)}`
                            }
                          >
                            {row.monthCostUSD > 0
                              ? state.currency === 'BRL'
                                ? formatBRL(row.monthCostBRL, 2)
                                : formatMoney(row.monthCostUSD, state.currency, fxRate, 2)
                              : `~${formatMoney(row.estimatedMonthCostAtLivePriceUSD, state.currency, fxRate, 0)}`}
                          </span>
                          <button
                            type="button"
                            title={
                              row.entriesCount > 0
                                ? `Gerenciar lançamentos parciais (${row.entriesCount} lote${row.entriesCount > 1 ? 's' : ''}) ou somar mais compras`
                                : `Adicionar compra parcial no Mês ${row.month}`
                            }
                            onClick={() => setPartialModalMonthIndex(row.index)}
                            className={`h-5 px-1 rounded inline-flex items-center justify-center gap-0.5 text-[9px] font-mono font-bold transition-colors shrink-0 ${
                              row.isPartial
                                ? 'bg-amber-500/25 text-amber-200 border border-amber-500/45 hover:bg-amber-500 hover:text-slate-950'
                                : row.entriesCount > 1
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500 hover:text-slate-950'
                                  : 'bg-slate-800 text-slate-300 hover:bg-[#D91E2A] hover:text-white'
                            }`}
                          >
                            <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                            {row.entriesCount > 1 && <span>{row.entriesCount}x</span>}
                          </button>
                          <button
                            type="button"
                            title={
                              row.isPartial
                                ? `Completar restante do mês (+${formatCryptoQty(row.remainingMonthQty, goal.symbol)}) na cotação atual`
                                : `Lançar meta completa (${formatCryptoQty(row.plannedQty, goal.symbol)}) na cotação atual`
                            }
                            onClick={() => onQuickCompleteMonth(goal.id, row.index, row.plannedQty)}
                            className={`w-5 h-5 rounded inline-flex items-center justify-center transition-colors shrink-0 ${
                              row.isCompleted
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950'
                                : 'bg-slate-800 text-slate-400 hover:bg-emerald-500 hover:text-slate-950'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Linha 2: Inputs Inline Qtd @ Preço */}
                      <div className="flex items-center gap-1">
                        <NumericInput
                          value={row.boughtQty}
                          onValueChange={(val) =>
                            onUpdateMonthlyRecordNumber(goal.id, row.index, 'boughtQty', val)
                          }
                          placeholder={row.plannedQty.toFixed(2)}
                          decimalsOnBlur={4}
                          ariaLabel={`Quantidade comprada no mês ${row.month}`}
                          className={`min-w-0 flex-1 h-6 rounded bg-slate-950 border ${
                            row.isCompleted
                              ? 'border-emerald-500/40 text-emerald-100'
                              : row.isPartial
                                ? 'border-amber-500/45 text-amber-100'
                                : 'border-slate-800 text-slate-200'
                          } px-1.5 text-[11px] font-mono focus:outline-none focus:border-emerald-500`}
                        />
                        <span className="text-[10px] text-slate-600 shrink-0">@</span>
                        <NumericInput
                          value={priceDisplayVal}
                          onValueChange={(val) =>
                            onUpdateMonthlyRecordNumber(goal.id, row.index, 'pricePaid', val)
                          }
                          placeholder={convertFromUSD(m.currentPriceUSD, state.currency, fxRate).toFixed(2)}
                          decimalsOnBlur={4}
                          ariaLabel={`Preço pago no mês ${row.month}`}
                          className={`min-w-0 flex-1 h-6 rounded bg-slate-950 border ${
                            row.pricePaidUSD > 0
                              ? row.isPartial
                                ? 'border-amber-500/45 text-amber-100'
                                : 'border-emerald-500/40 text-emerald-100'
                              : 'border-slate-800 text-slate-200'
                          } px-1.5 text-[11px] font-mono focus:outline-none focus:border-emerald-500`}
                        />
                      </div>

                      {/* Linha 3 (compacta): Indicador de restante quando parcial */}
                      {row.isPartial && (
                        <button
                          type="button"
                          onClick={() => setPartialModalMonthIndex(row.index)}
                          className="mt-1.5 w-full text-left group"
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
                            <span className="text-amber-300 font-semibold group-hover:underline">
                              Falta {formatCryptoQty(row.remainingMonthQty)} ({monthPct.toFixed(0)}%)
                            </span>
                            <span className="text-slate-400">
                              ~{formatMoney(row.estimatedRemainingMonthCostUSD, state.currency, fxRate, 0)}
                            </span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all"
                              style={{ width: `${monthPct}%` }}
                            />
                          </div>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* MODO TABELA INLINE DENSA */
            <div className="max-h-[540px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-950/95 border-b border-slate-800 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  <tr>
                    <th className="py-1.5 pl-3 pr-2">Mês</th>
                    <th className="py-1.5 px-2 text-right">Meta / Falta</th>
                    <th className="py-1.5 px-2">Comprado @ Preço ({currSymbol})</th>
                    <th className="py-1.5 pl-2 pr-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px] tabular-nums">
                  {filteredSchedule.map((row) => {
                    const priceDisplayVal =
                      row.pricePaidUSD > 0 ? convertFromUSD(row.pricePaidUSD, state.currency, fxRate) : 0;

                    return (
                      <tr
                        key={`${goal.id}-${row.index}`}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          row.isCompleted ? 'bg-emerald-950/15' : row.isPartial ? 'bg-amber-950/15' : ''
                        }`}
                      >
                        <td className="py-1 pl-3 pr-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded text-[10px] font-bold font-mono ${
                                row.isCompleted
                                  ? 'bg-emerald-500 text-slate-950'
                                  : row.isPartial
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-800/90 text-slate-400'
                              }`}
                            >
                              {row.month}
                            </span>
                            <span className="font-medium text-slate-300">{row.label}</span>
                          </div>
                        </td>

                        <td className="py-1 px-2 text-right font-mono whitespace-nowrap">
                          <div className="text-slate-400">{formatCryptoQty(row.plannedQty)}</div>
                          {row.isPartial && (
                            <div className="text-[9px] text-amber-300 font-semibold">
                              falta {formatCryptoQty(row.remainingMonthQty)}
                            </div>
                          )}
                        </td>

                        <td className="py-1 px-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <NumericInput
                              value={row.boughtQty}
                              onValueChange={(val) =>
                                onUpdateMonthlyRecordNumber(goal.id, row.index, 'boughtQty', val)
                              }
                              placeholder={row.plannedQty.toFixed(2)}
                              decimalsOnBlur={4}
                              ariaLabel={`Quantidade comprada no mês ${row.month}`}
                              className={`w-[74px] h-6 rounded bg-slate-950 border ${
                                row.isCompleted
                                  ? 'border-emerald-500/40 text-emerald-100'
                                  : row.isPartial
                                    ? 'border-amber-500/45 text-amber-100'
                                    : 'border-slate-800 text-slate-200'
                              } px-1.5 text-[11px] font-mono focus:outline-none focus:border-emerald-500`}
                            />
                            <span className="text-[10px] text-slate-600">@</span>
                            <NumericInput
                              value={priceDisplayVal}
                              onValueChange={(val) =>
                                onUpdateMonthlyRecordNumber(goal.id, row.index, 'pricePaid', val)
                              }
                              placeholder={convertFromUSD(m.currentPriceUSD, state.currency, fxRate).toFixed(2)}
                              decimalsOnBlur={4}
                              ariaLabel={`Preço pago no mês ${row.month}`}
                              className={`w-[72px] h-6 rounded bg-slate-950 border ${
                                row.pricePaidUSD > 0
                                  ? row.isPartial
                                    ? 'border-amber-500/45 text-amber-100'
                                    : 'border-emerald-500/40 text-emerald-100'
                                  : 'border-slate-800 text-slate-200'
                              } px-1.5 text-[11px] font-mono focus:outline-none focus:border-emerald-500`}
                            />
                            <button
                              type="button"
                              title={
                                row.entriesCount > 0
                                  ? `Lançamentos parciais (${row.entriesCount} lote${row.entriesCount > 1 ? 's' : ''}) — clique para adicionar ou editar`
                                  : `Adicionar lançamento parcial no Mês ${row.month}`
                              }
                              onClick={() => setPartialModalMonthIndex(row.index)}
                              className={`h-6 px-1.5 rounded inline-flex items-center justify-center gap-0.5 text-[10px] font-mono font-bold transition-colors shrink-0 ${
                                row.isPartial
                                  ? 'bg-amber-500/25 text-amber-200 border border-amber-500/45 hover:bg-amber-500 hover:text-slate-950'
                                  : row.entriesCount > 1
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500 hover:text-slate-950'
                                    : 'bg-slate-800/80 text-slate-300 hover:bg-[#D91E2A] hover:text-white'
                              }`}
                            >
                              <Plus className="w-3 h-3" />
                              {row.entriesCount > 1 && <span>{row.entriesCount}x</span>}
                            </button>
                            <button
                              type="button"
                              title={
                                row.isPartial
                                  ? `Completar restante (+${formatCryptoQty(row.remainingMonthQty, goal.symbol)}) na cotação atual`
                                  : 'Preencher meta do mês na cotação atual'
                              }
                              onClick={() => onQuickCompleteMonth(goal.id, row.index, row.plannedQty)}
                              className={`w-6 h-6 rounded inline-flex items-center justify-center transition-colors shrink-0 ${
                                row.isCompleted
                                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950'
                                  : 'bg-slate-800/80 text-slate-400 hover:bg-emerald-500 hover:text-slate-950'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td
                          className="py-1 pl-2 pr-3 text-right font-mono whitespace-nowrap"
                          title={
                            row.monthCostUSD > 0
                              ? `Pago: ${formatMoney(row.monthCostUSD, state.currency, fxRate, 2)} (${formatBRL(row.monthCostBRL, 2)}) · PM acumulado: ${formatMoney(row.cumAvgPriceUSD, state.currency, fxRate)}`
                              : `Estimativa na cotação atual: ${formatMoney(row.estimatedMonthCostAtLivePriceUSD, state.currency, fxRate, 2)}`
                          }
                        >
                          {row.monthCostUSD > 0 ? (
                            <span className={`font-bold ${row.isPartial ? 'text-amber-300' : 'text-emerald-400'}`}>
                              {state.currency === 'BRL'
                                ? formatBRL(row.monthCostBRL, 2)
                                : formatMoney(row.monthCostUSD, state.currency, fxRate, 2)}
                            </span>
                          ) : (
                            <span className="text-slate-600">
                              ~{formatMoney(row.estimatedMonthCostAtLivePriceUSD, state.currency, fxRate, 2)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Direita: Gráfico DCA Automático em Tempo Real */}
        <div className="lg:col-span-4 rounded-xl bg-[#120b0e]/95 border border-slate-800/90 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <CryptoLogo symbol={goal.symbol} color={goal.color} size={18} />
              <div>
                <h3 className="text-xs font-extrabold text-white">Gráfico DCA Ao Vivo</h3>
                <p className="text-[10px] text-slate-400">Atualiza ao lançar compras</p>
              </div>
            </div>

            <div className="inline-flex rounded-md bg-slate-950 p-0.5 border border-slate-800 text-[10px]">
              {(
                [
                  { id: 'SPENT', label: 'Valor' },
                  { id: 'ACCUMULATION', label: 'Moedas' },
                  { id: 'AVG_PRICE', label: 'PM' }
                ] as Array<{ id: DcaChartMode; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChartMode(tab.id)}
                  className={`px-1.5 py-0.5 rounded font-bold transition-all whitespace-nowrap ${
                    chartMode === tab.id ? 'spfc-gradient-btn text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-60 w-full">
            <canvas ref={canvasRef} />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px] tabular-nums">
            <div>
              <div className="text-[10px] text-slate-400">Comprado</div>
              <div className="font-mono font-bold text-white mt-0.5 truncate">
                {formatCryptoQty(m.totalBoughtDCA, goal.symbol)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Investido</div>
              <div className="font-mono font-bold text-emerald-400 mt-0.5 truncate">
                {formatMoney(m.totalInvestedUSD, state.currency, fxRate, 2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Falta</div>
              <div className="font-mono font-bold text-slate-300 mt-0.5 truncate">
                {formatCryptoQty(m.remainingCoinsToBuy, goal.symbol)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PartialPurchaseModal
        isOpen={partialModalMonthIndex !== null && activePartialRow !== null}
        goal={goal}
        row={activePartialRow}
        currentPriceUSD={m.currentPriceUSD}
        currency={state.currency}
        fxRate={fxRate}
        onClose={() => setPartialModalMonthIndex(null)}
        onAddPartialPurchase={onAddPartialPurchase}
        onRemovePartialPurchase={onRemovePartialPurchase}
      />
    </div>
  );
};
