export type CurrencyMode = 'USDT' | 'HYBRID' | 'BRL';
export type MainTab = 'DCA' | 'ALLOCATION' | 'CONVERTER' | 'CHARTS';
export type ConverterDirection = 'BRL_TO_USDT' | 'USDT_TO_BRL';

export interface CryptoAsset {
  symbol: string;
  name: string;
  binancePair: string;
  fallbackPair: string | null;
  coingeckoId: string;
  color: string;
  fallbackUSD: number;
}

export interface MonthlyPurchaseEntry {
  id: string;
  qty: number;
  pricePaidUSD: number;
  fxRateBRL: number;
  dateISO: string;
}

export interface MonthlyRecord {
  month: number;
  label: string;
  boughtQty: number;
  pricePaidUSD: number;
  fxRateBRL: number;
  entries?: MonthlyPurchaseEntry[];
}

export interface CryptoGoal {
  id: string;
  symbol: string;
  name: string;
  binancePair: string;
  fallbackPair: string | null;
  coingeckoId: string;
  color: string;
  initialBalance: number;
  targetAmount: number;
  monthsCount: number;
  retirementTargetPriceUSD: number;
  monthlyRecords: MonthlyRecord[];
}

export interface ConverterState {
  direction: ConverterDirection;
  amountBRL: number;
  amountUSDT: number;
  exchangeFeePct: number;
  pixSpreadPct: number;
  networkFeeUSDT: number;
  targetSymbol: string;
  targetGoalId: string;
  targetMonthIndex: number;
}

export interface AppState {
  currency: CurrencyMode;
  mainTab: MainTab;
  selectedGoalId: string;
  usdtBrlRate: number;
  manualFxOverride: boolean;
  manualUsdtBrlRate: number;
  retirementGoalUSD: number;
  cycleMultiplier: number;
  pricesUSD: Record<string, number>;
  lastPriceUpdate: string | null;
  priceSource: string;
  isLiveConnected: boolean;
  converter: ConverterState;
  goals: CryptoGoal[];
}

export interface ScheduleRow {
  index: number;
  month: number;
  label: string;
  plannedQty: number;
  plannedCumQty: number;
  boughtQty: number;
  remainingMonthQty: number;
  isPartial: boolean;
  isCompleted: boolean;
  entries: MonthlyPurchaseEntry[];
  entriesCount: number;
  pricePaidUSD: number;
  fxRateBRL: number;
  monthCostUSD: number;
  monthCostBRL: number;
  cumCoins: number;
  cumBoughtDCA: number;
  cumInvestedUSD: number;
  cumInvestedBRL: number;
  cumAvgPriceUSD: number;
  cumAvgPriceBRL: number;
  estimatedMonthCostAtLivePriceUSD: number;
  estimatedRemainingMonthCostUSD: number;
}

export interface GoalMetrics {
  currentPriceUSD: number;
  initialBalance: number;
  targetAmount: number;
  monthsCount: number;
  totalToBuy: number;
  baseMonthlyTargetQty: number;
  dynamicMonthlyQty: number;
  totalBoughtDCA: number;
  totalAccumulatedCoins: number;
  remainingCoinsToBuy: number;
  remainingMonths: number;
  monthsCompleted: number;
  monthsPartial: number;
  totalInvestedUSD: number;
  totalInvestedHistoricalBRL: number;
  estimatedMonthlyCostUSD: number;
  estimatedDynamicMonthlyCostUSD: number;
  estimatedRemainingTotalCostUSD: number;
  avgBuyPriceUSD: number;
  avgBuyPriceBRL: number;
  dcaCurrentValueUSD: number;
  dcaPnlUSD: number;
  dcaPnlPct: number;
  totalPositionValueUSD: number;
  progressPct: number;
  retirementPriceUSD: number;
  ownedAtRetirementPriceUSD: number;
  projectedRetirementTotalUSD: number;
  schedule: ScheduleRow[];
}

export interface ConverterResults {
  spotFx: number;
  grossBRL: number;
  netUSDT: number;
  totalFeesBRL: number;
  totalFeesUSDT: number;
  effectiveFxRate: number;
  targetPriceUSD: number;
  purchasableCryptoQty: number;
}

export interface MonthlyPortfolioBudgetItem {
  goalId: string;
  symbol: string;
  name: string;
  color: string;
  currentPriceUSD: number;
  plannedQty: number;
  boughtQty: number;
  remainingQty: number;
  plannedCostUSD: number;
  remainingCostUSD: number;
  spentUSD: number;
  isCompleted: boolean;
}

export interface MonthlyPortfolioBudget {
  monthIndex: number;
  monthNumber: number;
  monthLabel: string;
  maxMonths: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
  totalPlannedUSD: number;
  totalRemainingToBuyUSD: number;
  totalAlreadySpentUSD: number;
  items: MonthlyPortfolioBudgetItem[];
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
