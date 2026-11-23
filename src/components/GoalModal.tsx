import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CryptoGoal, CurrencyMode } from '../types';
import { DEFAULT_PLAN_MONTHS, SUPPORTED_CRYPTOS, getFutureMonthLabel } from '../constants';
import { convertFromUSD, convertToUSD, formatCryptoQty, formatMoney } from '../utils/calculations';

export interface GoalFormPayload {
  existingId: string | null;
  selectedAsset: string;
  customSymbol: string;
  customName: string;
  customPriceUSD: number;
  initialBalance: number;
  targetAmount: number;
  monthsCount: number;
  retirementTargetPriceUSD: number;
}

interface GoalModalProps {
  isOpen: boolean;
  editingGoal: CryptoGoal | null;
  preselectSymbol: string | null;
  currency: CurrencyMode;
  fxRate: number;
  pricesUSD: Record<string, number>;
  onClose: () => void;
  onSave: (payload: GoalFormPayload) => void;
}

function parseDecimalInput(raw: string): number {
  const parsed = parseFloat(raw.replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  editingGoal,
  preselectSymbol,
  currency,
  fxRate,
  pricesUSD,
  onClose,
  onSave
}) => {
  const [selectedAsset, setSelectedAsset] = useState('SOL');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('1');
  const [initialBalance, setInitialBalance] = useState('0');
  const [targetAmount, setTargetAmount] = useState('100');
  const [monthsCount, setMonthsCount] = useState(String(DEFAULT_PLAN_MONTHS));
  const [retirementPrice, setRetirementPrice] = useState('30');

  const initializedSessionRef = useRef<string | null>(null);
  const latestPropsRef = useRef({ editingGoal, preselectSymbol, currency, fxRate, pricesUSD });
  latestPropsRef.current = { editingGoal, preselectSymbol, currency, fxRate, pricesUSD };

  useEffect(() => {
    if (!isOpen) {
      initializedSessionRef.current = null;
      return;
    }

    const sessionKey = `${editingGoal?.id ?? 'NEW'}::${preselectSymbol ?? ''}`;
    if (initializedSessionRef.current === sessionKey) {
      return;
    }
    initializedSessionRef.current = sessionKey;

    const {
      editingGoal: goalToEdit,
      preselectSymbol: initialSym,
      currency: curr,
      fxRate: fx,
      pricesUSD: prices
    } = latestPropsRef.current;

    if (goalToEdit) {
      const isSupported = SUPPORTED_CRYPTOS.some((c) => c.symbol === goalToEdit.symbol);
      if (isSupported) {
        setSelectedAsset(goalToEdit.symbol);
      } else {
        setSelectedAsset('CUSTOM');
        setCustomSymbol(goalToEdit.symbol);
        setCustomName(goalToEdit.name);
        setCustomPrice(String(prices[goalToEdit.symbol] || 1));
      }
      setInitialBalance(String(goalToEdit.initialBalance));
      setTargetAmount(String(goalToEdit.targetAmount));
      setMonthsCount(String(goalToEdit.monthsCount));
      setRetirementPrice(
        String(Number(convertFromUSD(goalToEdit.retirementTargetPriceUSD, curr, fx).toFixed(2)))
      );
    } else {
      const sym = initialSym || 'SOL';
      setSelectedAsset(sym);
      setCustomSymbol('');
      setCustomName('');
      setCustomPrice('1');
      setInitialBalance('0');
      setTargetAmount('100');
      setMonthsCount(String(DEFAULT_PLAN_MONTHS));
      const pUSD = Number(prices[sym]) || 10;
      setRetirementPrice(String(Number(convertFromUSD(pUSD * 3, curr, fx).toFixed(2))));
    }
  }, [isOpen, editingGoal?.id, preselectSymbol]);

  if (!isOpen) return null;

  const handleAssetChange = (val: string) => {
    setSelectedAsset(val);
    if (val !== 'CUSTOM') {
      const pUSD = Number(pricesUSD[val]) || 10;
      setRetirementPrice(String(Number(convertFromUSD(pUSD * 3, currency, fxRate).toFixed(2))));
    }
  };

  const currLabel = currency === 'BRL' ? 'R$' : 'USDT';
  const initBalNum = Math.max(0, parseDecimalInput(initialBalance));
  const targetNum = Math.max(0, parseDecimalInput(targetAmount));
  const monthsNum = Math.max(1, parseInt(monthsCount, 10) || 12);
  const retPriceDisplay = Math.max(0, parseDecimalInput(retirementPrice));

  const previewSym = selectedAsset === 'CUSTOM' ? customSymbol.trim().toUpperCase() || 'CRIPTO' : selectedAsset;
  const toBuy = Math.max(0, targetNum - initBalNum);
  const perMonth = toBuy / monthsNum;
  const liveUSD =
    selectedAsset === 'CUSTOM'
      ? parseDecimalInput(customPrice) || Number(pricesUSD[previewSym]) || 0
      : Number(pricesUSD[previewSym]) || 0;
  const monthlyCostUSD = perMonth * liveUSD;
  const retTotalUSD = targetNum * convertToUSD(retPriceDisplay, currency, fxRate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      existingId: editingGoal ? editingGoal.id : null,
      selectedAsset,
      customSymbol: customSymbol.trim().toUpperCase(),
      customName: customName.trim(),
      customPriceUSD: parseDecimalInput(customPrice) || 1,
      initialBalance: initBalNum,
      targetAmount: Math.max(0.000001, targetNum || 100),
      monthsCount: Math.min(120, Math.max(1, monthsNum)),
      retirementTargetPriceUSD: convertToUSD(retPriceDisplay, currency, fxRate)
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-extrabold text-white">
            {editingGoal ? `Editar Meta: ${editingGoal.name}` : 'Nova Meta de Acumulação (DCA)'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Criptomoeda</label>
            <select
              value={selectedAsset}
              onChange={(e) => handleAssetChange(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {SUPPORTED_CRYPTOS.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.name} ({c.symbol})
                </option>
              ))}
              <option value="CUSTOM">+ Adicionar Outra Cripto Personalizada</option>
            </select>
          </div>

          {selectedAsset === 'CUSTOM' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Ticker (Ex: ADA)</label>
                <input
                  type="text"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  placeholder="ADA"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Cardano"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Preço Manual (USDT)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="0.85"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Saldo que Já Tenho</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="Ex: 200"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Meta Final de Moedas</label>
              <input
                type="number"
                step="any"
                min="0.000001"
                required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="Ex: 10000"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Prazo de Acumulação (Meses)</label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={monthsCount}
                onChange={(e) => setMonthsCount(e.target.value)}
                placeholder="Ex: 13"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Preço-Alvo Aposentadoria ({currLabel})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={retirementPrice}
                onChange={(e) => setRetirementPrice(e.target.value)}
                placeholder="Ex: 5.00"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-slate-300 space-y-1 tabular-nums">
            <div className="font-bold text-emerald-300">Resumo Automático do Plano:</div>
            <div>
              · Período:{' '}
              <strong>
                {getFutureMonthLabel(0)} → {getFutureMonthLabel(Math.max(0, monthsNum - 1))}
              </strong>{' '}
              ({monthsNum} {monthsNum === 1 ? 'mês' : 'meses'}).
            </div>
            <div>
              · Você precisa comprar <strong>{formatCryptoQty(toBuy, previewSym)}</strong> ={' '}
              <strong>{formatCryptoQty(perMonth, previewSym)}/mês</strong>.
            </div>
            {liveUSD > 0 && (
              <div>
                · Custo mensal estimado hoje: <strong>{formatMoney(monthlyCostUSD, currency, fxRate, 2)}/mês</strong>.
              </div>
            )}
            <div>
              · Patrimônio projetado na aposentadoria: <strong>{formatMoney(retTotalUSD, currency, fxRate, 2)}</strong>.
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-extrabold text-slate-950 transition-colors"
            >
              Salvar Meta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
