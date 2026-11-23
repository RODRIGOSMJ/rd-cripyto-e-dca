import { CryptoAsset, CryptoGoal } from './types';

export const STORAGE_KEY = 'rg_crypto_dca_retirement_v3';

export const SUPPORTED_CRYPTOS: CryptoAsset[] = [
  { symbol: 'POL',  name: 'Polygon (POL)', binancePair: 'POLUSDT',  fallbackPair: 'MATICUSDT', coingeckoId: 'polygon-ecosystem-token', color: '#8b5cf6', fallbackUSD: 0.42 },
  { symbol: 'BNB',  name: 'BNB',           binancePair: 'BNBUSDT',  fallbackPair: null,        coingeckoId: 'binancecoin',             color: '#f59e0b', fallbackUSD: 645.00 },
  { symbol: 'BTC',  name: 'Bitcoin',       binancePair: 'BTCUSDT',  fallbackPair: null,        coingeckoId: 'bitcoin',                 color: '#f97316', fallbackUSD: 96500.00 },
  { symbol: 'ETH',  name: 'Ethereum',      binancePair: 'ETHUSDT',  fallbackPair: null,        coingeckoId: 'ethereum',                color: '#3b82f6', fallbackUSD: 3420.00 },
  { symbol: 'SOL',  name: 'Solana',        binancePair: 'SOLUSDT',  fallbackPair: null,        coingeckoId: 'solana',                  color: '#14b8a6', fallbackUSD: 235.00 },
  { symbol: 'XRP',  name: 'Ripple (XRP)',  binancePair: 'XRPUSDT',  fallbackPair: null,        coingeckoId: 'ripple',                  color: '#38bdf8', fallbackUSD: 1.45 },
  { symbol: 'DOGE', name: 'Dogecoin',      binancePair: 'DOGEUSDT', fallbackPair: null,        coingeckoId: 'dogecoin',                color: '#eab308', fallbackUSD: 0.38 },
  { symbol: 'ALGO', name: 'Algorand',      binancePair: 'ALGOUSDT', fallbackPair: null,        coingeckoId: 'algorand',                color: '#10b981', fallbackUSD: 0.32 }
];

export const CUSTOM_PALETTE = ['#ec4899', '#14b8a6', '#6366f1', '#f43f5e', '#84cc16'];

export function buildInitialPricesMap(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of SUPPORTED_CRYPTOS) {
    map[c.symbol] = c.fallbackUSD;
  }
  return map;
}

export const DEFAULT_PLAN_MONTHS = 13;

export function getFutureMonthLabel(offsetMonths: number): string {
  const now = new Date();
  const baseYear = now.getFullYear();
  // Início padrão em Dezembro do ano atual (mês 11 em base 0), evitando estouro de dia
  const date = new Date(baseYear, 11 + offsetMonths, 1);
  const monthsPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${monthsPt[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
}

export function migrateGoalStartToDecember(
  goal: CryptoGoal,
  defaultFx: number = 5.85
): { goal: CryptoGoal; changed: boolean } {
  const firstLabel = String(goal.monthlyRecords?.[0]?.label || '');
  if (!firstLabel.startsWith('Nov/')) {
    return { goal, changed: false };
  }

  const nextMonthsCount = goal.monthsCount === 12 ? DEFAULT_PLAN_MONTHS : goal.monthsCount;
  const migratedRecords = Array.from({ length: nextMonthsCount }, (_, idx) => {
    const existing = goal.monthlyRecords[idx];
    return {
      month: idx + 1,
      label: getFutureMonthLabel(idx),
      boughtQty: Number(existing?.boughtQty) || 0,
      pricePaidUSD: Number(existing?.pricePaidUSD) || 0,
      fxRateBRL: Number(existing?.fxRateBRL) > 0 ? Number(existing.fxRateBRL) : defaultFx,
      ...(Array.isArray(existing?.entries) && existing.entries.length > 0
        ? { entries: existing.entries }
        : {})
    };
  });

  return {
    changed: true,
    goal: {
      ...goal,
      monthsCount: nextMonthsCount,
      monthlyRecords: migratedRecords
    }
  };
}

export function getDefaultGoals(fxRate: number = 5.85): CryptoGoal[] {
  return [
    {
      id: 'POL',
      symbol: 'POL',
      name: 'Polygon (POL)',
      binancePair: 'POLUSDT',
      fallbackPair: 'MATICUSDT',
      coingeckoId: 'polygon-ecosystem-token',
      color: '#8b5cf6',
      initialBalance: 200,
      targetAmount: 10000,
      monthsCount: DEFAULT_PLAN_MONTHS,
      retirementTargetPriceUSD: 5.00,
      monthlyRecords: Array.from({ length: DEFAULT_PLAN_MONTHS }, (_, idx) => ({
        month: idx + 1,
        label: getFutureMonthLabel(idx),
        boughtQty: 0,
        pricePaidUSD: 0,
        fxRateBRL: fxRate
      }))
    },
    {
      id: 'BNB',
      symbol: 'BNB',
      name: 'BNB',
      binancePair: 'BNBUSDT',
      fallbackPair: null,
      coingeckoId: 'binancecoin',
      color: '#f59e0b',
      initialBalance: 1.5,
      targetAmount: 15,
      monthsCount: DEFAULT_PLAN_MONTHS,
      retirementTargetPriceUSD: 1800.00,
      monthlyRecords: Array.from({ length: DEFAULT_PLAN_MONTHS }, (_, idx) => ({
        month: idx + 1,
        label: getFutureMonthLabel(idx),
        boughtQty: 0,
        pricePaidUSD: 0,
        fxRateBRL: fxRate
      }))
    }
  ];
}
