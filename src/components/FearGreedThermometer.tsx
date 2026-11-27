import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Thermometer, TrendingDown, TrendingUp } from 'lucide-react';
import {
  RealtimeSentimentSummary,
  classifySentimentScore
} from '../utils/fearGreedService';

interface FearGreedThermometerProps {
  summary: RealtimeSentimentSummary | null;
  loading: boolean;
  error: string | null;
  isLiveConnected: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onRefresh: () => void;
}

type ThermometerMode = 'REALTIME' | 'OFFICIAL';

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
) {
  const start = polarToCartesian(cx, cy, radius, startAngleDeg);
  const end = polarToCartesian(cx, cy, radius, endAngleDeg);
  const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return 'em breve';
  const hrs = Math.floor(secondsRemaining / 3600);
  const mins = Math.floor((secondsRemaining % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m`;
}

function formatSignedPct(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return '--';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2).replace('.', ',')}%`;
}

const GAUGE_SEGMENTS = [
  { from: 0, to: 42, color: '#e11d2e', label: 'Medo Extremo' },
  { from: 45, to: 79, color: '#f97316', label: 'Medo' },
  { from: 82, to: 98, color: '#eab308', label: 'Neutro' },
  { from: 101, to: 135, color: '#84cc16', label: 'Ganância' },
  { from: 138, to: 180, color: '#10b981', label: 'Ganância Extrema' }
];

export const FearGreedThermometer: React.FC<FearGreedThermometerProps> = ({
  summary,
  loading,
  error,
  isLiveConnected,
  isOpen,
  onToggleOpen,
  onRefresh
}) => {
  const [mode, setMode] = useState<ThermometerMode>('REALTIME');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) {
    const quickScore = summary ? (mode === 'REALTIME' ? summary.realtimeScore : summary.officialScore) : null;
    const quickMeta = quickScore !== null ? classifySentimentScore(quickScore) : null;

    return (
      <section
        aria-label="Termômetro de Medo e Ganância recolhido"
        className="rounded-xl bg-[#120b0e]/85 border border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300 tabular-nums min-w-0">
          <Thermometer className="w-3.5 h-3.5 text-[#ff4d5a] shrink-0" />
          <span className="font-bold text-white whitespace-nowrap">Termômetro Medo &amp; Ganância</span>
          {summary && quickScore !== null && quickMeta ? (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={`font-mono font-bold whitespace-nowrap ${quickMeta.textClass}`}>
                {quickScore}/100 ({quickMeta.labelPt})
              </span>
              {summary.portfolioChange24hPct !== null && (
                <>
                  <span aria-hidden="true" className="text-slate-600 hidden sm:inline">·</span>
                  <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                    Carteira 24h:{' '}
                    <strong
                      className={`font-mono ${
                        summary.portfolioChange24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatSignedPct(summary.portfolioChange24hPct)}
                    </strong>
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-slate-500 text-[11px]">
              {loading ? 'Sincronizando...' : 'Recolhido'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleOpen}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/90 text-[11px] font-bold text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <Eye className="w-3.5 h-3.5 text-[#ff4d5a]" />
          <span>Mostrar Termômetro</span>
        </button>
      </section>
    );
  }

  if (loading && !summary) {
    return (
      <section
        aria-label="Termômetro de Medo e Ganância"
        className="rounded-xl bg-[#120b0e]/95 border border-slate-800/90 px-4 py-4 sm:px-5 animate-pulse motion-reduce:animate-none"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-5 flex-1">
            <div className="w-44 h-24 rounded-lg bg-slate-900/80 shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 w-56 rounded bg-slate-900/80" />
              <div className="h-2.5 w-full rounded bg-slate-900/80" />
              <div className="h-3.5 w-3/4 rounded bg-slate-900/80" />
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleOpen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-white self-start shrink-0"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Ocultar</span>
          </button>
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section
        aria-label="Termômetro de Medo e Ganância"
        className="rounded-xl bg-[#120b0e]/95 border border-slate-800/90 px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <Thermometer className="w-4 h-4 text-[#ff4d5a] shrink-0" />
          <span>{error || 'Não foi possível carregar o Termômetro de Medo e Ganância agora.'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Tentar novamente</span>
          </button>
          <button
            type="button"
            onClick={onToggleOpen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Ocultar</span>
          </button>
        </div>
      </section>
    );
  }

  const activeScore = mode === 'REALTIME' ? summary.realtimeScore : summary.officialScore;
  const meta = classifySentimentScore(activeScore);

  // Mapeia 0..100 para ângulo -90deg (esquerda) a +90deg (direita)
  const needleAngleDeg = -90 + (activeScore / 100) * 180;

  const fetchedAtMs = new Date(summary.fetchedAtISO).getTime();
  const elapsedSec = Number.isFinite(fetchedAtMs) ? Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000)) : 0;
  const remainingSec = Math.max(0, summary.timeUntilUpdateSec - elapsedSec);
  const fetchedTimeLabel = Number.isFinite(fetchedAtMs)
    ? new Date(fetchedAtMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const yesterdayDiff =
    summary.yesterdayScore !== null ? activeScore - summary.yesterdayScore : null;
  const weekDiff =
    summary.weekAgoScore !== null ? activeScore - summary.weekAgoScore : null;

  return (
    <section
      aria-label="Termômetro de Medo e Ganância em Tempo Real"
      className="rounded-xl bg-[#120b0e]/95 border border-slate-800/90 px-4 py-4 sm:px-5"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Coluna 1: Termômetro Semicircular SVG */}
        <div className="lg:col-span-3 flex items-center gap-4 lg:border-r lg:border-slate-800/80 lg:pr-4">
          <div className="relative w-[148px] shrink-0 mx-auto sm:mx-0">
            <svg
              viewBox="0 0 220 124"
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label={`Termômetro marcando ${activeScore} de 100: ${meta.labelPt}`}
            >
              {/* Trilha de fundo */}
              <path
                d={describeArc(110, 104, 78, 0, 180)}
                fill="none"
                stroke="#1e293b"
                strokeWidth="14"
                strokeLinecap="butt"
              />

              {/* 5 zonas reais de sentimento */}
              {GAUGE_SEGMENTS.map((seg) => (
                <path
                  key={seg.label}
                  d={describeArc(110, 104, 78, seg.from, seg.to)}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="14"
                  strokeLinecap="butt"
                  opacity={0.92}
                />
              ))}

              {/* Rótulos da escala */}
              <text x="16" y="114" fill="#64748b" fontSize="10" fontFamily="JetBrains Mono, monospace">
                0
              </text>
              <text x="103" y="15" fill="#64748b" fontSize="10" fontFamily="JetBrains Mono, monospace">
                50
              </text>
              <text x="192" y="114" fill="#64748b" fontSize="10" fontFamily="JetBrains Mono, monospace">
                100
              </text>

              {/* Ponteiro animado com compositor transform */}
              <g
                style={{
                  transform: `rotate(${needleAngleDeg}deg)`,
                  transformOrigin: '110px 104px',
                  transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                className="motion-reduce:transition-none"
              >
                <polygon points="107,104 110,33 113,104" fill="#f8fafc" />
                <circle cx="110" cy="104" r="7" fill="#0f172a" stroke={meta.colorHex} strokeWidth="3" />
              </g>
            </svg>

            <div className="-mt-3 text-center">
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums leading-none">
                {activeScore}
                <span className="text-xs font-normal text-slate-500">/100</span>
              </div>
              <div className={`text-xs font-bold mt-1 ${meta.textClass}`}>{meta.labelPt}</div>
            </div>
          </div>

          {/* Mobile inline summary */}
          <div className="flex-1 sm:hidden space-y-1 text-xs">
            <div className="font-bold text-white">Medo &amp; Ganância</div>
            <div className="text-slate-400 font-mono tabular-nums">
              Oficial: <strong className="text-slate-200">{summary.officialScore}</strong>
              {summary.intradayDelta !== 0 && mode === 'REALTIME' && (
                <span>
                  {' '}
                  ({summary.intradayDelta > 0 ? `+${summary.intradayDelta}` : summary.intradayDelta} 24h)
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              Carteira 24h:{' '}
              <strong
                className={
                  summary.portfolioChange24hPct !== null && summary.portfolioChange24hPct >= 0
                    ? 'text-emerald-400 font-mono'
                    : 'text-rose-400 font-mono'
                }
              >
                {formatSignedPct(summary.portfolioChange24hPct)}
              </strong>
            </div>
          </div>
        </div>

        {/* Coluna 2: Termômetro Linear + Métricas + Leitura DCA */}
        <div className="lg:col-span-6 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-white tracking-tight">
                  Termômetro de Medo e Ganância
                </h2>
                <span className="text-[11px] text-slate-400 tabular-nums hidden sm:inline">
                  {isLiveConnected ? 'Ao vivo via Binance + Alternative.me' : `Atualizado ${fetchedTimeLabel}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{meta.dcaAdvice}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div
                role="group"
                aria-label="Modo de leitura do termômetro"
                className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800"
              >
                <button
                  type="button"
                  onClick={() => setMode('REALTIME')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                    mode === 'REALTIME'
                      ? 'bg-[#D91E2A] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tempo Real
                </button>
                <button
                  type="button"
                  onClick={() => setMode('OFFICIAL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                    mode === 'OFFICIAL'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Oficial
                </button>
              </div>

              <button
                type="button"
                onClick={onRefresh}
                title="Atualizar índice e pulso 24h"
                aria-label="Atualizar Termômetro de Medo e Ganância"
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={onToggleOpen}
                title="Ocultar termômetro para deixar a tela mais compacta"
                aria-label="Ocultar Termômetro de Medo e Ganância"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Ocultar</span>
              </button>
            </div>
          </div>

          {/* Barra térmica linear 0 -> 100 */}
          <div className="space-y-1">
            <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-[#e11d2e] via-[#eab308] to-[#10b981] opacity-90">
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none transition-transform duration-300 motion-reduce:transition-none"
                style={{ transform: `translateX(${activeScore}%)` }}
              >
                <div className="w-3.5 h-3.5 -ml-[7px] -mt-[2px] rounded-full bg-white border-2 border-slate-950 shadow-md" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>Medo Extremo</span>
              <span className="hidden sm:inline">Medo</span>
              <span>Neutro</span>
              <span className="hidden sm:inline">Ganância</span>
              <span>Ganância Extrema</span>
            </div>
          </div>

          {/* Metadados limpos em linha (zero pílulas) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t border-slate-800/70 text-[11px] text-slate-400 tabular-nums">
            <span>
              Oficial:{' '}
              <strong className="font-mono text-slate-200">
                {summary.officialScore} ({summary.officialLabel})
              </strong>
            </span>
            {mode === 'REALTIME' && summary.intradayDelta !== 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Pulso 24h:{' '}
                  <strong
                    className={`font-mono ${
                      summary.intradayDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {summary.intradayDelta > 0 ? `+${summary.intradayDelta}` : summary.intradayDelta} pts
                  </strong>
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>
              BTC 24h:{' '}
              <strong
                className={`font-mono ${
                  (summary.btcChange24hPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatSignedPct(summary.btcChange24hPct)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Carteira 24h:{' '}
              <strong
                className={`font-mono ${
                  (summary.portfolioChange24hPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatSignedPct(summary.portfolioChange24hPct)}
              </strong>
            </span>
          </div>
        </div>

        {/* Coluna 3: Comparativo Histórico & Tendência 7 Dias */}
        <div className="lg:col-span-3 lg:border-l lg:border-slate-800/80 lg:pl-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
            <div>
              <div className="text-[11px] text-slate-500">Ontem</div>
              <div className="font-mono font-bold text-slate-200 flex items-center gap-1">
                <span>{summary.yesterdayScore ?? '--'}</span>
                {yesterdayDiff !== null && yesterdayDiff !== 0 && (
                  <span
                    className={`inline-flex items-center text-[10px] ${
                      yesterdayDiff > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {yesterdayDiff > 0 ? (
                      <TrendingUp className="w-3 h-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                    )}
                    {yesterdayDiff > 0 ? `+${yesterdayDiff}` : yesterdayDiff}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">7 Dias Atrás</div>
              <div className="font-mono font-bold text-slate-200 flex items-center gap-1">
                <span>{summary.weekAgoScore ?? '--'}</span>
                {weekDiff !== null && weekDiff !== 0 && (
                  <span
                    className={`inline-flex items-center text-[10px] ${
                      weekDiff > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {weekDiff > 0 ? `+${weekDiff}` : weekDiff}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mini gráfico de barras dos últimos dias */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 tabular-nums">
              <span>Histórico (7d)</span>
              <span>Próx. oficial: {formatCountdown(remainingSec)}</span>
            </div>
            <div className="flex items-end gap-1 h-9">
              {summary.history.map((pt, idx) => {
                const ptMeta = classifySentimentScore(pt.value);
                const heightPct = Math.max(16, pt.value);
                const isLast = idx === summary.history.length - 1;
                return (
                  <div
                    key={`${pt.timestampSec}_${idx}`}
                    title={`${pt.dateLabel}: ${pt.value} (${pt.classificationPt})`}
                    className="flex-1 flex flex-col items-center justify-end h-full group"
                  >
                    <div
                      className={`w-full rounded-t-sm transition-opacity ${
                        isLast ? 'opacity-100 ring-1 ring-white/50' : 'opacity-75 group-hover:opacity-100'
                      }`}
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: ptMeta.colorHex
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
