import { CryptoGoal } from '../types';
import { SUPPORTED_CRYPTOS } from '../constants';

interface BinanceTicker {
  symbol?: string;
  price?: string;
}

export interface PriceSyncResult {
  success: boolean;
  source: string;
  pricesUSD: Record<string, number>;
  usdtBrlRate: number;
}

async function fetchWithTimeout<T>(url: string, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function applyBinanceTickerList(
  tickers: BinanceTicker[],
  goals: CryptoGoal[],
  currentPrices: Record<string, number>,
  currentFx: number
): { updatedCount: number; pricesUSD: Record<string, number>; usdtBrlRate: number } {
  const nextPrices = { ...currentPrices };
  let nextFx = currentFx;

  if (!Array.isArray(tickers)) {
    return { updatedCount: 0, pricesUSD: nextPrices, usdtBrlRate: nextFx };
  }

  const map: Record<string, number> = {};
  for (const item of tickers) {
    if (item && item.symbol && item.price) {
      const p = parseFloat(item.price);
      if (!Number.isNaN(p) && p > 0) {
        map[item.symbol] = p;
      }
    }
  }

  if (map['USDTBRL'] && map['USDTBRL'] > 0) {
    nextFx = map['USDTBRL'];
  }

  const allAssets: Array<{ symbol: string; binancePair: string; fallbackPair: string | null }> = SUPPORTED_CRYPTOS.map((c) => ({
    symbol: c.symbol,
    binancePair: c.binancePair,
    fallbackPair: c.fallbackPair
  }));

  for (const g of goals) {
    if (!allAssets.some((a) => a.symbol === g.symbol)) {
      allAssets.push({
        symbol: g.symbol,
        binancePair: g.binancePair || `${g.symbol}USDT`,
        fallbackPair: g.fallbackPair || null
      });
    }
  }

  let updatedCount = 0;
  for (const asset of allAssets) {
    let p = map[asset.binancePair];
    if ((!p || Number.isNaN(p)) && asset.fallbackPair) {
      p = map[asset.fallbackPair];
    }
    if (p && !Number.isNaN(p) && p > 0) {
      nextPrices[asset.symbol] = p;
      updatedCount++;
    }
  }

  return { updatedCount, pricesUSD: nextPrices, usdtBrlRate: nextFx };
}

export async function syncLivePrices(
  goals: CryptoGoal[],
  currentPrices: Record<string, number>,
  currentFx: number
): Promise<PriceSyncResult> {
  // Tentativa 1: Binance Principal
  try {
    const data = await fetchWithTimeout<BinanceTicker[]>('https://api.binance.com/api/v3/ticker/price', 4000);
    const res = applyBinanceTickerList(data, goals, currentPrices, currentFx);
    if (res.updatedCount > 0) {
      return {
        success: true,
        source: 'Binance',
        pricesUSD: res.pricesUSD,
        usdtBrlRate: res.usdtBrlRate
      };
    }
  } catch {
    // Segue para fallback 2
  }

  // Tentativa 2: Binance Vision Data Mirror
  try {
    const data = await fetchWithTimeout<BinanceTicker[]>('https://data-api.binance.vision/api/v3/ticker/price', 4000);
    const res = applyBinanceTickerList(data, goals, currentPrices, currentFx);
    if (res.updatedCount > 0) {
      return {
        success: true,
        source: 'Binance Data',
        pricesUSD: res.pricesUSD,
        usdtBrlRate: res.usdtBrlRate
      };
    }
  } catch {
    // Segue para fallback 3
  }

  // Tentativa 3: CoinGecko Simple Price
  try {
    const ids = SUPPORTED_CRYPTOS.map((c) => c.coingeckoId).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd,brl`;
    const data = await fetchWithTimeout<Record<string, { usd?: number; brl?: number }>>(url, 4500);

    if (data && typeof data === 'object') {
      const nextPrices = { ...currentPrices };
      let nextFx = currentFx;
      let updated = false;

      for (const c of SUPPORTED_CRYPTOS) {
        const entry = data[c.coingeckoId];
        if (entry && Number(entry.usd) > 0) {
          nextPrices[c.symbol] = Number(entry.usd);
          if (Number(entry.brl) > 0) {
            nextFx = Number(entry.brl) / Number(entry.usd);
          }
          updated = true;
        }
      }

      if (updated) {
        return {
          success: true,
          source: 'CoinGecko',
          pricesUSD: nextPrices,
          usdtBrlRate: nextFx
        };
      }
    }
  } catch {
    // Mantém preços locais de referência
  }

  return {
    success: false,
    source: 'Modo Offline / Referência',
    pricesUSD: currentPrices,
    usdtBrlRate: currentFx
  };
}
