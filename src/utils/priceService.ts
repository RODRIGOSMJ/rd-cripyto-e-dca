import { CryptoGoal } from '../types';
import { SUPPORTED_CRYPTOS } from '../constants';

interface BinanceTicker {
  symbol?: string;
  price?: string;
}

interface AwesomeApiUsdBrl {
  USDBRL?: {
    bid?: string;
    ask?: string;
  };
}

export interface PriceSyncResult {
  success: boolean;
  source: string;
  pricesUSD: Record<string, number>;
  usdtBrlRate: number;
  fxLive: boolean;
}

// Mapeamento de tickers populares para CoinGecko caso o usuário adicione criptos customizadas
const EXTRA_COINGECKO_IDS: Record<string, string> = {
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  LTC: 'litecoin',
  DOT: 'polkadot',
  TRX: 'tron',
  SUI: 'sui',
  XLM: 'stellar',
  HBAR: 'hedera-hashgraph',
  TON: 'the-open-network',
  SHIB: 'shiba-inu',
  UNI: 'uniswap',
  AAVE: 'aave',
  ARB: 'arbitrum',
  OP: 'optimism',
  NEAR: 'near',
  ATOM: 'cosmos',
  BCH: 'bitcoin-cash',
  ETC: 'ethereum-classic',
  PEPE: 'pepe',
  MATIC: 'polygon-ecosystem-token',
  RENDER: 'render-token',
  INJ: 'injective-protocol',
  APT: 'aptos',
  SEI: 'sei-network',
  BONK: 'bonk',
  FLOKI: 'floki',
  WIF: 'dogwifcoin',
  ICP: 'internet-computer',
  FIL: 'filecoin',
  VET: 'vechain',
  KAS: 'kaspa',
  FET: 'fetch-ai',
  GRT: 'the-graph'
};

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

function buildAssetList(goals: CryptoGoal[]) {
  const allAssets: Array<{
    symbol: string;
    binancePair: string;
    fallbackPair: string | null;
    coingeckoId: string;
  }> = SUPPORTED_CRYPTOS.map((c) => ({
    symbol: c.symbol,
    binancePair: c.binancePair,
    fallbackPair: c.fallbackPair,
    coingeckoId: c.coingeckoId
  }));

  for (const g of goals) {
    const sym = String(g.symbol || '').toUpperCase().trim();
    if (!sym) continue;
    if (!allAssets.some((a) => a.symbol === sym)) {
      allAssets.push({
        symbol: sym,
        binancePair: g.binancePair || `${sym}USDT`,
        fallbackPair: g.fallbackPair || (sym === 'POL' ? 'MATICUSDT' : null),
        coingeckoId: EXTRA_COINGECKO_IDS[sym] || g.coingeckoId || sym.toLowerCase()
      });
    }
  }

  return allAssets;
}

function applyBinanceTickerList(
  tickers: BinanceTicker[],
  goals: CryptoGoal[],
  currentPrices: Record<string, number>,
  currentFx: number
): { updatedCount: number; fxUpdated: boolean; pricesUSD: Record<string, number>; usdtBrlRate: number } {
  const nextPrices = { ...currentPrices };
  let nextFx = currentFx;
  let fxUpdated = false;

  if (!Array.isArray(tickers)) {
    return { updatedCount: 0, fxUpdated: false, pricesUSD: nextPrices, usdtBrlRate: nextFx };
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
    fxUpdated = true;
  }

  const allAssets = buildAssetList(goals);

  let updatedCount = 0;
  for (const asset of allAssets) {
    let p = map[asset.binancePair];
    if ((!p || Number.isNaN(p)) && asset.fallbackPair) {
      p = map[asset.fallbackPair];
    }
    if ((!p || Number.isNaN(p)) && map[`${asset.symbol}USDC`]) {
      p = map[`${asset.symbol}USDC`];
    }
    if ((!p || Number.isNaN(p)) && map[`${asset.symbol}FDUSD`]) {
      p = map[`${asset.symbol}FDUSD`];
    }
    if (p && !Number.isNaN(p) && p > 0) {
      nextPrices[asset.symbol] = p;
      updatedCount++;
    }
  }

  return { updatedCount, fxUpdated, pricesUSD: nextPrices, usdtBrlRate: nextFx };
}

/**
 * Busca cotação oficial do Dólar (USD/BRL) via AwesomeAPI ou CoinGecko Tether/BRL
 * como garantia independente caso o par USDTBRL não esteja disponível no feed primário.
 */
async function fetchLiveUsdBrlFallback(): Promise<number | null> {
  try {
    const fx = await fetchWithTimeout<AwesomeApiUsdBrl>(
      'https://economia.awesomeapi.com.br/json/last/USD-BRL',
      3500
    );
    const bid = parseFloat(String(fx?.USDBRL?.bid || ''));
    const ask = parseFloat(String(fx?.USDBRL?.ask || ''));
    if (!Number.isNaN(bid) && bid > 0) {
      return !Number.isNaN(ask) && ask > 0 ? (bid + ask) / 2 : bid;
    }
  } catch {
    // Segue para backup CoinGecko Tether/BRL
  }

  try {
    const cg = await fetchWithTimeout<{ tether?: { brl?: number } }>(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=brl',
      3500
    );
    const brl = Number(cg?.tether?.brl);
    if (brl > 0) return brl;
  } catch {
    // Ignora
  }

  return null;
}

export async function syncLivePrices(
  goals: CryptoGoal[],
  currentPrices: Record<string, number>,
  currentFx: number
): Promise<PriceSyncResult> {
  // Tentativa 1: Binance Vision Data API (global, sem bloqueio regional e CORS aberto)
  try {
    const data = await fetchWithTimeout<BinanceTicker[]>(
      'https://data-api.binance.vision/api/v3/ticker/price',
      4500
    );
    const res = applyBinanceTickerList(data, goals, currentPrices, currentFx);
    if (res.updatedCount > 0) {
      let fxRate = res.usdtBrlRate;
      let fxLive = res.fxUpdated;
      if (!fxLive) {
        const fallbackFx = await fetchLiveUsdBrlFallback();
        if (fallbackFx) {
          fxRate = fallbackFx;
          fxLive = true;
        }
      }
      return {
        success: true,
        source: 'Binance Tempo Real',
        pricesUSD: res.pricesUSD,
        usdtBrlRate: fxRate,
        fxLive
      };
    }
  } catch {
    // Segue para tentativa 2
  }

  // Tentativa 2: Binance Principal
  try {
    const data = await fetchWithTimeout<BinanceTicker[]>(
      'https://api.binance.com/api/v3/ticker/price',
      4000
    );
    const res = applyBinanceTickerList(data, goals, currentPrices, currentFx);
    if (res.updatedCount > 0) {
      let fxRate = res.usdtBrlRate;
      let fxLive = res.fxUpdated;
      if (!fxLive) {
        const fallbackFx = await fetchLiveUsdBrlFallback();
        if (fallbackFx) {
          fxRate = fallbackFx;
          fxLive = true;
        }
      }
      return {
        success: true,
        source: 'Binance',
        pricesUSD: res.pricesUSD,
        usdtBrlRate: fxRate,
        fxLive
      };
    }
  } catch {
    // Segue para tentativa 3
  }

  // Tentativa 3: CoinGecko (todas as suportadas + customizadas + Tether BRL)
  try {
    const allAssets = buildAssetList(goals);
    const idSet = new Set<string>(['tether', ...allAssets.map((a) => a.coingeckoId)]);
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      Array.from(idSet).join(',')
    )}&vs_currencies=usd,brl`;
    const data = await fetchWithTimeout<Record<string, { usd?: number; brl?: number }>>(url, 5000);

    if (data && typeof data === 'object') {
      const nextPrices = { ...currentPrices };
      let nextFx = currentFx;
      let fxLive = false;
      let updated = false;

      if (data.tether && Number(data.tether.brl) > 0) {
        nextFx = Number(data.tether.brl);
        fxLive = true;
      }

      for (const asset of allAssets) {
        const entry = data[asset.coingeckoId];
        if (entry && Number(entry.usd) > 0) {
          nextPrices[asset.symbol] = Number(entry.usd);
          if (!fxLive && Number(entry.brl) > 0) {
            nextFx = Number(entry.brl) / Number(entry.usd);
            fxLive = true;
          }
          updated = true;
        }
      }

      if (!fxLive) {
        const fallbackFx = await fetchLiveUsdBrlFallback();
        if (fallbackFx) {
          nextFx = fallbackFx;
          fxLive = true;
        }
      }

      if (updated) {
        return {
          success: true,
          source: 'CoinGecko Tempo Real',
          pricesUSD: nextPrices,
          usdtBrlRate: nextFx,
          fxLive
        };
      }
    }
  } catch {
    // Tenta pelo menos atualizar o Dólar se as criptos falharem
    const fallbackFx = await fetchLiveUsdBrlFallback();
    if (fallbackFx) {
      return {
        success: false,
        source: 'Dólar Ao Vivo / Cripto Local',
        pricesUSD: currentPrices,
        usdtBrlRate: fallbackFx,
        fxLive: true
      };
    }
  }

  return {
    success: false,
    source: 'Modo Offline / Referência',
    pricesUSD: currentPrices,
    usdtBrlRate: currentFx,
    fxLive: false
  };
}

export interface LiveStreamTick {
  priceUpdates: Record<string, number>;
  usdtBrlRate?: number;
}

/**
 * Conecta no WebSocket oficial da Binance Vision para atualizações reais
 * tick-a-tick (sub-segundo) de TODAS as criptomoedas + Dólar (USDT/BRL).
 */
export function subscribeLiveBinanceStream(
  goals: CryptoGoal[],
  handlers: {
    onTick: (tick: LiveStreamTick) => void;
    onStatusChange?: (connected: boolean) => void;
  }
): () => void {
  const allAssets = buildAssetList(goals);
  const pairToSymbol = new Map<string, string>();
  const streamNames = new Set<string>(['usdtbrl@miniTicker']);

  for (const asset of allAssets) {
    const mainPair = asset.binancePair.toUpperCase();
    pairToSymbol.set(mainPair, asset.symbol);
    streamNames.add(`${mainPair.toLowerCase()}@miniTicker`);

    if (asset.fallbackPair) {
      const fb = asset.fallbackPair.toUpperCase();
      if (!pairToSymbol.has(fb)) {
        pairToSymbol.set(fb, asset.symbol);
      }
      streamNames.add(`${fb.toLowerCase()}@miniTicker`);
    }
  }

  const streamsParam = Array.from(streamNames).join('/');
  const wsUrl = `wss://data-stream.binance.vision/stream?streams=${streamsParam}`;

  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  let pendingPrices: Record<string, number> = {};
  let pendingFx: number | undefined = undefined;

  const flushBufferedTicks = () => {
    flushTimer = null;
    if (closed) return;
    const hasPrices = Object.keys(pendingPrices).length > 0;
    if (!hasPrices && pendingFx === undefined) return;

    const tick: LiveStreamTick = {
      priceUpdates: pendingPrices,
      usdtBrlRate: pendingFx
    };
    pendingPrices = {};
    pendingFx = undefined;
    handlers.onTick(tick);
  };

  const scheduleFlush = () => {
    if (flushTimer || closed) return;
    // Agrupa ticks em lotes de 850ms para manter a UI instantânea e sem flicker
    flushTimer = setTimeout(flushBufferedTicks, 850);
  };

  const connect = () => {
    if (closed || typeof WebSocket === 'undefined') return;

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }

    ws.onopen = () => {
      if (!closed) {
        handlers.onStatusChange?.(true);
      }
    };

    ws.onmessage = (event) => {
      if (closed) return;
      try {
        const msg = JSON.parse(String(event.data || '')) as {
          data?: { s?: string; c?: string };
        };
        const tickerSymbol = String(msg?.data?.s || '').toUpperCase();
        const closePrice = parseFloat(String(msg?.data?.c || ''));
        if (!tickerSymbol || Number.isNaN(closePrice) || closePrice <= 0) return;

        if (tickerSymbol === 'USDTBRL') {
          pendingFx = closePrice;
          scheduleFlush();
          return;
        }

        const mappedAsset = pairToSymbol.get(tickerSymbol);
        if (mappedAsset) {
          pendingPrices[mappedAsset] = closePrice;
          scheduleFlush();
        }
      } catch {
        // Ignora frame malformado
      }
    };

    ws.onerror = () => {
      // onclose cuidará da reconexão silenciosa
    };

    ws.onclose = () => {
      if (closed) return;
      handlers.onStatusChange?.(false);
      reconnectTimer = setTimeout(connect, 4000);
    };
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (flushTimer) clearTimeout(flushTimer);
    if (ws) {
      try {
        ws.close();
      } catch {
        // Ignora
      }
      ws = null;
    }
  };
}
