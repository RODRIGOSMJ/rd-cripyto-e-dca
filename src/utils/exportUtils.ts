import { AppState } from '../types';
import { calculateGoalMetrics, getEffectiveUsdtBrlRate } from './calculations';

export function downloadJSONBackup(state: AppState): boolean {
  try {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rg_crypto_dca_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export function downloadCSVReport(state: AppState): boolean {
  try {
    const fx = getEffectiveUsdtBrlRate(state);
    const rows: Array<Array<string | number>> = [
      [
        'Cripto',
        'Simbolo',
        'Mes',
        'Data',
        'Meta_Mensal',
        'Comprado',
        'Preco_Pago_USDT',
        'Cambio_BRL_USDT',
        'Investido_USDT',
        'Investido_BRL',
        'Preco_Medio_USDT',
        'Saldo_Acumulado'
      ]
    ];

    for (const g of state.goals) {
      const m = calculateGoalMetrics(g, state.pricesUSD, fx);
      for (const s of m.schedule) {
        rows.push([
          g.name,
          g.symbol,
          s.month,
          s.label,
          s.plannedQty.toFixed(8),
          s.boughtQty.toFixed(8),
          s.pricePaidUSD.toFixed(8),
          s.fxRateBRL.toFixed(4),
          s.monthCostUSD.toFixed(2),
          s.monthCostBRL.toFixed(2),
          s.cumAvgPriceUSD.toFixed(8),
          s.cumCoins.toFixed(8)
        ]);
      }
    }

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rg_crypto_dca_planilha_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
