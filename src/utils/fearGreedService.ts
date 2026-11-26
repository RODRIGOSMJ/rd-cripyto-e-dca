import { CryptoGoal } from '../types';
import { SUPPORTED_CRYPTOS } from '../constants';
import { calculateGoalMetrics } from './calculations';

export type SentimentZoneId =
  | 'EXTREME_FEAR'
  | 'FEAR'
  | 'NEUTRAL'
  | 'GREED'
  | 'EXTREME_GREED';

export interface FearGreedDayPoint {
  value: number;
  classificationPt: string;
  zoneId: SentimentZoneId;
  timestampSec: number;
  dateLabel: string;
}

export interface FearGreedApiPayload {
  source: string;
  fetchedAtISO: string;
  timeUntilUpdateSec: number;
  current: FearGreedDayPoint;
  yesterday: FearGreedDayPoint | null;
  weekAgo: FearGreedDayPoint | null;
  history: FearGreedDayPoint[];
}

export interface Ticker24hStats {
  symbol: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  lastPrice: number;
  priceChangePercent: number;
}

export interface RealtimeSentimentSummary {
  officialScore: number;
  officialLabel: string;
  officialZone: SentimentZoneId;
  realtimeScore: number;
  realtimeLabel: string;
  realtimeZone: SentimentZoneId;
  intradayDelta: number;
  yesterdayScore: number | null;
  weekAgoScore: number | null;
  btcChange24hPct: number | null;
  portfolioChange24hPct: number | null;
  portfolioDirectionAssets: number;
  timeUntilUpdateSec: number;
  fetchedAtISO: string;
  source: string;
  history: FearGreedDayPoint[];
}

interface RawAlternativeEntry {
  value?: string;
  value_classification?: string;
  timestamp?: string;
  time_until_update?: string;
}

interface RawBinance24h {
  symbol?: string;
  openPrice?: string;
  highPrice?: string;
  lowPrice?: string;
  lastPrice?: string;
  priceChangePercent?: string;
}

export function classifySentimentScore(score: number): {
  zoneId: SentimentZoneId;
  labelPt: string;
  colorHex: string;
  textClass: string;
  dcaAdvice: string;
} {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped <= 24) {
    return {
      zoneId: 'EXTREME_FEAR',
      labelPt: 'Medo Extremo',
      colorHex: '#e11d2e',
      textClass: 'text-rose-400',
      dcaAdvice:
        'Pessimismo máximo no mercado. Costuma oferecer preços mais descontados para manter os aportes mensais do plano DCA com disciplina.'
    };
  }
  if (clamped <= 44) {
    return {
      zoneId: 'FEAR',
      labelPt: 'Medo',
      colorHex: '#f97316',
      textClass: 'text-orange-400',
      dcaAdvice:
        'Sentimento defensivo. Bom momento para executar suas compras programadas sem antecipar metas de longo prazo.'
    };
  }
  if (clamped <= 55) {
    return {
      zoneId: 'NEUTRAL',
      labelPt: 'Neutro',
      colorHex: '#eab308',
      textClass: 'text-amber-300',
      dcaAdvice:
        'Mercado equilibrado entre compradores e vendedores. Siga o cronograma padrão do mês mantendo reserva em dólar.'
    };
  }
  if (clamped <= 74) {
    return {
      zoneId: 'GREED',
      labelPt: 'Ganância',
      colorHex: '#84cc16',
      textClass: 'text-lime-400',
      dcaAdvice:
        'Apetite por risco elevado. Evite compras por impulso acima do planejado e respeite o orçamento mensal.'
    };
  }
  return {
    zoneId: 'EXTREME_GREED',
    labelPt: 'Ganância Extrema',
    colorHex: '#10b981',
    textClass: 'text-emerald-400',
    dcaAdvice:
      'Euforia forte no mercado. Redobre a cautela com aportes extras e mantenha os alvos de venda definidos na aba Simulador.'
  };
}

function parseEntry(raw: RawAlternativeEntry): FearGreedDayPoint | null {
  const value = Math.max(0, Math.min(100, Math.round(Number(raw.value))));
  if (!Number.isFinite(value)) return null;
  const ts = Math.max(0, parseInt(String(raw.timestamp || '0'), 10) || 0);
  const meta = classifySentimentScore(value);
  const dateLabel =
    ts > 0
      ? new Date(ts * 1000).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit'
        })
      : '--/--';

  return {
    value,
    classificationPt: meta.labelPt,
    zoneId: meta.zoneId,
    timestampSec: ts,
    dateLabel
  };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function fetchFearGreedIndex(): Promise<FearGreedApiPayload> {
  let rawEntries: RawAlternativeEntry[] = [];
  let source = 'Alternative.me';
  let fetchedAtISO = new Date().toISOString();

  // 1. Direto da API oficial (funciona também em deploy estático como Vercel)
  try {
    const direct = await fetchJsonWithTimeout<{ data?: RawAlternativeEntry[] }>(
      'https://api.alternative.me/fng/?limit=8&format=json',
      4500
    );
    if (Array.isArray(direct?.data) && direct.data.length > 0) {
      rawEntries = direct.data;
    }
  } catch {
    // Segue para proxy do backend
  }

  // 2. Fallback para proxy /api/fear-greed no servidor Express
  if (rawEntries.length === 0) {
    const proxied = await fetchJsonWithTimeout<{
      source?: string;
      fetchedAt?: string;
      data?: RawAlternativeEntry[];
    }>('/api/fear-greed', 4500);
    if (Array.isArray(proxied?.data) && proxied.data.length > 0) {
      rawEntries = proxied.data;
      source = proxied.source || 'Alternative.me';
      fetchedAtISO = proxied.fetchedAt || fetchedAtISO;
    }
  }

  if (rawEntries.length === 0) {
    throw new Error('Índice Fear & Greed indisponível no momento.');
  }

  const parsedPoints = rawEntries
    .map(parseEntry)
    .filter((p): p is FearGreedDayPoint => p !== null);

  if (parsedPoints.length === 0) {
    throw new Error('Dados inválidos do Índice Fear & Greed.');
  }

  const timeUntilUpdateSec = Math.max(
    0,
    parseInt(String(rawEntries[0]?.time_until_update || '0'), 10) || 0
  );

  // Histórico ordenado do mais antigo ao mais recente (máx. 7 dias + hoje = 8 pontos)
  const history = [...parsedPoints].reverse();

  return {
    source,
    fetchedAtISO,
    timeUntilUpdateSec,
    current: parsedPoints[0],
    yesterday: parsedPoints[1] ?? null,
    weekAgo: parsedPoints[7] ?? parsedPoints[parsedPoints.length - 1] ?? null,
    history
  };
}

function normalizeTicker24hMap(
  list: RawBinance24h[],
  pairToSymbol: Map<string, string>
): Record<string, Ticker24hStats> {
  const result: Record<string, Ticker24hStats> = {};
  if (!Array.isArray(list)) return result;

  for (const item of list) {
    const pair = String(item?.symbol || '').toUpperCase();
    const mappedSym = pairToSymbol.get(pair);
    if (!mappedSym) continue;

    const openPrice = parseFloat(String(item.openPrice || '0'));
    const highPrice = parseFloat(String(item.highPrice || '0'));
    const lowPrice = parseFloat(String(item.lowPrice || '0'));
    const lastPrice = parseFloat(String(item.lastPrice || '0'));
    const priceChangePercent = parseFloat(String(item.priceChangePercent || '0'));

    if (Number.isFinite(lastPrice) && lastPrice > 0) {
      result[mappedSym] = {
        symbol: mappedSym,
        openPrice: Number.isFinite(openPrice) ? openPrice : 0,
        highPrice: Number.isFinite(highPrice) ? highPrice : 0,
        lowPrice: Number.isFinite(lowPrice) ? lowPrice : 0,
        lastPrice,
        priceChangePercent: Number.isFinite(priceChangePercent) ? priceChangePercent : 0
      };
    }
  }
  return result;
}

export async function fetchMarket24hStats(
  goals: CryptoGoal[]
): Promise<Record<string, Ticker24hStats>> {
  const pairToSymbol = new Map<string, string>();
  const supportedPairs = new Set<string>();

  for (const c of SUPPORTED_CRYPTOS) {
    const p = c.binancePair.toUpperCase();
    pairToSymbol.set(p, c.symbol);
    supportedPairs.add(p);
    if (c.fallbackPair) {
      const fb = c.fallbackPair.toUpperCase();
      if (!pairToSymbol.has(fb)) pairToSymbol.set(fb, c.symbol);
      supportedPairs.add(fb);
    }
  }

  for (const g of goals) {
    const sym = String(g.symbol || '').toUpperCase().trim();
    if (!sym) continue;
    const p = (g.binancePair || `${sym}USDT`).toUpperCase();
    if (!pairToSymbol.has(p)) {
      pairToSymbol.set(p, sym);
    }
  }

  const candidatePairs = Array.from(pairToSymbol.keys());
  const supportedOnly = Array.from(supportedPairs);

  const tryEndpoints = [
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${encodeURIComponent(
      JSON.stringify(candidatePairs)
    )}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${encodeURIComponent(
      JSON.stringify(supportedOnly)
    )}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
      JSON.stringify(supportedOnly)
    )}`
  ];

  for (const url of tryEndpoints) {
    try {
      const list = await fetchJsonWithTimeout<RawBinance24h[]>(url, 4000);
      const map = normalizeTicker24hMap(list, pairToSymbol);
      if (Object.keys(map).length > 0) {
        return map;
      }
    } catch {
      // Tenta próximo endpoint (ex: ativo customizado não listado na Binance)
    }
  }

  return {};
}

function getLive24hChange(
  symbol: string,
  statsMap: Record<string, Ticker24hStats>,
  pricesUSD: Record<string, number>
): { pct: number; rangePos: number | null } | null {
  const stat = statsMap[symbol];
  if (!stat) return null;

  const livePrice = Number(pricesUSD[symbol]) > 0 ? Number(pricesUSD[symbol]) : stat.lastPrice;
  const pct =
    stat.openPrice > 0
      ? ((livePrice - stat.openPrice) / stat.openPrice) * 100
      : stat.priceChangePercent;

  let rangePos: number | null = null;
  const effectiveHigh = Math.max(stat.highPrice, livePrice);
  const effectiveLow = stat.lowPrice > 0 ? Math.min(stat.lowPrice, livePrice) : livePrice;
  if (effectiveHigh > effectiveLow) {
    rangePos = ((livePrice - effectiveLow) / (effectiveHigh - effectiveLow)) * 100;
  }

  return {
    pct: Number.isFinite(pct) ? pct : 0,
    rangePos
  };
}

export function computeRealtimeSentimentSummary(
  fgData: FearGreedApiPayload,
  statsMap: Record<string, Ticker24hStats>,
  goals: CryptoGoal[],
  pricesUSD: Record<string, number>,
  fxRate: number
): RealtimeSentimentSummary {
  const btcLive = getLive24hChange('BTC', statsMap, pricesUSD);
  const btcChange24hPct = btcLive ? btcLive.pct : null;

  let weightedSum = 0;
  let totalWeight = 0;
  let equalSum = 0;
  let equalCount = 0;
  let rangeSum = 0;
  let rangeCount = 0;

  for (const g of goals) {
    const live = getLive24hChange(g.symbol, statsMap, pricesUSD);
    if (!live) continue;

    const metrics = calculateGoalMetrics(g, pricesUSD, fxRate);
    const weight = Math.max(0, metrics.totalPositionValueUSD);
    if (weight > 0) {
      weightedSum += live.pct * weight;
      totalWeight += weight;
    }
    equalSum += live.pct;
    equalCount++;

    if (live.rangePos !== null) {
      rangeSum += live.rangePos;
      rangeCount++;
    }
  }

  const portfolioChange24hPct =
    totalWeight > 0
      ? weightedSum / totalWeight
      : equalCount > 0
        ? equalSum / equalCount
        : null;

  // Ajuste intradiário transparente (-12 a +12 pts) combinando variação 24h de BTC + Carteira
  // com posição dentro da faixa máxima/mínima das últimas 24h em tempo real.
  let intradayDelta = 0;
  if (btcChange24hPct !== null || portfolioChange24hPct !== null) {
    const blendedPct =
      btcChange24hPct !== null && portfolioChange24hPct !== null
        ? btcChange24hPct * 0.6 + portfolioChange24hPct * 0.4
        : (btcChange24hPct ?? portfolioChange24hPct ?? 0);

    const avgRangePos =
      btcLive?.rangePos !== null && btcLive?.rangePos !== undefined
        ? rangeCount > 0
          ? btcLive.rangePos * 0.6 + (rangeSum / rangeCount) * 0.4
          : btcLive.rangePos
        : rangeCount > 0
          ? rangeSum / rangeCount
          : 50;

    const momentumComponent = Math.max(-8, Math.min(8, blendedPct * 0.9));
    const rangeComponent = Math.max(-4, Math.min(4, ((avgRangePos - 50) / 50) * 4));
    intradayDelta = Math.round(Math.max(-12, Math.min(12, momentumComponent + rangeComponent)));
  }

  const officialScore = fgData.current.value;
  const realtimeScore = Math.max(0, Math.min(100, Math.round(officialScore + intradayDelta)));
  const officialMeta = classifySentimentScore(officialScore);
  const realtimeMeta = classifySentimentScore(realtimeScore);

  return {
    officialScore,
    officialLabel: officialMeta.labelPt,
    officialZone: officialMeta.zoneId,
    realtimeScore,
    realtimeLabel: realtimeMeta.labelPt,
    realtimeZone: realtimeMeta.zoneId,
    intradayDelta,
    yesterdayScore: fgData.yesterday ? fgData.yesterday.value : null,
    weekAgoScore: fgData.weekAgo ? fgData.weekAgo.value : null,
    btcChange24hPct,
    portfolioChange24hPct,
    portfolioDirectionAssets: equalCount,
    timeUntilUpdateSec: fgData.timeUntilUpdateSec,
    fetchedAtISO: fgData.fetchedAtISO,
    source: fgData.source,
    history: fgData.history
  };
}
