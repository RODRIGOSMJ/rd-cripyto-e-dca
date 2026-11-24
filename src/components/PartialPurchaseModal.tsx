import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Clock, Coins, DollarSign, Plus, Trash2, X } from 'lucide-react';
import { CryptoGoal, CurrencyMode, ScheduleRow } from '../types';
import {
  convertFromUSD,
  formatBRL,
  formatCryptoQty,
  formatEditableNumber,
  formatMoney,
  formatUSDT,
  getNormalizedMonthEntries,
  parseFlexibleNumber
} from '../utils/calculations';
import { CryptoLogo } from './CryptoLogo';

interface PartialPurchaseModalProps {
  isOpen: boolean;
  goal: CryptoGoal;
  row: ScheduleRow | null;
  currentPriceUSD: number;
  currency: CurrencyMode;
  fxRate: number;
  onClose: () => void;
  onAddPartialPurchase: (goalId: string, monthIndex: number, qty: number, priceDisplay: number) => void;
  onRemovePartialPurchase: (goalId: string, monthIndex: number, entryId: string) => void;
}

type InputMode = 'QTY' | 'VALUE';

function formatEntryDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Hoje';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return 'Hoje';
  }
}

export const PartialPurchaseModal: React.FC<PartialPurchaseModalProps> = ({
  isOpen,
  goal,
  row,
  currentPriceUSD,
  currency,
  fxRate,
  onClose,
  onAddPartialPurchase,
  onRemovePartialPurchase
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('QTY');
  const [qtyStr, setQtyStr] = useState('');
  const [spentStr, setSpentStr] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [justAddedMsg, setJustAddedMsg] = useState<string | null>(null);

  const priceEditedByUserRef = useRef(false);
  const currSymbol = currency === 'BRL' ? 'R$' : 'USDT';
  const livePriceDisplay = convertFromUSD(currentPriceUSD, currency, fxRate);

  // Inicializa os campos somente ao abrir o modal ou trocar de mês/cripto
  useEffect(() => {
    if (!isOpen || !row) return;
    priceEditedByUserRef.current = false;
    setFormError(null);
    setJustAddedMsg(null);
    setInputMode('QTY');

    const suggestedQty = !row.isCompleted && row.remainingMonthQty > 1e-8 ? row.remainingMonthQty : row.plannedQty;
    setQtyStr(formatEditableNumber(suggestedQty));
    setSpentStr('');
    setPriceStr(formatEditableNumber(livePriceDisplay));
  }, [isOpen, row?.index, goal.id]);

  // Se a cotação ao vivo chegar depois da abertura (ou o usuário alternar moeda) e ainda não editou o preço, atualiza o campo de preço
  useEffect(() => {
    if (!isOpen || priceEditedByUserRef.current) return;
    if (livePriceDisplay > 0 && !priceStr) {
      setPriceStr(formatEditableNumber(livePriceDisplay));
    }
  }, [isOpen, livePriceDisplay, priceStr]);

  if (!isOpen || !row) return null;

  const rawRec = goal.monthlyRecords[row.index];
  const entries = rawRec ? getNormalizedMonthEntries(rawRec, fxRate) : row.entries;

  const parsedPriceDisplay = Math.max(0, parseFlexibleNumber(priceStr));
  const effectivePriceDisplay = parsedPriceDisplay > 0 ? parsedPriceDisplay : livePriceDisplay;
  const effectivePriceUSD =
    effectivePriceDisplay > 0
      ? currency === 'BRL'
        ? effectivePriceDisplay / fxRate
        : effectivePriceDisplay
      : currentPriceUSD;

  const parsedQtyInput = Math.max(0, parseFlexibleNumber(qtyStr));
  const parsedSpentInput = Math.max(0, parseFlexibleNumber(spentStr));

  // Quantidade efetiva a lançar (seja digitando direto em moedas ou em valor gasto)
  const effectiveQty =
    inputMode === 'QTY'
      ? parsedQtyInput
      : effectivePriceDisplay > 0
        ? parsedSpentInput / effectivePriceDisplay
        : 0;

  const previewLotUSD = effectiveQty * effectivePriceUSD;
  const previewLotBRL = previewLotUSD * fxRate;

  const hasRemaining = !row.isCompleted && row.remainingMonthQty > 1e-8;
  const monthProgressPct =
    row.plannedQty > 0 ? Math.min(100, (row.boughtQty / row.plannedQty) * 100) : row.boughtQty > 0 ? 100 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setJustAddedMsg(null);

    if (inputMode === 'VALUE') {
      if (parsedSpentInput <= 0) {
        setFormError(`Informe o valor gasto em ${currSymbol} maior que zero.`);
        return;
      }
      if (effectivePriceDisplay <= 0) {
        setFormError(`Informe o preço unitário pago em ${currSymbol} para calcular a quantidade.`);
        return;
      }
    }

    if (!Number.isFinite(effectiveQty) || effectiveQty <= 0) {
      setFormError(`Informe uma quantidade válida de ${goal.symbol} maior que zero.`);
      return;
    }

    const finalQty = Number(effectiveQty.toFixed(8));
    const finalPriceDisplay = effectivePriceDisplay > 0 ? effectivePriceDisplay : 0;

    onAddPartialPurchase(goal.id, row.index, finalQty, finalPriceDisplay);

    const remainingAfter = Math.max(0, row.plannedQty - (row.boughtQty + finalQty));
    setJustAddedMsg(
      remainingAfter > row.plannedQty * 0.0001
        ? `+${formatCryptoQty(finalQty, goal.symbol)} lançado! Faltam ${formatCryptoQty(remainingAfter, goal.symbol)} neste mês.`
        : `+${formatCryptoQty(finalQty, goal.symbol)} lançado! Meta do Mês ${row.month} concluída!`
    );

    // Limpa os campos de valor/quantidade para evitar lançamento duplicado acidental
    setQtyStr('');
    setSpentStr('');
  };

  const applyQuickQty = (fraction: number) => {
    setFormError(null);
    const baseQty = hasRemaining ? row.remainingMonthQty : row.plannedQty;
    const targetQty = baseQty * fraction;
    if (inputMode === 'QTY') {
      setQtyStr(formatEditableNumber(targetQty));
    } else {
      const targetValDisplay = targetQty * effectivePriceDisplay;
      setSpentStr(formatEditableNumber(targetValDisplay, 2));
    }
  };

  const handleSwitchMode = (nextMode: InputMode) => {
    setFormError(null);
    if (nextMode === inputMode) return;
    if (nextMode === 'VALUE') {
      const estDisplay = parsedQtyInput * effectivePriceDisplay;
      setSpentStr(estDisplay > 0 ? formatEditableNumber(estDisplay, 2) : '');
    } else {
      const estQty = effectivePriceDisplay > 0 ? parsedSpentInput / effectivePriceDisplay : 0;
      setQtyStr(estQty > 0 ? formatEditableNumber(estQty) : '');
    }
    setInputMode(nextMode);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#120b0e] border border-red-900/50 shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="px-4 py-3 border-b border-red-950/70 bg-gradient-to-r from-[#240910] via-[#150b0e] to-[#120b0e] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CryptoLogo symbol={goal.symbol} color={goal.color} size={30} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white truncate">
                  Lançamentos Parciais · Mês {row.month} ({row.label})
                </h3>
                {row.isCompleted ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Concluído
                  </span>
                ) : row.isPartial ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 shrink-0">
                    <Clock className="w-3 h-3" />
                    Parcial
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {goal.name} · Cotação atual:{' '}
                <strong className="font-mono text-emerald-400">
                  {formatMoney(currentPriceUSD, currency, fxRate)}
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de lançamentos parciais"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Resumo do Progresso no Mês */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800/90 p-3 space-y-2.5 tabular-nums">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-[10px] text-slate-500">Meta do Mês</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  {formatCryptoQty(row.plannedQty, goal.symbol)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Já Comprado</div>
                <div
                  className={`font-mono font-bold mt-0.5 ${
                    row.isCompleted ? 'text-emerald-400' : row.isPartial ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  {formatCryptoQty(row.boughtQty, goal.symbol)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Falta no Mês</div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {hasRemaining ? (
                    <span className="text-amber-300">{formatCryptoQty(row.remainingMonthQty, goal.symbol)}</span>
                  ) : (
                    <span className="text-emerald-400">0 {goal.symbol}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Barra de progresso do mês */}
            <div className="space-y-1">
              <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    row.isCompleted ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${monthProgressPct}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-400">
                  Progresso:{' '}
                  <strong className={row.isCompleted ? 'text-emerald-400' : 'text-amber-300'}>
                    {monthProgressPct.toFixed(1)}%
                  </strong>
                  {row.pricePaidUSD > 0 && (
                    <span className="text-slate-500">
                      {' '}
                      · PM do mês:{' '}
                      <strong className="font-mono text-slate-300">
                        {formatMoney(row.pricePaidUSD, currency, fxRate)}
                      </strong>
                    </span>
                  )}
                </span>
                {hasRemaining && (
                  <span className="font-mono text-sky-300">
                    Falta ≈ {formatUSDT(row.estimatedRemainingMonthCostUSD, 2)}{' '}
                    <span className="text-slate-500">
                      ({formatBRL(row.estimatedRemainingMonthCostUSD * fxRate, 2)})
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Formulário: Adicionar Novo Lote Parcial */}
          <form onSubmit={handleSubmit} noValidate className="rounded-xl bg-[#180d11] border border-red-900/40 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('QTY')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-bold transition-all ${
                    inputMode === 'QTY' ? 'spfc-gradient-btn text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Coins className="w-3 h-3" />
                  <span>Por Qtd ({goal.symbol})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('VALUE')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-bold transition-all ${
                    inputMode === 'VALUE' ? 'spfc-gradient-btn text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  <span>Por Valor ({currSymbol})</span>
                </button>
              </div>

              {/* Atalhos rápidos */}
              <div className="flex items-center gap-1">
                {hasRemaining && (
                  <button
                    type="button"
                    onClick={() => applyQuickQty(1)}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-bold text-amber-200 transition-colors"
                  >
                    Restante ({formatCryptoQty(row.remainingMonthQty)})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => applyQuickQty(0.5)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-200 transition-colors"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickQty(0.25)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-200 transition-colors"
                >
                  25%
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {inputMode === 'QTY' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Quantidade comprada agora ({goal.symbol})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={qtyStr}
                    onChange={(e) => {
                      setFormError(null);
                      setJustAddedMsg(null);
                      setQtyStr(e.target.value);
                    }}
                    placeholder={`Ex: ${formatEditableNumber(row.plannedQty * 0.5) || '200'}`}
                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 focus:border-[#E11D2E] px-2.5 text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Valor total gasto agora ({currSymbol})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={spentStr}
                    onChange={(e) => {
                      setFormError(null);
                      setJustAddedMsg(null);
                      setSpentStr(e.target.value);
                    }}
                    placeholder={currency === 'BRL' ? 'Ex: 250,00' : 'Ex: 50.00'}
                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 focus:border-[#E11D2E] px-2.5 text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Preço unitário pago ({currSymbol})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      priceEditedByUserRef.current = false;
                      setPriceStr(formatEditableNumber(livePriceDisplay));
                    }}
                    className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    Usar ao vivo
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceStr}
                  onChange={(e) => {
                    priceEditedByUserRef.current = true;
                    setFormError(null);
                    setPriceStr(e.target.value);
                  }}
                  placeholder={formatEditableNumber(livePriceDisplay) || '0.00'}
                  className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 focus:border-[#E11D2E] px-2.5 text-xs font-mono font-bold text-white focus:outline-none"
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 px-2.5 py-1.5 text-[11px] text-rose-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {justAddedMsg && (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1.5 text-[11px] text-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{justAddedMsg}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[11px] tabular-nums">
                {inputMode === 'VALUE' ? (
                  <>
                    <span className="text-slate-400">Vai lançar: </span>
                    <strong className="font-mono text-emerald-400">
                      {formatCryptoQty(effectiveQty, goal.symbol)}
                    </strong>
                    <span className="text-slate-500 font-mono"> ({formatUSDT(previewLotUSD, 2)})</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400">Valor deste lote: </span>
                    <strong className="font-mono text-emerald-400">{formatUSDT(previewLotUSD, 2)}</strong>
                    <span className="text-slate-500 font-mono"> (≈ {formatBRL(previewLotBRL, 2)})</span>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={effectiveQty <= 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg spfc-gradient-btn disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-red-950/50 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Adicionar Lançamento</span>
              </button>
            </div>
          </form>

          {/* Histórico de Lançamentos Parciais do Mês */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200">
                Compras Registradas no Mês {row.month} ({entries.length})
              </h4>
              {row.monthCostUSD > 0 && (
                <span className="text-[11px] font-mono text-emerald-400 font-bold tabular-nums">
                  Total pago: {formatMoney(row.monthCostUSD, currency, fxRate, 2)}
                </span>
              )}
            </div>

            {entries.length === 0 ? (
              <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 py-5 px-3 text-center text-xs text-slate-500">
                Nenhuma compra parcial lançada ainda neste mês. Adicione o primeiro lote acima!
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-950/70 border border-slate-800/90 overflow-hidden">
                {entries.map((entry, idx) => {
                  const lotUSD = entry.qty * entry.pricePaidUSD;
                  const lotBRL = lotUSD * entry.fxRateBRL;
                  return (
                    <div
                      key={entry.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
                            #{idx + 1}
                          </span>
                          <span className="font-mono font-bold text-white">
                            +{formatCryptoQty(entry.qty, goal.symbol)}
                          </span>
                          <span className="text-slate-500">@</span>
                          <span className="font-mono text-slate-300">
                            {formatMoney(entry.pricePaidUSD, currency, entry.fxRateBRL)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{formatEntryDate(entry.dateISO)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right font-mono">
                          <div className="text-xs font-bold text-emerald-400">
                            {currency === 'BRL' ? formatBRL(lotBRL, 2) : formatUSDT(lotUSD, 2)}
                          </div>
                          {currency !== 'BRL' && (
                            <div className="text-[10px] text-slate-500">{formatBRL(lotBRL, 2)}</div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setJustAddedMsg(null);
                            onRemovePartialPurchase(goal.id, row.index, entry.id);
                          }}
                          title="Remover este lançamento parcial"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
