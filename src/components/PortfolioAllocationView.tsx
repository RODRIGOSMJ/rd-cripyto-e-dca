import React, { useEffect, useRef, useState } from 'react';
import { Chart, ChartConfiguration, Plugin, registerables } from 'chart.js';
import { ArrowUpRight, BarChart3, CircleDot, PieChart } from 'lucide-react';
import { AppState } from '../types';
import {
  calculateGoalMetrics,
  formatBRL,
  formatCryptoQty,
  formatMoney,
  formatUSDT,
  getEffectiveUsdtBrlRate,
  getMultiplier
} from '../utils/calculations';
import { CryptoLogo } from './CryptoLogo';

Chart.register(...registerables);

type AllocationBasis = 'CURRENT' | 'TARGET';
type ChartVisualMode = 'DOUGHNUT' | 'PIE' | 'BAR';

interface PortfolioAllocationViewProps {
  state: AppState;
  onOpenGoalInPlanner: (goalId: string) => void;
  onOpenNewGoalModal: () => void;
}

const VIBRANT_SPECTRUM = [
  '#8b5cf6', // Roxo vibrante
  '#f59e0b', // Âmbar dourado
  '#10b981', // Esmeralda
  '#3b82f6', // Azul cobalto
  '#e11d2e', // Vermelho SPFC
  '#06b6d4', // Ciano
  '#ec4899', // Magenta
  '#84cc16', // Verde lima
  '#f97316', // Laranja
  '#a855f7', // Violeta
  '#14b8a6', // Turquesa
  '#eab308'  // Amarelo ouro
];

function resolveDistinctSliceColors(colors: string[]): string[] {
  const used = new Set<string>();
  return colors.map((raw, idx) => {
    const normalized = (raw || '').toLowerCase();
    if (normalized && !used.has(normalized)) {
      used.add(normalized);
      return raw;
    }
    const fallback =
      VIBRANT_SPECTRUM.find((c) => !used.has(c.toLowerCase())) ||
      VIBRANT_SPECTRUM[idx % VIBRANT_SPECTRUM.length];
    used.add(fallback.toLowerCase());
    return fallback;
  });
}

const slicePercentageLabelsPlugin: Plugin<'doughnut' | 'pie'> = {
  id: 'slicePercentageLabels',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    const dataset = data.datasets[0];
    if (!dataset || !Array.isArray(dataset.data)) return;

    const total = dataset.data.reduce((acc, v) => acc + (Number(v) || 0), 0);
    if (total <= 0) return;

    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    meta.data.forEach((element, idx) => {
      const value = Number(dataset.data[idx]) || 0;
      const pct = (value / total) * 100;
      if (pct < 4.5) return; // Evita sobreposição em fatias muito finas

      const pos = element.tooltipPosition(false);
      if (pos.x == null || pos.y == null) return;
      const px = pos.x;
      const py = pos.y;
      const label = `${pct.toFixed(1).replace('.', ',')}%`;

      ctx.fillStyle = 'rgba(9, 8, 11, 0.72)';
      const textWidth = ctx.measureText(label).width;
      const padX = 5;
      const boxW = textWidth + padX * 2;
      const boxH = 18;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(px - boxW / 2, py - boxH / 2, boxW, boxH, 5);
      } else {
        ctx.rect(px - boxW / 2, py - boxH / 2, boxW, boxH);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, px, py + 0.5);
    });

    ctx.restore();
  }
};

interface AllocationChartCanvasProps {
  chartKey: string;
  config: ChartConfiguration;
  plugins?: Plugin[];
}

const AllocationChartCanvas: React.FC<AllocationChartCanvasProps> = ({
  chartKey,
  config,
  plugins
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<Chart | null>(null);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (instanceRef.current && keyRef.current === chartKey) {
      instanceRef.current.data = config.data;
      if (config.options) {
        instanceRef.current.options = config.options;
      }
      instanceRef.current.update('none');
      return;
    }

    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    instanceRef.current = new Chart(canvas, {
      ...config,
      plugins
    });
    keyRef.current = chartKey;
  }, [chartKey, config, plugins]);

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
      keyRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} />;
};

export const PortfolioAllocationView: React.FC<PortfolioAllocationViewProps> = ({
  state,
  onOpenGoalInPlanner,
  onOpenNewGoalModal
}) => {
  const [basis, setBasis] = useState<AllocationBasis>('CURRENT');
  const [visualMode, setVisualMode] = useState<ChartVisualMode>('DOUGHNUT');

  if (state.goals.length === 0) {
    return (
      <section className="rounded-2xl bg-[#120b0e]/95 border border-slate-800/90 p-8 text-center space-y-3">
        <p className="text-sm text-slate-300">
          Adicione pelo menos uma criptomoeda para visualizar a divisão percentual da sua carteira.
        </p>
        <button
          type="button"
          onClick={onOpenNewGoalModal}
          className="px-4 py-2 rounded-xl spfc-gradient-btn text-xs font-bold text-white border border-white/10"
        >
          Adicionar Primeira Cripto
        </button>
      </section>
    );
  }

  const fxRate = getEffectiveUsdtBrlRate(state);
  const multCurr = getMultiplier(state.currency, fxRate);
  const isBRL = state.currency === 'BRL';

  const rawItems = state.goals.map((g) => {
    const metrics = calculateGoalMetrics(g, state.pricesUSD, fxRate);
    const currentValUSD = Math.max(0, metrics.totalPositionValueUSD);
    const targetValUSD = Math.max(0, g.targetAmount * metrics.currentPriceUSD);
    return {
      goal: g,
      metrics,
      currentValUSD,
      targetValUSD
    };
  });

  const totalCurrentUSD = rawItems.reduce((acc, item) => acc + item.currentValUSD, 0);
  const totalTargetUSD = rawItems.reduce((acc, item) => acc + item.targetValUSD, 0);
  const hasCurrentHoldings = totalCurrentUSD > 0.0001;

  // Se usuário selecionou Saldo Atual mas ainda não tem compras/saldo, informa e mostra fallback visual ou zero
  const effectiveBasis: AllocationBasis = basis === 'CURRENT' && !hasCurrentHoldings ? 'TARGET' : basis;
  const usingFallbackTarget = basis === 'CURRENT' && !hasCurrentHoldings;

  const totalBasisUSD = effectiveBasis === 'CURRENT' ? totalCurrentUSD : totalTargetUSD;

  const distinctColors = resolveDistinctSliceColors(rawItems.map((i) => i.goal.color));

  const rankedItems = rawItems
    .map((item, idx) => {
      const valueUSD = effectiveBasis === 'CURRENT' ? item.currentValUSD : item.targetValUSD;
      const coins =
        effectiveBasis === 'CURRENT' ? item.metrics.totalAccumulatedCoins : item.goal.targetAmount;
      const pct = totalBasisUSD > 0 ? (valueUSD / totalBasisUSD) * 100 : 100 / rawItems.length;
      return {
        ...item,
        sliceColor: distinctColors[idx],
        valueUSD,
        displayValue: Number((valueUSD * multCurr).toFixed(2)),
        coins,
        pct
      };
    })
    .sort((a, b) => b.pct - a.pct);

  const chartLabels = rankedItems.map((i) => i.goal.symbol);
  const chartValues = rankedItems.map((i) => (totalBasisUSD > 0 ? i.displayValue : 1));
  const chartColors = rankedItems.map((i) => i.sliceColor);

  const circularConfig: ChartConfiguration<'doughnut' | 'pie'> = {
    type: visualMode === 'PIE' ? 'pie' : 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [
        {
          data: chartValues,
          backgroundColor: chartColors,
          hoverBackgroundColor: chartColors,
          borderColor: '#120b0e',
          borderWidth: 3,
          hoverOffset: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      cutout: visualMode === 'PIE' ? '0%' : '62%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#09080b',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const item = rankedItems[ctx.dataIndex];
              if (!item) return '';
              const moneyStr = formatMoney(item.valueUSD, state.currency, fxRate, 2);
              return ` ${item.goal.name} (${item.goal.symbol}): ${item.pct.toFixed(1).replace('.', ',')}% · ${moneyStr}`;
            },
            afterLabel: (ctx) => {
              const item = rankedItems[ctx.dataIndex];
              if (!item) return '';
              return ` Quantidade: ${formatCryptoQty(item.coins, item.goal.symbol)}`;
            }
          }
        }
      }
    }
  };

  const barConfig: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: rankedItems.map((i) => `${i.goal.symbol} (${i.pct.toFixed(1).replace('.', ',')}%)`),
      datasets: [
        {
          label: '% na Carteira',
          data: rankedItems.map((i) => Number(i.pct.toFixed(2))),
          backgroundColor: chartColors,
          borderRadius: 6,
          barThickness: 22
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = rankedItems[ctx.dataIndex];
              if (!item) return '';
              return ` ${item.pct.toFixed(2).replace('.', ',')}% · ${formatMoney(item.valueUSD, state.currency, fxRate, 2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            callback: (val) => `${val}%`
          },
          grid: { color: 'rgba(51,65,85,0.3)' }
        },
        y: {
          ticks: { color: '#f1f5f9', font: { size: 11, weight: 'bold' } },
          grid: { display: false }
        }
      }
    }
  };

  return (
    <section className="rounded-2xl bg-[#120b0e]/95 border border-slate-800/90 p-5 sm:p-6 space-y-5">
      {/* Cabeçalho e Controles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-red-950/60 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Divisão Percentual da Carteira
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {usingFallbackTarget
              ? 'Você ainda não registrou compras ou saldo inicial — exibindo a divisão planejada das metas (100% DCA).'
              : effectiveBasis === 'CURRENT'
                ? 'Proporção em tempo real do quanto você já acumulou em cada criptomoeda (saldo + compras DCA).'
                : 'Proporção projetada quando todas as suas metas de acumulação forem concluídas.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Seletor de Base: Acumulado Hoje vs Meta Final */}
          <div
            role="group"
            aria-label="Base de cálculo da divisão"
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800"
          >
            <button
              type="button"
              onClick={() => setBasis('CURRENT')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                basis === 'CURRENT'
                  ? 'bg-[#D91E2A] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Acumulado Hoje
            </button>
            <button
              type="button"
              onClick={() => setBasis('TARGET')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                basis === 'TARGET'
                  ? 'bg-[#D91E2A] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Meta Final (100%)
            </button>
          </div>

          {/* Seletor de Formato Visual */}
          <div
            role="group"
            aria-label="Estilo do gráfico"
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800"
          >
            <button
              type="button"
              onClick={() => setVisualMode('DOUGHNUT')}
              title="Gráfico em Rosca"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                visualMode === 'DOUGHNUT'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span>Rosca</span>
            </button>
            <button
              type="button"
              onClick={() => setVisualMode('PIE')}
              title="Gráfico em Pizza"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                visualMode === 'PIE'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Pizza</span>
            </button>
            <button
              type="button"
              onClick={() => setVisualMode('BAR')}
              title="Gráfico em Barras"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                visualMode === 'BAR'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Barras</span>
            </button>
          </div>
        </div>
      </div>

      {/* Área Principal: Gráfico Colorido (Esquerda) + Detalhamento % por Cripto (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Coluna Esquerda: Gráfico */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-full h-[300px] sm:h-[340px]">
            {visualMode === 'BAR' ? (
              <AllocationChartCanvas chartKey="alloc-bar" config={barConfig as ChartConfiguration} />
            ) : (
              <>
                <AllocationChartCanvas
                  chartKey={`alloc-${visualMode}`}
                  config={circularConfig as ChartConfiguration}
                  plugins={[slicePercentageLabelsPlugin as Plugin]}
                />
                {visualMode === 'DOUGHNUT' && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {effectiveBasis === 'CURRENT' ? 'Total Acumulado' : 'Total das Metas'}
                    </span>
                    <span className="text-base sm:text-lg font-extrabold text-white font-mono tabular-nums mt-0.5">
                      {isBRL
                        ? formatBRL(totalBasisUSD * fxRate, 2)
                        : formatUSDT(totalBasisUSD, 2)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                      {rankedItems.length} {rankedItems.length === 1 ? 'cripto' : 'criptos'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Coluna Direita: Lista Ordenada com % e Barras Coloridas */}
        <div className="lg:col-span-7 divide-y divide-slate-800/80 border-t border-b border-slate-800/80">
          {rankedItems.map((item) => {
            const pctFormatted = item.pct.toFixed(1).replace('.', ',');
            const progressPct = Math.min(100, Math.max(0, item.metrics.progressPct));

            return (
              <div
                key={item.goal.id}
                className="py-3 px-2 sm:px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-red-950/15 transition-colors"
              >
                {/* Identificação + Barra Proporcional */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        aria-hidden="true"
                        className="w-3 h-3 rounded-sm shrink-0 ring-1 ring-white/20"
                        style={{ backgroundColor: item.sliceColor }}
                      />
                      <CryptoLogo symbol={item.goal.symbol} color={item.sliceColor} size={22} />
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-sm font-bold text-white truncate">{item.goal.name}</span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {item.goal.symbol}
                        </span>
                      </div>
                    </div>

                    <span
                      className="text-sm sm:text-base font-extrabold font-mono tabular-nums shrink-0"
                      style={{ color: item.sliceColor }}
                    >
                      {pctFormatted}%
                    </span>
                  </div>

                  {/* Barra de participação colorida */}
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                      style={{
                        width: `${Math.max(2, Math.min(100, item.pct))}%`,
                        backgroundColor: item.sliceColor
                      }}
                    />
                  </div>

                  {/* Sublinha de quantidades */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400 font-mono tabular-nums">
                    <span>
                      {effectiveBasis === 'CURRENT' ? 'Acumulado: ' : 'Meta final: '}
                      <strong className="text-slate-200">
                        {formatCryptoQty(item.coins, item.goal.symbol)}
                      </strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>Progresso da meta: {progressPct.toFixed(1).replace('.', ',')}%</span>
                  </div>
                </div>

                {/* Valor + Ação */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0 sm:min-w-[140px]">
                  <div className="text-left sm:text-right font-mono tabular-nums">
                    <div className="text-xs sm:text-sm font-bold text-white">
                      {formatMoney(item.valueUSD, state.currency, fxRate, 2)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isBRL ? formatUSDT(item.valueUSD, 2) : formatBRL(item.valueUSD * fxRate, 2)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenGoalInPlanner(item.goal.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded px-1.5 py-0.5 hover:bg-slate-800/70"
                  >
                    <span>Abrir DCA</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
