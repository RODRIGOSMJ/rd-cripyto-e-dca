import { AppState } from '../types';
import {
  calculateConverterResults,
  calculateGoalMetrics,
  calculateMonthlyPortfolioBudget,
  getEffectiveUsdtBrlRate,
  getNextActiveMonthIndex
} from '../utils/calculations';

export interface AiAssetInsight {
  symbol: string;
  name: string;
  status: string;
  commentary: string;
}

export interface AiPortfolioReport {
  headline: string;
  healthScore: number;
  healthLabel: string;
  executiveSummary: string;
  cashflowAndFxAnalysis: string;
  retirementAnalysis: string;
  strengths: string[];
  risks: string[];
  assetInsights: AiAssetInsight[];
  actionPlan: string[];
  disclaimer: string;
}

export interface SnapshotMonthlyRow {
  month: number;
  label: string;
  plannedQty: number;
  boughtQty: number;
  pricePaidUSD: number;
  monthCostUSD: number;
  monthCostBRL: number;
  estimatedCostUSD: number;
}

export interface SnapshotGoalSummary {
  symbol: string;
  name: string;
  currentPriceUSD: number;
  initialBalance: number;
  totalBoughtDCA: number;
  totalAccumulatedCoins: number;
  targetAmount: number;
  remainingCoinsToBuy: number;
  progressPct: number;
  monthsCount: number;
  monthsCompleted: number;
  remainingMonths: number;
  baseMonthlyTargetQty: number;
  estimatedMonthlyCostUSD: number;
  estimatedRemainingTotalCostUSD: number;
  avgBuyPriceUSD: number;
  totalInvestedUSD: number;
  totalInvestedBRL: number;
  totalPositionValueUSD: number;
  pnlUSD: number;
  pnlPct: number;
  retirementTargetPriceUSD: number;
  ownedAtRetirementPriceUSD: number;
  projectedRetirementTotalUSD: number;
  schedule: SnapshotMonthlyRow[];
}

export interface PortfolioReportSnapshot {
  generatedAtISO: string;
  currencyMode: string;
  usdtBrlRate: number;
  manualFxOverride: boolean;
  priceSource: string;
  cycleMultiplier: number;
  retirementGoalUSD: number;
  totals: {
    goalsCount: number;
    totalPortfolioUSD: number;
    totalPortfolioBRL: number;
    totalInvestedUSD: number;
    totalInvestedBRL: number;
    totalRemainingToInvestUSD: number;
    totalPnlUSD: number;
    totalPnlPct: number;
    totalOwnedAtTargetUSD: number;
    totalPlannedAtTargetUSD: number;
    missingFromOwnedUSD: number;
    missingFromPlannedUSD: number;
    ownedCoveragePct: number;
    plannedCoveragePct: number;
  };
  nextMonthBudget: {
    monthNumber: number;
    monthLabel: string;
    totalPlannedUSD: number;
    totalPlannedBRL: number;
    totalRemainingToBuyUSD: number;
    completedGoalsCount: number;
    activeGoalsCount: number;
  };
  converter: {
    direction: string;
    grossBRL: number;
    netUSDT: number;
    exchangeFeePct: number;
    pixSpreadPct: number;
    networkFeeUSDT: number;
    effectiveFxRate: number;
    targetSymbol: string;
    purchasableCryptoQty: number;
  };
  goals: SnapshotGoalSummary[];
}

export function buildPortfolioReportSnapshot(state: AppState): PortfolioReportSnapshot {
  const fxRate = getEffectiveUsdtBrlRate(state);
  const multCycle = Math.max(1, Number(state.cycleMultiplier) || 1);
  const retirementGoalUSD = Math.max(0, Number(state.retirementGoalUSD) || 0);

  let totalPortfolioUSD = 0;
  let totalInvestedUSD = 0;
  let totalInvestedBRL = 0;
  let totalRemainingToInvestUSD = 0;
  let totalDcaValueUSD = 0;
  let totalOwnedAtTargetUSD = 0;
  let totalPlannedAtTargetUSD = 0;

  const goals: SnapshotGoalSummary[] = state.goals.map((g) => {
    const m = calculateGoalMetrics(g, state.pricesUSD, fxRate);
    totalPortfolioUSD += m.totalPositionValueUSD;
    totalInvestedUSD += m.totalInvestedUSD;
    totalInvestedBRL += m.totalInvestedHistoricalBRL;
    totalRemainingToInvestUSD += m.estimatedRemainingTotalCostUSD;
    totalDcaValueUSD += m.dcaCurrentValueUSD;
    totalOwnedAtTargetUSD += m.ownedAtRetirementPriceUSD * multCycle;
    totalPlannedAtTargetUSD += m.projectedRetirementTotalUSD * multCycle;

    const goalPnlUSD = m.dcaCurrentValueUSD - m.totalInvestedUSD;
    const goalPnlPct = m.totalInvestedUSD > 0 ? (goalPnlUSD / m.totalInvestedUSD) * 100 : 0;

    return {
      symbol: g.symbol,
      name: g.name,
      currentPriceUSD: Number(m.currentPriceUSD.toFixed(6)),
      initialBalance: g.initialBalance,
      totalBoughtDCA: Number(m.totalBoughtDCA.toFixed(6)),
      totalAccumulatedCoins: Number(m.totalAccumulatedCoins.toFixed(6)),
      targetAmount: g.targetAmount,
      remainingCoinsToBuy: Number(m.remainingCoinsToBuy.toFixed(6)),
      progressPct: Number(m.progressPct.toFixed(2)),
      monthsCount: g.monthsCount,
      monthsCompleted: m.monthsCompleted,
      remainingMonths: m.remainingMonths,
      baseMonthlyTargetQty: Number(m.baseMonthlyTargetQty.toFixed(4)),
      estimatedMonthlyCostUSD: Number(m.estimatedMonthlyCostUSD.toFixed(2)),
      estimatedRemainingTotalCostUSD: Number(m.estimatedRemainingTotalCostUSD.toFixed(2)),
      avgBuyPriceUSD: Number(m.avgBuyPriceUSD.toFixed(6)),
      totalInvestedUSD: Number(m.totalInvestedUSD.toFixed(2)),
      totalInvestedBRL: Number(m.totalInvestedHistoricalBRL.toFixed(2)),
      totalPositionValueUSD: Number(m.totalPositionValueUSD.toFixed(2)),
      pnlUSD: Number(goalPnlUSD.toFixed(2)),
      pnlPct: Number(goalPnlPct.toFixed(2)),
      retirementTargetPriceUSD: Number(g.retirementTargetPriceUSD.toFixed(4)),
      ownedAtRetirementPriceUSD: Number((m.ownedAtRetirementPriceUSD * multCycle).toFixed(2)),
      projectedRetirementTotalUSD: Number((m.projectedRetirementTotalUSD * multCycle).toFixed(2)),
      schedule: m.schedule.map((row) => ({
        month: row.month,
        label: row.label,
        plannedQty: Number(row.plannedQty.toFixed(4)),
        boughtQty: Number(row.boughtQty.toFixed(4)),
        pricePaidUSD: Number(row.pricePaidUSD.toFixed(6)),
        monthCostUSD: Number(row.monthCostUSD.toFixed(2)),
        monthCostBRL: Number(row.monthCostBRL.toFixed(2)),
        estimatedCostUSD: Number(row.estimatedMonthCostAtLivePriceUSD.toFixed(2))
      }))
    };
  });

  const totalPnlUSD = totalDcaValueUSD - totalInvestedUSD;
  const totalPnlPct = totalInvestedUSD > 0 ? (totalPnlUSD / totalInvestedUSD) * 100 : 0;

  const nextMonthIdx = getNextActiveMonthIndex(state.goals, state.pricesUSD, fxRate);
  const budget = calculateMonthlyPortfolioBudget(state.goals, state.pricesUSD, fxRate, nextMonthIdx);
  const convRes = calculateConverterResults(state.converter, fxRate, state.pricesUSD);

  const missingFromOwnedUSD = Math.max(0, retirementGoalUSD - totalOwnedAtTargetUSD);
  const missingFromPlannedUSD = Math.max(0, retirementGoalUSD - totalPlannedAtTargetUSD);

  return {
    generatedAtISO: new Date().toISOString(),
    currencyMode: state.currency,
    usdtBrlRate: Number(fxRate.toFixed(4)),
    manualFxOverride: state.manualFxOverride,
    priceSource: state.priceSource,
    cycleMultiplier: multCycle,
    retirementGoalUSD: Number(retirementGoalUSD.toFixed(2)),
    totals: {
      goalsCount: state.goals.length,
      totalPortfolioUSD: Number(totalPortfolioUSD.toFixed(2)),
      totalPortfolioBRL: Number((totalPortfolioUSD * fxRate).toFixed(2)),
      totalInvestedUSD: Number(totalInvestedUSD.toFixed(2)),
      totalInvestedBRL: Number(totalInvestedBRL.toFixed(2)),
      totalRemainingToInvestUSD: Number(totalRemainingToInvestUSD.toFixed(2)),
      totalPnlUSD: Number(totalPnlUSD.toFixed(2)),
      totalPnlPct: Number(totalPnlPct.toFixed(2)),
      totalOwnedAtTargetUSD: Number(totalOwnedAtTargetUSD.toFixed(2)),
      totalPlannedAtTargetUSD: Number(totalPlannedAtTargetUSD.toFixed(2)),
      missingFromOwnedUSD: Number(missingFromOwnedUSD.toFixed(2)),
      missingFromPlannedUSD: Number(missingFromPlannedUSD.toFixed(2)),
      ownedCoveragePct:
        retirementGoalUSD > 0 ? Number(((totalOwnedAtTargetUSD / retirementGoalUSD) * 100).toFixed(2)) : 0,
      plannedCoveragePct:
        retirementGoalUSD > 0 ? Number(((totalPlannedAtTargetUSD / retirementGoalUSD) * 100).toFixed(2)) : 0
    },
    nextMonthBudget: {
      monthNumber: budget.monthNumber,
      monthLabel: budget.monthLabel,
      totalPlannedUSD: Number(budget.totalPlannedUSD.toFixed(2)),
      totalPlannedBRL: Number((budget.totalPlannedUSD * fxRate).toFixed(2)),
      totalRemainingToBuyUSD: Number(budget.totalRemainingToBuyUSD.toFixed(2)),
      completedGoalsCount: budget.completedGoalsCount,
      activeGoalsCount: budget.activeGoalsCount
    },
    converter: {
      direction: state.converter.direction,
      grossBRL: Number(convRes.grossBRL.toFixed(2)),
      netUSDT: Number(convRes.netUSDT.toFixed(2)),
      exchangeFeePct: state.converter.exchangeFeePct,
      pixSpreadPct: state.converter.pixSpreadPct,
      networkFeeUSDT: state.converter.networkFeeUSDT,
      effectiveFxRate: Number(convRes.effectiveFxRate.toFixed(4)),
      targetSymbol: state.converter.targetSymbol,
      purchasableCryptoQty: Number(convRes.purchasableCryptoQty.toFixed(4))
    },
    goals
  };
}

export interface GenerateAiReportResult {
  generatedAt: string;
  snapshot: PortfolioReportSnapshot;
  report: AiPortfolioReport;
}

export async function fetchAiPortfolioReport(state: AppState): Promise<GenerateAiReportResult> {
  const snapshot = buildPortfolioReportSnapshot(state);

  // Envia payload resumido (sem tabela gigante de meses vazios para acelerar a IA, mantendo contagem de meses feitos)
  const compactForAi = {
    ...snapshot,
    goals: snapshot.goals.map((g) => ({
      ...g,
      completedMonthsSummary: g.schedule
        .filter((r) => r.boughtQty > 0)
        .map((r) => ({
          month: r.month,
          label: r.label,
          boughtQty: r.boughtQty,
          pricePaidUSD: r.pricePaidUSD,
          costUSD: r.monthCostUSD
        })),
      schedule: undefined
    }))
  };

  const response = await fetch('/api/ai-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot: compactForAi })
  });

  const data = (await response.json().catch(() => ({}))) as {
    generatedAt?: string;
    report?: AiPortfolioReport;
    error?: string;
  };

  if (!response.ok || !data.report) {
    throw new Error(data.error || 'Falha ao gerar o relatório de IA no servidor.');
  }

  return {
    generatedAt: data.generatedAt || new Date().toISOString(),
    snapshot,
    report: data.report
  };
}
