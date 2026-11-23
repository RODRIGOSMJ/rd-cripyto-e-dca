import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppState, ConverterState, CryptoGoal, CurrencyMode } from '../types';
import { getFutureMonthLabel, SUPPORTED_CRYPTOS } from '../constants';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function clamp(n: number, min: number, max: number, fallback: number): number {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeId(raw: string, fallback: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned && VALID_ID_REGEX.test(cleaned) ? cleaned : fallback;
}

function sanitizeSymbol(raw: string): string {
  const cleaned = String(raw || 'POL')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
  return cleaned || 'POL';
}

function sanitizeColor(raw: string): string {
  const str = String(raw || '').trim();
  return VALID_COLOR_REGEX.test(str) ? str : '#10b981';
}

export function sanitizeConverterPayload(c: ConverterState): ConverterState {
  return {
    direction: c.direction === 'USDT_TO_BRL' ? 'USDT_TO_BRL' : 'BRL_TO_USDT',
    amountBRL: clamp(c.amountBRL, 0, 1_000_000_000_000, 1000),
    amountUSDT: clamp(c.amountUSDT, 0, 1_000_000_000_000, 200),
    exchangeFeePct: clamp(c.exchangeFeePct, 0, 50, 0.1),
    pixSpreadPct: clamp(c.pixSpreadPct, 0, 50, 0),
    networkFeeUSDT: clamp(c.networkFeeUSDT, 0, 10_000, 0),
    targetSymbol: sanitizeSymbol(c.targetSymbol),
    targetGoalId: String(c.targetGoalId || '').slice(0, 128),
    targetMonthIndex: Math.floor(clamp(c.targetMonthIndex, 0, 120, 0))
  };
}

export function sanitizeUserSettingsUpdate(state: AppState) {
  const currency: CurrencyMode = ['USDT', 'HYBRID', 'BRL'].includes(state.currency)
    ? state.currency
    : 'USDT';
  return {
    currency,
    selectedGoalId: String(state.selectedGoalId || '').slice(0, 128),
    manualFxOverride: Boolean(state.manualFxOverride),
    manualUsdtBrlRate: clamp(state.manualUsdtBrlRate, 0.01, 1000, 5.85),
    retirementGoalUSD: clamp(state.retirementGoalUSD, 0, 10_000_000_000, 100000),
    cycleMultiplier: clamp(state.cycleMultiplier, 1, 20, 1),
    converter: sanitizeConverterPayload(state.converter)
  };
}

export function sanitizeGoalUpdate(goal: CryptoGoal, pricesUSD: Record<string, number>) {
  const symbol = sanitizeSymbol(goal.symbol);
  const monthsCount = Math.floor(clamp(goal.monthsCount, 1, 120, 12));
  const monthlyRecords = Array.from({ length: monthsCount }, (_, idx) => {
    const rec = goal.monthlyRecords[idx];
    return {
      month: idx + 1,
      label: String(rec?.label || getFutureMonthLabel(idx)).slice(0, 20),
      boughtQty: clamp(rec?.boughtQty ?? 0, 0, 1_000_000_000_000, 0),
      pricePaidUSD: clamp(rec?.pricePaidUSD ?? 0, 0, 1_000_000_000, 0),
      fxRateBRL: clamp(rec?.fxRateBRL ?? 5.85, 0.01, 1000, 5.85)
    };
  });

  const isSupported = SUPPORTED_CRYPTOS.some((c) => c.symbol === symbol);
  const customPriceUSD = isSupported ? 0 : clamp(pricesUSD[symbol] ?? 0, 0, 1_000_000_000, 0);

  return {
    symbol,
    name: String(goal.name || symbol).trim().slice(0, 80) || symbol,
    binancePair: String(goal.binancePair || `${symbol}USDT`).trim().slice(0, 30) || `${symbol}USDT`,
    fallbackPair: String(goal.fallbackPair || '').trim().slice(0, 30),
    coingeckoId: String(goal.coingeckoId || symbol.toLowerCase()).trim().slice(0, 80),
    color: sanitizeColor(goal.color),
    initialBalance: clamp(goal.initialBalance, 0, 1_000_000_000_000, 0),
    targetAmount: clamp(goal.targetAmount, 0.000001, 1_000_000_000_000, 100),
    monthsCount,
    retirementTargetPriceUSD: clamp(goal.retirementTargetPriceUSD, 0, 1_000_000_000, 0),
    customPriceUSD,
    monthlyRecords
  };
}

export async function uploadFullStateToCloud(
  uid: string,
  state: AppState,
  userDocExists: boolean,
  existingCloudGoalIds: Set<string>
): Promise<Set<string>> {
  const userPath = `users/${uid}`;
  try {
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', uid);
    const settingsPayload = sanitizeUserSettingsUpdate(state);

    if (userDocExists) {
      batch.update(userRef, {
        ...settingsPayload,
        updatedAt: serverTimestamp()
      });
    } else {
      batch.set(userRef, {
        ownerId: uid,
        ...settingsPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    const nextGoalIds = new Set<string>();

    for (const goal of state.goals) {
      const safeGoalId = sanitizeId(goal.id, `${sanitizeSymbol(goal.symbol)}_${Date.now()}`);
      nextGoalIds.add(safeGoalId);
      const goalRef = doc(db, 'users', uid, 'goals', safeGoalId);
      const goalFields = sanitizeGoalUpdate(goal, state.pricesUSD);

      if (existingCloudGoalIds.has(safeGoalId)) {
        batch.update(goalRef, {
          ...goalFields,
          updatedAt: serverTimestamp()
        });
      } else {
        batch.set(goalRef, {
          id: safeGoalId,
          ownerId: uid,
          ...goalFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    // Remove goals that no longer exist in state
    for (const oldId of existingCloudGoalIds) {
      if (!nextGoalIds.has(oldId)) {
        batch.delete(doc(db, 'users', uid, 'goals', oldId));
      }
    }

    await batch.commit();
    return nextGoalIds;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function saveUserSettingsToCloud(
  uid: string,
  state: AppState,
  userDocExists: boolean
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const settingsPayload = sanitizeUserSettingsUpdate(state);

    if (userDocExists) {
      await updateDoc(userRef, {
        ...settingsPayload,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(userRef, {
        ownerId: uid,
        ...settingsPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, userDocExists ? OperationType.UPDATE : OperationType.CREATE, userPath);
  }
}

export async function saveSingleGoalToCloud(
  uid: string,
  goal: CryptoGoal,
  pricesUSD: Record<string, number>,
  existsInCloud: boolean
): Promise<string> {
  const safeGoalId = sanitizeId(goal.id, `${sanitizeSymbol(goal.symbol)}_${Date.now()}`);
  const goalPath = `users/${uid}/goals/${safeGoalId}`;
  try {
    const goalRef = doc(db, 'users', uid, 'goals', safeGoalId);
    const goalFields = sanitizeGoalUpdate(goal, pricesUSD);

    if (existsInCloud) {
      await updateDoc(goalRef, {
        ...goalFields,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(goalRef, {
        id: safeGoalId,
        ownerId: uid,
        ...goalFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    return safeGoalId;
  } catch (error) {
    handleFirestoreError(error, existsInCloud ? OperationType.UPDATE : OperationType.CREATE, goalPath);
  }
}

export async function deleteGoalFromCloud(uid: string, goalId: string): Promise<void> {
  const safeGoalId = sanitizeId(goalId, goalId);
  const goalPath = `users/${uid}/goals/${safeGoalId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'goals', safeGoalId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, goalPath);
  }
}

export interface CloudUserSettingsData {
  currency: CurrencyMode;
  selectedGoalId: string;
  manualFxOverride: boolean;
  manualUsdtBrlRate: number;
  retirementGoalUSD: number;
  cycleMultiplier: number;
  converter: ConverterState;
}

export interface CloudGoalsSnapshotResult {
  goals: CryptoGoal[];
  customPricesUSD: Record<string, number>;
  goalIds: Set<string>;
}

export function subscribeToUserCloudData(
  uid: string,
  handlers: {
    onSettingsSnapshot: (exists: boolean, settings: CloudUserSettingsData | null) => void;
    onGoalsSnapshot: (result: CloudGoalsSnapshotResult) => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  const userPath = `users/${uid}`;
  const goalsPath = `users/${uid}/goals`;

  const unsubUser = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        handlers.onSettingsSnapshot(false, null);
        return;
      }
      const d = snap.data();
      handlers.onSettingsSnapshot(true, {
        currency: ['USDT', 'HYBRID', 'BRL'].includes(d.currency) ? d.currency : 'USDT',
        selectedGoalId: typeof d.selectedGoalId === 'string' ? d.selectedGoalId : '',
        manualFxOverride: Boolean(d.manualFxOverride),
        manualUsdtBrlRate: Number(d.manualUsdtBrlRate) > 0 ? Number(d.manualUsdtBrlRate) : 5.85,
        retirementGoalUSD: Number(d.retirementGoalUSD) >= 0 ? Number(d.retirementGoalUSD) : 100000,
        cycleMultiplier: Number(d.cycleMultiplier) >= 1 ? Number(d.cycleMultiplier) : 1,
        converter: sanitizeConverterPayload(d.converter || {})
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, userPath);
      } catch (e) {
        handlers.onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );

  const goalsQuery = query(collection(db, 'users', uid, 'goals'), where('ownerId', '==', uid));
  const unsubGoals = onSnapshot(
    goalsQuery,
    (snapshot) => {
      const goals: CryptoGoal[] = [];
      const customPricesUSD: Record<string, number> = {};
      const goalIds = new Set<string>();

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const id = String(d.id || docSnap.id);
        goalIds.add(id);

        const mCount = Math.min(120, Math.max(1, parseInt(String(d.monthsCount), 10) || 12));
        const rawRecs = Array.isArray(d.monthlyRecords) ? d.monthlyRecords : [];
        const monthlyRecords = Array.from({ length: mCount }, (_, idx) => {
          const r = rawRecs[idx] || {};
          return {
            month: idx + 1,
            label: String(r.label || getFutureMonthLabel(idx)),
            boughtQty: Number(r.boughtQty) || 0,
            pricePaidUSD: Number(r.pricePaidUSD) || 0,
            fxRateBRL: Number(r.fxRateBRL) > 0 ? Number(r.fxRateBRL) : 5.85
          };
        });

        const symbol = sanitizeSymbol(d.symbol || 'POL');
        if (Number(d.customPriceUSD) > 0) {
          customPricesUSD[symbol] = Number(d.customPriceUSD);
        }

        goals.push({
          id,
          symbol,
          name: String(d.name || symbol),
          binancePair: String(d.binancePair || `${symbol}USDT`),
          fallbackPair: d.fallbackPair ? String(d.fallbackPair) : null,
          coingeckoId: String(d.coingeckoId || symbol.toLowerCase()),
          color: sanitizeColor(d.color || '#10b981'),
          initialBalance: Math.max(0, Number(d.initialBalance) || 0),
          targetAmount: Math.max(0.000001, Number(d.targetAmount) || 100),
          monthsCount: mCount,
          retirementTargetPriceUSD: Math.max(0, Number(d.retirementTargetPriceUSD) || 0),
          monthlyRecords
        });
      });

      handlers.onGoalsSnapshot({ goals, customPricesUSD, goalIds });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, goalsPath);
      } catch (e) {
        handlers.onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );

  return () => {
    unsubUser();
    unsubGoals();
  };
}
