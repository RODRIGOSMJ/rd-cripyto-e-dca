import { AppState } from '../types';
import {
  DEFAULT_PLAN_MONTHS,
  STORAGE_KEY,
  buildInitialPricesMap,
  getDefaultGoals,
  getFutureMonthLabel,
  migrateGoalStartToDecember
} from '../constants';

const memoryStorage: Record<string, string> = {};

export const SafeStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
    }
  },
  setItem(key: string, value: string): void {
    memoryStorage[key] = String(value);
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Fallback silencioso para memória em iframes restritos
    }
  },
  removeItem(key: string): void {
    delete memoryStorage[key];
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignora erro de sandbox
    }
  }
};

export function createInitialAppState(): AppState {
  const defaultGoals = getDefaultGoals(5.85);
  return {
    currency: 'USDT',
    mainTab: 'DCA',
    selectedGoalId: defaultGoals[0].id,
    usdtBrlRate: 5.85,
    manualFxOverride: false,
    manualUsdtBrlRate: 5.85,
    retirementGoalUSD: 100000,
    cycleMultiplier: 1.0,
    pricesUSD: buildInitialPricesMap(),
    lastPriceUpdate: null,
    priceSource: 'Referência Inicial',
    isLiveConnected: false,
    converter: {
      direction: 'BRL_TO_USDT',
      amountBRL: 1000,
      amountUSDT: 200,
      exchangeFeePct: 0.1,
      pixSpreadPct: 0.0,
      networkFeeUSDT: 0.0,
      targetSymbol: 'POL',
      targetGoalId: 'POL',
      targetMonthIndex: 0
    },
    goals: defaultGoals
  };
}

export function normalizeLoadedState(parsed: Partial<AppState> | null | undefined): AppState {
  const base = createInitialAppState();
  if (!parsed || !Array.isArray(parsed.goals) || parsed.goals.length === 0) {
    return base;
  }

  const currency = parsed.currency && ['USDT', 'HYBRID', 'BRL'].includes(parsed.currency)
    ? parsed.currency
    : 'USDT';
  const mainTab = parsed.mainTab && ['DCA', 'ALLOCATION', 'CONVERTER', 'CHARTS'].includes(parsed.mainTab)
    ? parsed.mainTab
    : 'DCA';
  const usdtBrlRate = Number(parsed.usdtBrlRate) > 0 ? Number(parsed.usdtBrlRate) : 5.85;
  const manualFxOverride = Boolean(parsed.manualFxOverride);
  const manualUsdtBrlRate = Number(parsed.manualUsdtBrlRate) > 0 ? Number(parsed.manualUsdtBrlRate) : usdtBrlRate;
  const retirementGoalUSD =
    parsed.retirementGoalUSD !== undefined && Number(parsed.retirementGoalUSD) >= 0
      ? Number(parsed.retirementGoalUSD)
      : 100000;
  const cycleMultiplier = Number(parsed.cycleMultiplier) >= 1 ? Number(parsed.cycleMultiplier) : 1.0;

  const pricesUSD = parsed.pricesUSD && typeof parsed.pricesUSD === 'object'
    ? { ...buildInitialPricesMap(), ...parsed.pricesUSD }
    : base.pricesUSD;

  const converter = parsed.converter && typeof parsed.converter === 'object'
    ? { ...base.converter, ...parsed.converter }
    : base.converter;

  const goals = parsed.goals.map((g) => {
    const mCount = Math.min(120, Math.max(1, parseInt(String(g.monthsCount), 10) || DEFAULT_PLAN_MONTHS));
    const recs = Array.isArray(g.monthlyRecords) ? g.monthlyRecords : [];
    const normalizedRecs = Array.from({ length: mCount }, (_, idx) => {
      const r = recs[idx];
      const fallbackFx = Number(r?.fxRateBRL) > 0 ? Number(r?.fxRateBRL) : usdtBrlRate;
      const rawEntries = Array.isArray(r?.entries) ? r.entries : [];
      const entries = rawEntries
        .filter((e) => e && Number(e.qty) > 0)
        .slice(0, 50)
        .map((e, eIdx) => ({
          id: String(e.id || `lot_${idx + 1}_${eIdx}`),
          qty: Math.max(0, Number(e.qty) || 0),
          pricePaidUSD: Math.max(0, Number(e.pricePaidUSD) || 0),
          fxRateBRL: Number(e.fxRateBRL) > 0 ? Number(e.fxRateBRL) : fallbackFx,
          dateISO: typeof e.dateISO === 'string' && e.dateISO ? e.dateISO : new Date().toISOString()
        }));

      return {
        month: idx + 1,
        label: r?.label || getFutureMonthLabel(idx),
        boughtQty: Number(r?.boughtQty) || 0,
        pricePaidUSD: Number(r?.pricePaidUSD) || 0,
        fxRateBRL: fallbackFx,
        ...(entries.length > 0 ? { entries } : {})
      };
    });

    const symbol = String(g.symbol || 'POL').toUpperCase();
    const baseGoal = {
      id: String(g.id || `${symbol}_${Date.now()}`),
      symbol,
      name: String(g.name || symbol || 'Cripto'),
      binancePair: String(g.binancePair || `${symbol}USDT`),
      fallbackPair: g.fallbackPair || null,
      coingeckoId: g.coingeckoId || symbol.toLowerCase(),
      color: g.color || '#10b981',
      initialBalance: Math.max(0, Number(g.initialBalance) || 0),
      targetAmount: Math.max(0.000001, Number(g.targetAmount) || 100),
      monthsCount: mCount,
      retirementTargetPriceUSD: Math.max(0, Number(g.retirementTargetPriceUSD) || 0),
      monthlyRecords: normalizedRecs
    };

    return migrateGoalStartToDecember(baseGoal, usdtBrlRate).goal;
  });

  const selectedGoalId = goals.some((g) => g.id === parsed.selectedGoalId)
    ? (parsed.selectedGoalId as string)
    : goals[0].id;

  return {
    ...base,
    currency,
    mainTab,
    selectedGoalId,
    usdtBrlRate,
    manualFxOverride,
    manualUsdtBrlRate,
    retirementGoalUSD,
    cycleMultiplier,
    pricesUSD,
    converter,
    goals
  };
}

export function loadState(): AppState {
  try {
    const raw = SafeStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return normalizeLoadedState(parsed);
    }
  } catch (err) {
    console.warn('Resetando estado corrompido para padrão seguro:', err);
  }

  const initial = createInitialAppState();
  saveState(initial);
  return initial;
}

export function saveState(state: AppState): void {
  try {
    const payload = {
      currency: state.currency,
      mainTab: state.mainTab,
      selectedGoalId: state.selectedGoalId,
      usdtBrlRate: state.usdtBrlRate,
      manualFxOverride: state.manualFxOverride,
      manualUsdtBrlRate: state.manualUsdtBrlRate,
      retirementGoalUSD: state.retirementGoalUSD,
      cycleMultiplier: state.cycleMultiplier,
      pricesUSD: state.pricesUSD,
      converter: state.converter,
      goals: state.goals
    };
    SafeStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Aviso ao persistir estado:', err);
  }
}
