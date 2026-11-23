import {
  AppState,
  ConverterResults,
  ConverterState,
  CryptoGoal,
  CurrencyMode,
  GoalMetrics,
  MonthlyPortfolioBudget,
  MonthlyPortfolioBudgetItem,
  ScheduleRow
} from '../types';
import { getFutureMonthLabel } from '../constants';

export function getEffectiveUsdtBrlRate(state: Pick<AppState, 'manualFxOverride' | 'manualUsdtBrlRate' | 'usdtBrlRate'>): number {
  if (state.manualFxOverride && Number(state.manualUsdtBrlRate) > 0) {
    return Number(state.manualUsdtBrlRate);
  }
  return Number(state.usdtBrlRate) > 0 ? Number(state.usdtBrlRate) : 5.85;
}

export function getMultiplier(currency: CurrencyMode, fxRate: number): number {
  return currency === 'BRL' ? fxRate : 1;
}

export function convertFromUSD(amountUSD: number, currency: CurrencyMode, fxRate: number): number {
  const val = Number(amountUSD);
  if (Number.isNaN(val)) return 0;
  return val * getMultiplier(currency, fxRate);
}

export function convertToUSD(amountDisplay: number, currency: CurrencyMode, fxRate: number): number {
  const val = Number(amountDisplay);
  const mult = getMultiplier(currency, fxRate);
  if (Number.isNaN(val) || mult <= 0) return 0;
  return val / mult;
}

export function formatUSDT(amountUSDT: number, forceDecimals: number | null = null): string {
  const val = Number(amountUSDT) || 0;
  let decimals = 2;
  if (forceDecimals !== null) {
    decimals = forceDecimals;
  } else if (Math.abs(val) > 0 && Math.abs(val) < 1) {
    decimals = 4;
  } else if (Math.abs(val) >= 1 && Math.abs(val) < 10) {
    decimals = 3;
  }
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val);
  return `$${formatted} USDT`;
}

export function formatBRL(amountBRL: number, forceDecimals: number | null = null): string {
  const val = Number(amountBRL) || 0;
  let decimals = 2;
  if (forceDecimals !== null) {
    decimals = forceDecimals;
  } else if (Math.abs(val) > 0 && Math.abs(val) < 1) {
    decimals = 4;
  } else if (Math.abs(val) >= 1 && Math.abs(val) < 10) {
    decimals = 3;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val);
}

export function formatMoney(
  amountUSD: number,
  currency: CurrencyMode,
  fxRate: number,
  forceDecimals: number | null = null
): string {
  const valUSD = Number(amountUSD) || 0;
  if (currency === 'BRL') {
    return formatBRL(valUSD * fxRate, forceDecimals);
  }
  return formatUSDT(valUSD, forceDecimals);
}

export function formatCryptoQty(qty: number, symbol = ''): string {
  const num = Number(qty) || 0;
  const decimals = num % 1 === 0 ? 0 : Math.abs(num) < 10 ? 4 : 2;
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function calculateGoalMetrics(
  goal: CryptoGoal,
  pricesUSD: Record<string, number>,
  currentFx: number
): GoalMetrics {
  const currentPriceUSD = Number(pricesUSD[goal.symbol]) || 0;
  const initialBalance = Math.max(0, Number(goal.initialBalance) || 0);
  const targetAmount = Math.max(0.000001, Number(goal.targetAmount) || 0);
  const monthsCount = Math.max(1, parseInt(String(goal.monthsCount), 10) || 12);

  const totalToBuy = Math.max(0, targetAmount - initialBalance);
  const baseMonthlyTargetQty = totalToBuy / monthsCount;

  let monthsCompleted = 0;
  let runningCoins = initialBalance;
  let runningBoughtDCA = 0;
  let runningInvestedUSD = 0;
  let runningInvestedBRL = 0;

  const schedule: ScheduleRow[] = [];

  for (let i = 0; i < monthsCount; i++) {
    const rec = goal.monthlyRecords[i] || {
      month: i + 1,
      label: getFutureMonthLabel(i),
      boughtQty: 0,
      pricePaidUSD: 0,
      fxRateBRL: currentFx
    };

    const bought = Math.max(0, Number(rec.boughtQty) || 0);
    const pricePaidUSD = Math.max(0, Number(rec.pricePaidUSD) || 0);
    const fxRateBRL = Number(rec.fxRateBRL) > 0 ? Number(rec.fxRateBRL) : currentFx;

    const monthCostUSD = bought * pricePaidUSD;
    const monthCostBRL = monthCostUSD * fxRateBRL;

    if (bought > 0) monthsCompleted++;

    runningBoughtDCA += bought;
    runningCoins += bought;
    runningInvestedUSD += monthCostUSD;
    runningInvestedBRL += monthCostBRL;

    const cumAvgPriceUSD = runningBoughtDCA > 0 ? runningInvestedUSD / runningBoughtDCA : 0;
    const cumAvgPriceBRL = runningBoughtDCA > 0 ? runningInvestedBRL / runningBoughtDCA : 0;

    schedule.push({
      index: i,
      month: i + 1,
      label: rec.label || getFutureMonthLabel(i),
      plannedQty: baseMonthlyTargetQty,
      plannedCumQty: initialBalance + baseMonthlyTargetQty * (i + 1),
      boughtQty: bought,
      pricePaidUSD,
      fxRateBRL,
      monthCostUSD,
      monthCostBRL,
      cumCoins: runningCoins,
      cumBoughtDCA: runningBoughtDCA,
      cumInvestedUSD: runningInvestedUSD,
      cumInvestedBRL: runningInvestedBRL,
      cumAvgPriceUSD,
      cumAvgPriceBRL,
      estimatedMonthCostAtLivePriceUSD: baseMonthlyTargetQty * currentPriceUSD
    });
  }

  const totalBoughtDCA = runningBoughtDCA;
  const totalInvestedUSD = runningInvestedUSD;
  const totalInvestedHistoricalBRL = runningInvestedBRL;

  const totalAccumulatedCoins = initialBalance + totalBoughtDCA;
  const remainingCoinsToBuy = Math.max(0, targetAmount - totalAccumulatedCoins);
  const remainingMonths = Math.max(0, monthsCount - monthsCompleted);
  const dynamicMonthlyQty = remainingMonths > 0 ? remainingCoinsToBuy / remainingMonths : remainingCoinsToBuy;

  const estimatedMonthlyCostUSD = baseMonthlyTargetQty * currentPriceUSD;
  const estimatedDynamicMonthlyCostUSD = dynamicMonthlyQty * currentPriceUSD;
  const estimatedRemainingTotalCostUSD = remainingCoinsToBuy * currentPriceUSD;

  const avgBuyPriceUSD = totalBoughtDCA > 0 ? totalInvestedUSD / totalBoughtDCA : 0;
  const avgBuyPriceBRL = totalBoughtDCA > 0 ? totalInvestedHistoricalBRL / totalBoughtDCA : 0;

  const dcaCurrentValueUSD = totalBoughtDCA * currentPriceUSD;
  const dcaPnlUSD = totalBoughtDCA > 0 ? dcaCurrentValueUSD - totalInvestedUSD : 0;
  const dcaPnlPct = totalInvestedUSD > 0 ? (dcaPnlUSD / totalInvestedUSD) * 100 : 0;

  const totalPositionValueUSD = totalAccumulatedCoins * currentPriceUSD;
  const progressPct = targetAmount > 0 ? Math.min(100, (totalAccumulatedCoins / targetAmount) * 100) : 0;

  const retirementPriceUSD = Math.max(0, Number(goal.retirementTargetPriceUSD) || 0);
  const ownedAtRetirementPriceUSD = totalAccumulatedCoins * retirementPriceUSD;
  const projectedRetirementTotalUSD = targetAmount * retirementPriceUSD;

  return {
    currentPriceUSD,
    initialBalance,
    targetAmount,
    monthsCount,
    totalToBuy,
    baseMonthlyTargetQty,
    dynamicMonthlyQty,
    totalBoughtDCA,
    totalAccumulatedCoins,
    remainingCoinsToBuy,
    remainingMonths,
    monthsCompleted,
    totalInvestedUSD,
    totalInvestedHistoricalBRL,
    estimatedMonthlyCostUSD,
    estimatedDynamicMonthlyCostUSD,
    estimatedRemainingTotalCostUSD,
    avgBuyPriceUSD,
    avgBuyPriceBRL,
    dcaCurrentValueUSD,
    dcaPnlUSD,
    dcaPnlPct,
    totalPositionValueUSD,
    progressPct,
    retirementPriceUSD,
    ownedAtRetirementPriceUSD,
    projectedRetirementTotalUSD,
    schedule
  };
}

export function calculateConverterResults(
  c: ConverterState,
  spotFx: number,
  pricesUSD: Record<string, number>
): ConverterResults {
  const spreadMult = 1 + Math.max(0, Number(c.pixSpreadPct) || 0) / 100;
  const feeRate = Math.min(0.99, Math.max(0, Number(c.exchangeFeePct) || 0) / 100);
  const netFeeUSDT = Math.max(0, Number(c.networkFeeUSDT) || 0);

  let grossBRL = 0;
  let netUSDT = 0;
  let totalFeesBRL = 0;
  let totalFeesUSDT = 0;
  let effectiveFxRate = spotFx;

  if (c.direction === 'BRL_TO_USDT') {
    grossBRL = Math.max(0, Number(c.amountBRL) || 0);
    const rateWithSpread = spotFx * spreadMult;
    const grossUSDT = rateWithSpread > 0 ? grossBRL / rateWithSpread : 0;
    const tradeFeeUSDT = grossUSDT * feeRate;
    netUSDT = Math.max(0, grossUSDT - tradeFeeUSDT - netFeeUSDT);

    const pureSpotUSDT = spotFx > 0 ? grossBRL / spotFx : 0;
    totalFeesUSDT = Math.max(0, pureSpotUSDT - netUSDT);
    totalFeesBRL = totalFeesUSDT * spotFx;
    effectiveFxRate = netUSDT > 0 ? grossBRL / netUSDT : rateWithSpread;
  } else {
    netUSDT = Math.max(0, Number(c.amountUSDT) || 0);
    const grossUSDT = (netUSDT + netFeeUSDT) / Math.max(0.01, 1 - feeRate);
    const rateWithSpread = spotFx * spreadMult;
    grossBRL = grossUSDT * rateWithSpread;

    const pureSpotBRL = netUSDT * spotFx;
    totalFeesBRL = Math.max(0, grossBRL - pureSpotBRL);
    totalFeesUSDT = spotFx > 0 ? totalFeesBRL / spotFx : 0;
    effectiveFxRate = netUSDT > 0 ? grossBRL / netUSDT : rateWithSpread;
  }

  const targetPriceUSD = Number(pricesUSD[c.targetSymbol]) || 0;
  const purchasableCryptoQty = targetPriceUSD > 0 ? netUSDT / targetPriceUSD : 0;

  return {
    spotFx,
    grossBRL,
    netUSDT,
    totalFeesBRL,
    totalFeesUSDT,
    effectiveFxRate,
    targetPriceUSD,
    purchasableCryptoQty
  };
}

export function getMaxGoalMonths(goals: CryptoGoal[]): number {
  if (!goals.length) return 1;
  return goals.reduce((max, g) => Math.max(max, Math.max(1, parseInt(String(g.monthsCount), 10) || 12)), 1);
}

export function getNextActiveMonthIndex(
  goals: CryptoGoal[],
  pricesUSD: Record<string, number>,
  currentFx: number
): number {
  const maxMonths = getMaxGoalMonths(goals);
  const metricsByGoal = goals.map((g) => calculateGoalMetrics(g, pricesUSD, currentFx));

  for (let mIdx = 0; mIdx < maxMonths; mIdx++) {
    const hasPending = metricsByGoal.some((gm) => {
      const row = gm.schedule[mIdx];
      return row && row.plannedQty > 0 && row.boughtQty < row.plannedQty * 0.9999;
    });
    if (hasPending) return mIdx;
  }

  return 0;
}

export function calculateMonthlyPortfolioBudget(
  goals: CryptoGoal[],
  pricesUSD: Record<string, number>,
  currentFx: number,
  monthIndex: number
): MonthlyPortfolioBudget {
  const maxMonths = getMaxGoalMonths(goals);
  const safeIndex = Math.min(maxMonths - 1, Math.max(0, Math.floor(monthIndex) || 0));

  const items: MonthlyPortfolioBudgetItem[] = [];
  let totalPlannedUSD = 0;
  let totalRemainingToBuyUSD = 0;
  let totalAlreadySpentUSD = 0;
  let completedGoalsCount = 0;
  let monthLabel = getFutureMonthLabel(safeIndex);

  for (const goal of goals) {
    const m = calculateGoalMetrics(goal, pricesUSD, currentFx);
    const row = m.schedule[safeIndex];
    if (!row) continue;

    if (items.length === 0 && row.label) {
      monthLabel = row.label;
    }

    const plannedQty = Math.max(0, row.plannedQty);
    const boughtQty = Math.max(0, row.boughtQty);
    const remainingQty = Math.max(0, plannedQty - boughtQty);
    const plannedCostUSD = plannedQty * m.currentPriceUSD;
    const remainingCostUSD = remainingQty * m.currentPriceUSD;
    const spentUSD = row.monthCostUSD;
    const isCompleted = plannedQty === 0 || boughtQty >= plannedQty * 0.9999;

    if (isCompleted) {
      completedGoalsCount++;
    }

    totalPlannedUSD += plannedCostUSD;
    totalRemainingToBuyUSD += remainingCostUSD;
    totalAlreadySpentUSD += spentUSD;

    items.push({
      goalId: goal.id,
      symbol: goal.symbol,
      name: goal.name,
      color: goal.color || '#10b981',
      currentPriceUSD: m.currentPriceUSD,
      plannedQty,
      boughtQty,
      remainingQty,
      plannedCostUSD,
      remainingCostUSD,
      spentUSD,
      isCompleted
    });
  }

  return {
    monthIndex: safeIndex,
    monthNumber: safeIndex + 1,
    monthLabel,
    maxMonths,
    activeGoalsCount: items.length,
    completedGoalsCount,
    totalPlannedUSD,
    totalRemainingToBuyUSD,
    totalAlreadySpentUSD,
    items
  };
}
