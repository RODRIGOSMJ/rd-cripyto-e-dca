import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X
} from 'lucide-react';
import { AppState } from '../types';
import {
  buildPortfolioReportSnapshot,
  fetchAiPortfolioReport,
  GenerateAiReportResult
} from '../services/aiReportService';
import { downloadAiPortfolioPDF } from '../utils/pdfReport';
import { formatBRL, formatUSDT } from '../utils/calculations';
import { CryptoLogo } from './CryptoLogo';

interface AiReportModalProps {
  isOpen: boolean;
  state: AppState;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AiReportModal: React.FC<AiReportModalProps> = ({
  isOpen,
  state,
  onClose,
  onNotify
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateAiReportResult | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const runGeneration = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAiPortfolioReport(state);
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar relatório com IA.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }
    if (!result && !loading) {
      void runGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    if (!result) return;
    setExportingPdf(true);
    const ok = downloadAiPortfolioPDF(result.snapshot, result.report, result.generatedAt);
    setExportingPdf(false);
    if (ok) {
      onNotify('Relatório completo em PDF baixado com sucesso!', 'success');
    } else {
      onNotify('Não foi possível gerar o arquivo PDF.', 'error');
    }
  };

  const handleDownloadDataOnlyPDF = () => {
    setExportingPdf(true);
    const snapshot = buildPortfolioReportSnapshot(state);
    const ok = downloadAiPortfolioPDF(snapshot, null, new Date().toISOString());
    setExportingPdf(false);
    if (ok) {
      onNotify('PDF completo com todos os dados da carteira baixado!', 'success');
    } else {
      onNotify('Não foi possível gerar o arquivo PDF.', 'error');
    }
  };

  const score = result ? Math.max(0, Math.min(100, result.report.healthScore)) : 0;
  const scoreColor =
    score >= 75 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15' :
    score >= 50 ? 'text-amber-300 border-amber-500/40 bg-amber-500/15' :
    'text-rose-300 border-rose-500/40 bg-rose-500/15';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-report-modal-title"
    >
      <div className="bg-[#120b0e] border border-red-950/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl shadow-red-950/60">
        <div className="h-[3px] w-full spfc-tricolor-stripe shrink-0" aria-hidden="true" />

        {/* Cabeçalho fixo */}
        <div className="px-5 py-3.5 border-b border-red-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[#160a0e]">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl spfc-gradient-btn ring-1 ring-white/20 flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 id="ai-report-modal-title" className="text-sm sm:text-base font-extrabold text-white">
                Relatório Completo de Inteligência Artificial
              </h2>
              <p className="text-[11px] text-slate-400">
                Análise integral da carteira DCA, cotações ao vivo, câmbio e aposentadoria · Pronto para PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {result && !loading && (
              <>
                <button
                  type="button"
                  onClick={() => void runGeneration()}
                  title="Gerar nova análise atualizada"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reanalisar</span>
                </button>
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg spfc-gradient-btn text-white text-xs font-extrabold shadow-md shadow-red-950/50 border border-white/15 transition-all disabled:opacity-60"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{exportingPdf ? 'Gerando PDF...' : 'Salvar em PDF'}</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar relatório"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl spfc-gradient-btn flex items-center justify-center shadow-lg shadow-red-950/60">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
              <div className="text-sm font-bold text-white">Analisando toda a sua carteira com IA...</div>
              <p className="text-xs text-slate-400 max-w-md">
                Consolidando suas metas cripto, histórico mensal DCA, preços em tempo real, câmbio USDT/BRL e metas de aposentadoria para montar o relatório completo.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="p-5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="text-sm font-bold text-white">Não foi possível gerar a análise da IA agora</div>
              <p className="text-xs text-rose-200 max-w-md mx-auto leading-relaxed">{error}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void runGeneration()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl spfc-gradient-btn text-white text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar IA Novamente</span>
                </button>
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={handleDownloadDataOnlyPDF}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Baixar PDF dos Dados (sem IA)</span>
                </button>
              </div>
            </div>
          )}

          {!loading && !error && result && (
            <>
              {/* Score + Headline */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#23090f] via-[#150b0e] to-[#110a0d] border border-red-500/35 flex flex-col sm:flex-row sm:items-center gap-4">
                <div
                  className={`px-4 py-2.5 rounded-xl border text-center shrink-0 min-w-[96px] ${scoreColor}`}
                >
                  <div className="text-2xl font-extrabold font-mono tabular-nums leading-none">
                    {score}
                    <span className="text-xs opacity-70">/100</span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider mt-1">
                    {result.report.healthLabel}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-red-300 uppercase tracking-wider">
                    Diagnóstico Executivo · {new Date(result.generatedAt).toLocaleString('pt-BR')}
                  </div>
                  <h3 className="text-base font-extrabold text-white leading-snug">
                    {result.report.headline}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                    1 USDT = R$ {result.snapshot.usdtBrlRate.toFixed(4).replace('.', ',')} ·{' '}
                    Patrimônio: {formatUSDT(result.snapshot.totals.totalPortfolioUSD, 2)} (
                    {formatBRL(result.snapshot.totals.totalPortfolioBRL, 2)}) ·{' '}
                    Alvo: {formatUSDT(result.snapshot.retirementGoalUSD, 0)}
                  </div>
                </div>
              </div>

              {/* Resumo Executivo */}
              <section className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#ff4d5a]" />
                  <span>Resumo Executivo</span>
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {result.report.executiveSummary}
                </p>
              </section>

              {/* Fluxo Mensal & Aposentadoria lado a lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <section className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                    Fluxo Mensal &amp; Câmbio USDT/BRL
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {result.report.cashflowAndFxAnalysis}
                  </p>
                </section>

                <section className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/25 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    <span>Diagnóstico de Aposentadoria ({result.snapshot.cycleMultiplier.toFixed(1)}x)</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {result.report.retirementAnalysis}
                  </p>
                </section>
              </div>

              {/* Pontos Fortes & Riscos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <section className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Pontos Fortes</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-200">
                    {result.report.strengths.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Riscos &amp; Alertas</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-200">
                    {result.report.risks.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* Análise por Criptomoeda */}
              {result.report.assetInsights.length > 0 && (
                <section className="space-y-2.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                    Parecer Estratégico por Criptomoeda
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {result.report.assetInsights.map((asset, idx) => (
                      <div
                        key={`${asset.symbol}-${idx}`}
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CryptoLogo symbol={asset.symbol} size={20} />
                            <span className="text-xs font-extrabold text-white">{asset.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{asset.symbol}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/80 border border-red-500/30 text-red-200">
                            {asset.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{asset.commentary}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Plano de Ação */}
              <section className="p-4 rounded-xl bg-slate-950/80 border border-red-900/40 space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Plano de Ação Priorizado
                </h4>
                <ol className="space-y-2 text-xs text-slate-200">
                  {result.report.actionPlan.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-md spfc-gradient-btn text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/80 pt-3">
                {result.report.disclaimer}
              </p>
            </>
          )}
        </div>

        {/* Rodapé fixo com CTA PDF */}
        {result && !loading && (
          <div className="px-5 py-3 border-t border-red-950/60 bg-[#160a0e] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-slate-400">
              O PDF inclui todas as tabelas de metas, cronograma mês a mês, conversor e a análise completa da IA.
            </span>
            <button
              type="button"
              disabled={exportingPdf}
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl spfc-gradient-btn text-white text-xs font-extrabold shadow-md shadow-red-950/50 border border-white/15"
            >
              <FileDown className="w-4 h-4" />
              <span>{exportingPdf ? 'Gerando PDF...' : 'Baixar Relatório Completo em PDF'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
