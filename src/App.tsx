import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, ArrowRightLeft, PieChart, Plus } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { AppState, ConverterState, CryptoGoal, CurrencyMode, MainTab, ToastMessage } from './types';
import {
  CUSTOM_PALETTE,
  SUPPORTED_CRYPTOS,
  getDefaultGoals,
  getFutureMonthLabel,
  migrateGoalStartToDecember
} from './constants';
import { loadState, normalizeLoadedState, saveState } from './utils/storage';
import {
  calculateConverterResults,
  calculateGoalMetrics,
  convertToUSD,
  formatCryptoQty,
  formatUSDT,
  getEffectiveUsdtBrlRate
} from './utils/calculations';
import { subscribeLiveBinanceStream, syncLivePrices } from './utils/priceService';
import { downloadCSVReport, downloadJSONBackup } from './utils/exportUtils';
import {
  CloudGoalsSnapshotResult,
  CloudUserSettingsData,
  subscribeToUserCloudData,
  uploadFullStateToCloud
} from './utils/cloudSync';
import { CloudSyncStatus, Header } from './components/Header';
import { GlobalKPIs } from './components/GlobalKPIs';
import { DcaPlannerView } from './components/DcaPlannerView';
import { ConverterView } from './components/ConverterView';
import { ChartsRetirementView } from './components/ChartsRetirementView';
import { GoalFormPayload, GoalModal } from './components/GoalModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ToastContainer } from './components/ToastContainer';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Estado Firebase Auth & Firestore Sync
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('offline');

  const userRef = useRef<User | null>(null);
  const cloudReadyRef = useRef(false);
  const userDocExistsRef = useRef(false);
  const cloudGoalIdsRef = useRef<Set<string>>(new Set());
  const isWritingCloudRef = useRef(false);
  const dirtyRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsConnectedRef = useRef(false);

  // Modal Criar/Editar Meta
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [preselectSymbol, setPreselectSymbol] = useState<string | null>(null);

  // Modal Confirmação
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const notifyCloudError = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('quota exceeded')) {
        showToast(
          'Limite diário gratuito do Firebase atingido. Seus dados continuam salvos localmente e a cota renova amanhã.',
          'error'
        );
      } else {
        showToast('Não foi possível sincronizar com o Firebase agora. Dados mantidos localmente.', 'error');
      }
    },
    [showToast]
  );

  const flushCloudSync = useCallback(
    async (manual = false) => {
      const activeUser = userRef.current;
      if (!activeUser) {
        if (manual) {
          showToast('Entre com sua conta Google para salvar no Firebase.', 'info');
        }
        return;
      }

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }

      isWritingCloudRef.current = true;
      setCloudStatus('syncing');

      try {
        const nextIds = await uploadFullStateToCloud(
          activeUser.uid,
          stateRef.current,
          userDocExistsRef.current,
          cloudGoalIdsRef.current
        );
        userDocExistsRef.current = true;
        cloudGoalIdsRef.current = nextIds;
        dirtyRef.current = false;
        setCloudStatus('saved');
        if (manual) {
          showToast('Todos os dados foram salvos no Firebase!', 'success');
        }
      } catch (err) {
        setCloudStatus('error');
        notifyCloudError(err);
      } finally {
        isWritingCloudRef.current = false;
      }
    },
    [notifyCloudError, showToast]
  );

  const scheduleCloudSync = useCallback(() => {
    if (!userRef.current || !cloudReadyRef.current) return;
    dirtyRef.current = true;
    setCloudStatus('syncing');

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(() => {
      void flushCloudSync(false);
    }, 600);
  }, [flushCloudSync]);

  const updateAndPersist = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setState((prev) => {
        const next = updater(prev);
        saveState(next);
        stateRef.current = next;
        return next;
      });
      scheduleCloudSync();
    },
    [scheduleCloudSync]
  );

  // Listener de Autenticação Firebase + Sincronização em Tempo Real no Firestore
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;
    let sessionCancelled = false;

    const cleanupCloudSession = () => {
      sessionCancelled = true;
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      cloudReadyRef.current = false;
      userDocExistsRef.current = false;
      cloudGoalIdsRef.current = new Set();
      dirtyRef.current = false;
      isWritingCloudRef.current = false;
    };

    const applyCloudHydration = (
      settings: CloudUserSettingsData,
      goalsResult: CloudGoalsSnapshotResult
    ): boolean => {
      let migratedAny = false;
      const defaultFx = settings.manualUsdtBrlRate > 0 ? settings.manualUsdtBrlRate : 5.85;
      const migratedGoals = goalsResult.goals.map((g) => {
        const res = migrateGoalStartToDecember(g, defaultFx);
        if (res.changed) migratedAny = true;
        return res.goal;
      });

      const prev = stateRef.current;
      const mergedPrices = { ...prev.pricesUSD, ...goalsResult.customPricesUSD };
      const hasSelected = migratedGoals.some((g) => g.id === settings.selectedGoalId);
      const selectedGoalId = hasSelected
        ? settings.selectedGoalId
        : migratedGoals[0]?.id || '';

      const nextConverter: ConverterState = {
        ...settings.converter,
        targetGoalId: migratedGoals.some((g) => g.id === settings.converter.targetGoalId)
          ? settings.converter.targetGoalId
          : selectedGoalId
      };

      const next: AppState = {
        ...prev,
        currency: settings.currency,
        selectedGoalId,
        manualFxOverride: settings.manualFxOverride,
        manualUsdtBrlRate: settings.manualUsdtBrlRate,
        retirementGoalUSD: settings.retirementGoalUSD,
        cycleMultiplier: settings.cycleMultiplier,
        converter: nextConverter,
        goals: migratedGoals,
        pricesUSD: mergedPrices
      };

      saveState(next);
      stateRef.current = next;
      setState(next);

      return migratedAny;
    };

    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      cleanupCloudSession();
      sessionCancelled = false;

      userRef.current = nextUser;
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setCloudStatus('offline');
        return;
      }

      setCloudStatus('loading');

      let settingsLoaded = false;
      let settingsExists = false;
      let latestSettings: CloudUserSettingsData | null = null;
      let goalsLoaded = false;
      let latestGoalsResult: CloudGoalsSnapshotResult | null = null;
      let initializedSession = false;

      const tryCompleteInitialLoad = async () => {
        if (sessionCancelled || initializedSession || !settingsLoaded || !goalsLoaded || !latestGoalsResult) {
          return;
        }
        initializedSession = true;

        if (!settingsExists) {
          // Primeira conexão desta conta Google: migra automaticamente os dados locais para o Firebase
          isWritingCloudRef.current = true;
          setCloudStatus('syncing');
          try {
            const nextIds = await uploadFullStateToCloud(
              nextUser.uid,
              stateRef.current,
              false,
              latestGoalsResult.goalIds
            );
            if (sessionCancelled) return;
            userDocExistsRef.current = true;
            cloudGoalIdsRef.current = nextIds;
            cloudReadyRef.current = true;
            dirtyRef.current = false;
            setCloudStatus('saved');
            showToast('Conectado! Todos os seus dados foram salvos no Firebase.', 'success');
          } catch (err) {
            if (!sessionCancelled) {
              setCloudStatus('error');
              notifyCloudError(err);
            }
          } finally {
            isWritingCloudRef.current = false;
          }
          return;
        }

        // Já existem dados salvos na nuvem: hidrata o app mantendo cotações ao vivo
        userDocExistsRef.current = true;
        cloudGoalIdsRef.current = latestGoalsResult.goalIds;
        cloudReadyRef.current = true;
        let migratedAny = false;
        if (latestSettings) {
          migratedAny = applyCloudHydration(latestSettings, latestGoalsResult);
        }

        if (migratedAny) {
          // Atualiza os meses na nuvem para início em Dezembro (Dez/26 → Dez/27) uma única vez
          isWritingCloudRef.current = true;
          setCloudStatus('syncing');
          try {
            const nextIds = await uploadFullStateToCloud(
              nextUser.uid,
              stateRef.current,
              true,
              latestGoalsResult.goalIds
            );
            if (!sessionCancelled) {
              cloudGoalIdsRef.current = nextIds;
              setCloudStatus('saved');
              showToast('Calendário atualizado para Dez/26 a Dez/27 e salvo no Firebase!', 'success');
            }
          } catch (err) {
            if (!sessionCancelled) {
              setCloudStatus('error');
              notifyCloudError(err);
            }
          } finally {
            isWritingCloudRef.current = false;
          }
          return;
        }

        setCloudStatus('saved');
        showToast('Dados sincronizados com sua conta Firebase!', 'success');
      };

      unsubCloud = subscribeToUserCloudData(nextUser.uid, {
        onSettingsSnapshot: (exists, settings) => {
          if (sessionCancelled) return;
          settingsLoaded = true;
          settingsExists = exists;
          latestSettings = settings;

          if (!initializedSession) {
            void tryCompleteInitialLoad();
            return;
          }

          if (!isWritingCloudRef.current) {
            userDocExistsRef.current = exists;
            if (!dirtyRef.current && exists && settings && latestGoalsResult) {
              applyCloudHydration(settings, latestGoalsResult);
              setCloudStatus('saved');
            }
          }
        },
        onGoalsSnapshot: (result) => {
          if (sessionCancelled) return;
          goalsLoaded = true;
          latestGoalsResult = result;

          if (!initializedSession) {
            void tryCompleteInitialLoad();
            return;
          }

          if (!isWritingCloudRef.current) {
            cloudGoalIdsRef.current = result.goalIds;
            if (!dirtyRef.current && settingsExists && latestSettings) {
              applyCloudHydration(latestSettings, result);
              setCloudStatus('saved');
            }
          }
        },
        onError: (err) => {
          if (sessionCancelled) return;
          setCloudStatus('error');
          notifyCloudError(err);
        }
      });
    });

    return () => {
      cleanupCloudSession();
      unsubAuth();
    };
  }, [notifyCloudError, showToast]);

  const handleSignInGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('Login com Google cancelado.', 'info');
      } else if (code === 'auth/popup-blocked') {
        showToast('Pop-up bloqueado pelo navegador. Permita pop-ups para entrar com o Google.', 'error');
      } else {
        showToast('Não foi possível conectar com o Google agora. Tente novamente.', 'error');
      }
    }
  }, [showToast]);

  const handleSignOutGoogle = useCallback(async () => {
    try {
      if (dirtyRef.current && userRef.current && cloudReadyRef.current) {
        await flushCloudSync(false);
      }
      await signOut(auth);
      showToast('Conta Google desconectada. Seus dados continuam salvos localmente.', 'info');
    } catch {
      showToast('Erro ao desconectar da conta Google.', 'error');
    }
  }, [flushCloudSync, showToast]);

  const handleManualCloudSync = useCallback(() => {
    void flushCloudSync(true);
  }, [flushCloudSync]);

  const handleRefreshPrices = useCallback(
    async (manualTrigger = false) => {
      setIsSyncing(true);
      const current = stateRef.current;
      const result = await syncLivePrices(current.goals, current.pricesUSD, current.usdtBrlRate);

      setState((prev) => {
        const isConnectedNow = result.success || wsConnectedRef.current;
        const nextPrices = result.success ? { ...prev.pricesUSD, ...result.pricesUSD } : prev.pricesUSD;
        const nextFx = result.fxLive || result.success ? result.usdtBrlRate : prev.usdtBrlRate;
        const next: AppState = {
          ...prev,
          pricesUSD: nextPrices,
          usdtBrlRate: nextFx,
          isLiveConnected: isConnectedNow,
          lastPriceUpdate: result.success || result.fxLive ? new Date().toISOString() : prev.lastPriceUpdate,
          priceSource: wsConnectedRef.current
            ? 'Binance Tempo Real (WS)'
            : result.success
              ? result.source
              : result.fxLive
                ? result.source
                : !prev.lastPriceUpdate
                  ? 'Modo Offline / Referência'
                  : prev.priceSource
        };
        if (result.success || result.fxLive) {
          saveState(next);
          stateRef.current = next;
        }
        return next;
      });

      if (manualTrigger) {
        if (result.success) {
          showToast(`Cotações sincronizadas via ${result.source}!`, 'success');
        } else if (result.fxLive) {
          showToast('Cotação do Dólar atualizada! Criptos em modo de referência.', 'info');
        } else {
          showToast('APIs externas bloqueadas neste ambiente. Usando cotações locais.', 'info');
        }
      }

      setTimeout(() => setIsSyncing(false), 350);
    },
    [showToast]
  );

  // Sincronização REST inicial + respaldo a cada 15s (atualiza criptos customizadas e persiste localStorage)
  useEffect(() => {
    void handleRefreshPrices(false);
    const intervalId = setInterval(() => {
      void handleRefreshPrices(false);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [handleRefreshPrices]);

  // Stream WebSocket em tempo real (tick-a-tick) para todas as criptos e Dólar (USDT/BRL)
  const goalSymbolsKey = state.goals
    .map((g) => g.symbol.toUpperCase())
    .sort()
    .join(',');

  useEffect(() => {
    const unsubscribe = subscribeLiveBinanceStream(stateRef.current.goals, {
      onStatusChange: (connected) => {
        wsConnectedRef.current = connected;
        if (connected) {
          setState((prev) => ({
            ...prev,
            isLiveConnected: true,
            priceSource: 'Binance Tempo Real (WS)'
          }));
        }
      },
      onTick: (tick) => {
        wsConnectedRef.current = true;
        setState((prev) => {
          const nextPrices =
            Object.keys(tick.priceUpdates).length > 0
              ? { ...prev.pricesUSD, ...tick.priceUpdates }
              : prev.pricesUSD;
          const nextFx = tick.usdtBrlRate && tick.usdtBrlRate > 0 ? tick.usdtBrlRate : prev.usdtBrlRate;
          const next: AppState = {
            ...prev,
            pricesUSD: nextPrices,
            usdtBrlRate: nextFx,
            isLiveConnected: true,
            lastPriceUpdate: new Date().toISOString(),
            priceSource: 'Binance Tempo Real (WS)'
          };
          stateRef.current = next;
          return next;
        });
      }
    });

    return () => {
      wsConnectedRef.current = false;
      unsubscribe();
    };
  }, [goalSymbolsKey]);

  const handleSetCurrency = (mode: CurrencyMode) => {
    updateAndPersist((prev) => ({ ...prev, currency: mode }));
  };

  const handleSelectMainTab = (tab: MainTab) => {
    updateAndPersist((prev) => ({ ...prev, mainTab: tab }));
  };

  const handleSelectGoal = (goalId: string) => {
    updateAndPersist((prev) => ({ ...prev, selectedGoalId: goalId }));
  };

  const handleTickerClick = (symbol: string) => {
    const found = state.goals.find((g) => g.symbol === symbol);
    if (found) {
      updateAndPersist((prev) => ({
        ...prev,
        mainTab: 'DCA',
        selectedGoalId: found.id
      }));
    } else {
      setEditingGoalId(null);
      setPreselectSymbol(symbol);
      setGoalModalOpen(true);
    }
  };

  const handleOpenGoalModal = (goalId?: string, preselect?: string) => {
    setEditingGoalId(goalId || null);
    setPreselectSymbol(preselect || null);
    setGoalModalOpen(true);
  };

  const handleSaveGoal = (payload: GoalFormPayload) => {
    let symbol = payload.selectedAsset;
    let name = payload.selectedAsset;
    let binancePair = `${symbol}USDT`;
    let fallbackPair: string | null = null;
    let coingeckoId = symbol.toLowerCase();
    let color = '#10b981';

    if (payload.selectedAsset === 'CUSTOM') {
      if (!payload.customSymbol) {
        showToast('Informe o ticker da criptomoeda.', 'error');
        return;
      }
      symbol = payload.customSymbol;
      name = payload.customName || symbol;
      binancePair = `${symbol}USDT`;
      coingeckoId = symbol.toLowerCase();
      color = CUSTOM_PALETTE[state.goals.length % CUSTOM_PALETTE.length];
    } else {
      const meta = SUPPORTED_CRYPTOS.find((c) => c.symbol === payload.selectedAsset);
      if (meta) {
        symbol = meta.symbol;
        name = meta.name;
        binancePair = meta.binancePair;
        fallbackPair = meta.fallbackPair;
        coingeckoId = meta.coingeckoId;
        color = meta.color;
      }
    }

    const fx = getEffectiveUsdtBrlRate(state);

    updateAndPersist((prev) => {
      const nextPrices = { ...prev.pricesUSD };
      if (payload.selectedAsset === 'CUSTOM') {
        if (payload.customPriceUSD > 0) {
          nextPrices[symbol] = payload.customPriceUSD;
        } else if (!nextPrices[symbol]) {
          nextPrices[symbol] = 1.0;
        }
      }

      if (payload.existingId) {
        const nextGoals = prev.goals.map((g) => {
          if (g.id !== payload.existingId) return g;
          const updatedRecs = Array.from({ length: payload.monthsCount }, (_, i) => {
            if (g.monthlyRecords[i]) return g.monthlyRecords[i];
            return {
              month: i + 1,
              label: getFutureMonthLabel(i),
              boughtQty: 0,
              pricePaidUSD: 0,
              fxRateBRL: fx
            };
          });
          return {
            ...g,
            symbol,
            name,
            binancePair,
            fallbackPair,
            coingeckoId,
            color,
            initialBalance: payload.initialBalance,
            targetAmount: payload.targetAmount,
            monthsCount: payload.monthsCount,
            retirementTargetPriceUSD: payload.retirementTargetPriceUSD,
            monthlyRecords: updatedRecs
          };
        });

        return {
          ...prev,
          pricesUSD: nextPrices,
          goals: nextGoals,
          selectedGoalId: payload.existingId
        };
      }

      const newId = `${symbol}_${Date.now()}`;
      const newGoal: CryptoGoal = {
        id: newId,
        symbol,
        name,
        binancePair,
        fallbackPair,
        coingeckoId,
        color,
        initialBalance: payload.initialBalance,
        targetAmount: payload.targetAmount,
        monthsCount: payload.monthsCount,
        retirementTargetPriceUSD: payload.retirementTargetPriceUSD,
        monthlyRecords: Array.from({ length: payload.monthsCount }, (_, i) => ({
          month: i + 1,
          label: getFutureMonthLabel(i),
          boughtQty: 0,
          pricePaidUSD: 0,
          fxRateBRL: fx
        }))
      };

      return {
        ...prev,
        pricesUSD: nextPrices,
        goals: [...prev.goals, newGoal],
        selectedGoalId: newId,
        mainTab: 'DCA'
      };
    });

    showToast(
      payload.existingId ? `Meta de ${symbol} atualizada!` : `Meta de ${symbol} adicionada!`,
      'success'
    );
    setGoalModalOpen(false);
    // Sincroniza imediatamente a cotação ao vivo da cripto recém-adicionada/editada
    setTimeout(() => {
      void handleRefreshPrices(false);
    }, 60);
  };

  const handleDeleteGoal = (goalId: string) => {
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;

    setConfirmState({
      isOpen: true,
      title: `Remover ${goal.name}?`,
      message: `Deseja excluir a meta de ${goal.name} e seu histórico mensal?`,
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        updateAndPersist((prev) => {
          const remaining = prev.goals.filter((g) => g.id !== goalId);
          return {
            ...prev,
            goals: remaining,
            selectedGoalId: remaining[0] ? remaining[0].id : ''
          };
        });
        showToast(`${goal.symbol} removido.`, 'info');
      }
    });
  };

  const handleUpdateRetirementPrice = (goalId: string, valDisplay: number) => {
    const fx = getEffectiveUsdtBrlRate(state);
    const usdVal = Number.isNaN(valDisplay) || valDisplay < 0 ? 0 : convertToUSD(valDisplay, state.currency, fx);

    updateAndPersist((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === goalId ? { ...g, retirementTargetPriceUSD: usdVal } : g))
    }));
  };

  const handleUpdateRetirementGoal = (valDisplay: number) => {
    const fx = getEffectiveUsdtBrlRate(state);
    const usdVal = Number.isNaN(valDisplay) || valDisplay < 0 ? 0 : convertToUSD(valDisplay, state.currency, fx);

    updateAndPersist((prev) => ({
      ...prev,
      retirementGoalUSD: usdVal
    }));
  };

  const handleUpdateMonthlyRecordNumber = (
    goalId: string,
    monthIndex: number,
    field: 'boughtQty' | 'pricePaid',
    numValue: number
  ) => {
    const cleanVal = Number.isNaN(numValue) || numValue < 0 ? 0 : numValue;
    const fx = getEffectiveUsdtBrlRate(state);

    updateAndPersist((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId || !g.monthlyRecords[monthIndex]) return g;
        const recs = g.monthlyRecords.map((r, idx) => {
          if (idx !== monthIndex) return r;
          if (field === 'boughtQty') {
            const autoPrice =
              cleanVal > 0 && r.pricePaidUSD === 0 ? Number(prev.pricesUSD[g.symbol]) || 0 : r.pricePaidUSD;
            const autoFx = cleanVal > 0 && r.pricePaidUSD === 0 ? fx : r.fxRateBRL;
            return { ...r, boughtQty: cleanVal, pricePaidUSD: autoPrice, fxRateBRL: autoFx };
          }
          return { ...r, pricePaidUSD: convertToUSD(cleanVal, prev.currency, fx) };
        });
        return { ...g, monthlyRecords: recs };
      })
    }));
  };

  const handleQuickCompleteMonth = (goalId: string, monthIndex: number, plannedQty: number) => {
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;
    const liveUSD = Number(state.pricesUSD[goal.symbol]) || 0;
    const fx = getEffectiveUsdtBrlRate(state);

    updateAndPersist((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId || !g.monthlyRecords[monthIndex]) return g;
        const recs = g.monthlyRecords.map((r, idx) =>
          idx === monthIndex
            ? {
                ...r,
                boughtQty: Number(Number(plannedQty).toFixed(4)),
                pricePaidUSD: r.pricePaidUSD > 0 ? r.pricePaidUSD : liveUSD,
                fxRateBRL: fx
              }
            : r
        );
        return { ...g, monthlyRecords: recs };
      })
    }));
    showToast(`Mês ${monthIndex + 1} registrado (${formatCryptoQty(plannedQty, goal.symbol)})!`, 'success');
  };

  const handleAutoFillNextEmptyMonth = (goalId: string) => {
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;

    const emptyIdx = goal.monthlyRecords.findIndex((r) => !r.boughtQty || r.boughtQty <= 0);
    if (emptyIdx === -1) {
      showToast('Todos os meses já possuem compras registradas!', 'info');
      return;
    }

    const fx = getEffectiveUsdtBrlRate(state);
    const m = calculateGoalMetrics(goal, state.pricesUSD, fx);

    updateAndPersist((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const recs = g.monthlyRecords.map((r, idx) =>
          idx === emptyIdx
            ? {
                ...r,
                boughtQty: Number(m.baseMonthlyTargetQty.toFixed(4)),
                pricePaidUSD: m.currentPriceUSD,
                fxRateBRL: fx
              }
            : r
        );
        return { ...g, monthlyRecords: recs };
      })
    }));

    showToast(`Mês ${emptyIdx + 1} registrado (${formatCryptoQty(m.baseMonthlyTargetQty, goal.symbol)})!`, 'success');
  };

  // Handlers Conversor
  const handleToggleConverterDirection = () => {
    updateAndPersist((prev) => ({
      ...prev,
      converter: {
        ...prev.converter,
        direction: prev.converter.direction === 'BRL_TO_USDT' ? 'USDT_TO_BRL' : 'BRL_TO_USDT'
      }
    }));
  };

  const handleUpdateConverterField = (field: keyof ConverterState, value: string | number) => {
    updateAndPersist((prev) => {
      const nextConv = { ...prev.converter };
      if (field === 'targetSymbol') {
        nextConv.targetSymbol = String(value);
      } else if (field === 'targetGoalId') {
        const gid = String(value);
        nextConv.targetGoalId = gid;
        nextConv.targetMonthIndex = 0;
        const g = prev.goals.find((item) => item.id === gid);
        if (g) nextConv.targetSymbol = g.symbol;
      } else if (field === 'targetMonthIndex') {
        nextConv.targetMonthIndex = parseInt(String(value), 10) || 0;
      } else if (field !== 'direction') {
        const val = parseFloat(String(value));
        nextConv[field] = Number.isNaN(val) || val < 0 ? 0 : val;
      }
      return { ...prev, converter: nextConv };
    });
  };

  const handleSetPresetBRL = (val: number) => {
    updateAndPersist((prev) => ({
      ...prev,
      converter: { ...prev.converter, direction: 'BRL_TO_USDT', amountBRL: val }
    }));
  };

  const handleSetPresetUSDT = (val: number) => {
    updateAndPersist((prev) => ({
      ...prev,
      converter: { ...prev.converter, direction: 'USDT_TO_BRL', amountUSDT: val }
    }));
  };

  const handleSendMonthlyUsdToConverter = (amountUSD: number) => {
    const cleanVal = Number(Math.max(0, amountUSD).toFixed(2));
    updateAndPersist((prev) => ({
      ...prev,
      mainTab: 'CONVERTER',
      converter: {
        ...prev.converter,
        direction: 'USDT_TO_BRL',
        amountUSDT: cleanVal
      }
    }));
  };

  const handleToggleManualFx = (checked: boolean) => {
    updateAndPersist((prev) => ({
      ...prev,
      manualFxOverride: checked,
      manualUsdtBrlRate:
        checked && (!prev.manualUsdtBrlRate || prev.manualUsdtBrlRate <= 0)
          ? prev.usdtBrlRate
          : prev.manualUsdtBrlRate
    }));
  };

  const handleUpdateManualFxValue = (rawVal: string) => {
    const val = parseFloat(rawVal);
    if (!Number.isNaN(val) && val > 0) {
      updateAndPersist((prev) => ({ ...prev, manualUsdtBrlRate: val }));
    }
  };

  const handleApplyConversionToSchedule = () => {
    const c = state.converter;
    const goal = state.goals.find((g) => g.id === c.targetGoalId) || state.goals[0];
    if (!goal) return;

    const spotFx = getEffectiveUsdtBrlRate(state);
    const res = calculateConverterResults(c, spotFx, state.pricesUSD);
    const livePriceUSD = Number(state.pricesUSD[goal.symbol]) || 0;

    if (livePriceUSD <= 0) {
      showToast(`Cotação de ${goal.symbol}/USDT indisponível.`, 'error');
      return;
    }

    const qtyBought = res.netUSDT / livePriceUSD;
    const idx = Math.min(goal.monthlyRecords.length - 1, Math.max(0, c.targetMonthIndex));

    updateAndPersist((prev) => ({
      ...prev,
      mainTab: 'DCA',
      selectedGoalId: goal.id,
      goals: prev.goals.map((g) => {
        if (g.id !== goal.id) return g;
        const recs = g.monthlyRecords.map((r, rIdx) =>
          rIdx === idx
            ? {
                ...r,
                boughtQty: Number(qtyBought.toFixed(4)),
                pricePaidUSD: livePriceUSD,
                fxRateBRL: res.effectiveFxRate
              }
            : r
        );
        return { ...g, monthlyRecords: recs };
      })
    }));

    showToast(
      `Lançado ${formatCryptoQty(qtyBought, goal.symbol)} (${formatUSDT(res.netUSDT)}) no Mês ${idx + 1}!`,
      'success'
    );
  };

  const handleUpdateCycleMultiplier = (val: number) => {
    updateAndPersist((prev) => ({
      ...prev,
      cycleMultiplier: !Number.isNaN(val) && val >= 1 ? val : 1.0
    }));
  };

  const handleExportCSV = () => {
    const ok = downloadCSVReport(state);
    showToast(ok ? 'Planilha CSV exportada!' : 'Erro ao exportar planilha CSV.', ok ? 'success' : 'error');
  };

  const handleExportJSON = () => {
    const ok = downloadJSONBackup(state);
    showToast(
      ok ? 'Backup JSON exportado!' : 'Não foi possível baixar o arquivo neste navegador.',
      ok ? 'success' : 'error'
    );
  };

  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result || '')) as Partial<AppState>;
        if (parsed && Array.isArray(parsed.goals)) {
          const normalized = normalizeLoadedState(parsed);
          updateAndPersist(() => normalized);
          showToast('Backup importado com sucesso!', 'success');
        } else {
          showToast('Arquivo JSON inválido.', 'error');
        }
      } catch {
        showToast('Erro ao processar arquivo JSON.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleOpenResetModal = () => {
    setConfirmState({
      isOpen: true,
      title: 'Restaurar Exemplo Padrão?',
      message: 'Isso restaurará as metas iniciais em USDT (10.000 Polygon de Dez/26 a Dez/27 + BNB). Continuar?',
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        updateAndPersist((prev) => {
          const defaultGoals = getDefaultGoals(getEffectiveUsdtBrlRate(prev));
          return {
            ...prev,
            goals: defaultGoals,
            selectedGoalId: defaultGoals[0].id,
            mainTab: 'DCA',
            currency: 'USDT',
            retirementGoalUSD: 100000
          };
        });
        showToast('Exemplo padrão restaurado!', 'success');
      }
    });
  };

  const editingGoal = editingGoalId ? state.goals.find((g) => g.id === editingGoalId) || null : null;
  const fxRate = getEffectiveUsdtBrlRate(state);

  const navTabs: Array<{ id: MainTab; label: string; badge: string | null; icon: React.ReactNode }> = [
    {
      id: 'DCA',
      label: 'Planejador DCA',
      badge: String(state.goals.length),
      icon: <ClipboardList className="w-4 h-4" />
    },
    {
      id: 'CONVERTER',
      label: 'Conversor USDT ↔ BRL',
      badge: null,
      icon: <ArrowRightLeft className="w-4 h-4" />
    },
    {
      id: 'CHARTS',
      label: 'Simulador & Portfólio',
      badge: null,
      icon: <PieChart className="w-4 h-4" />
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-100">
      <Header
        state={state}
        isSyncing={isSyncing}
        user={user}
        authReady={authReady}
        cloudStatus={cloudStatus}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
        onManualCloudSync={handleManualCloudSync}
        onSetCurrency={handleSetCurrency}
        onRefreshPrices={() => handleRefreshPrices(true)}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onOpenResetModal={handleOpenResetModal}
        onTickerClick={handleTickerClick}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        <GlobalKPIs state={state} onUpdateRetirementGoal={handleUpdateRetirementGoal} />

        {/* Navegação Principal */}
        <section className="flex flex-wrap items-center justify-between gap-3 border-b border-red-950/60 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            {navTabs.map((tab) => {
              const active = state.mainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectMainTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-gradient-to-r from-[#D91E2A]/25 via-[#9E0F1B]/20 to-[#180a0e] text-white border border-[#E11D2E]/60 shadow-sm shadow-red-950/50'
                      : 'bg-[#120b0e]/85 text-slate-400 hover:text-white hover:bg-[#1b0e12] border border-slate-800/90'
                  }`}
                >
                  <span className={active ? 'text-[#ff4d5a]' : 'text-slate-400'}>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md tabular-nums ${
                        active ? 'bg-[#D91E2A] text-white' : 'bg-slate-950 text-slate-300'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => handleOpenGoalModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl spfc-gradient-btn text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-red-950/50 border border-white/10 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nova Meta Cripto</span>
          </button>
        </section>

        {/* Área de Conteúdo Dinâmico */}
        <div className="space-y-5">
          {state.mainTab === 'DCA' && (
            <DcaPlannerView
              state={state}
              onSelectGoal={handleSelectGoal}
              onOpenGoalModal={(id) => handleOpenGoalModal(id)}
              onDeleteGoal={handleDeleteGoal}
              onUpdateRetirementPrice={handleUpdateRetirementPrice}
              onUpdateMonthlyRecordNumber={handleUpdateMonthlyRecordNumber}
              onQuickCompleteMonth={handleQuickCompleteMonth}
              onAutoFillNextEmptyMonth={handleAutoFillNextEmptyMonth}
              onGoToConverter={() => handleSelectMainTab('CONVERTER')}
              onSendMonthlyUsdToConverter={handleSendMonthlyUsdToConverter}
            />
          )}

          {state.mainTab === 'CONVERTER' && (
            <ConverterView
              state={state}
              onToggleDirection={handleToggleConverterDirection}
              onUpdateField={handleUpdateConverterField}
              onSetPresetBRL={handleSetPresetBRL}
              onSetPresetUSDT={handleSetPresetUSDT}
              onToggleManualFx={handleToggleManualFx}
              onUpdateManualFxValue={handleUpdateManualFxValue}
              onApplyConversionToSchedule={handleApplyConversionToSchedule}
            />
          )}

          {state.mainTab === 'CHARTS' && (
            <ChartsRetirementView
              state={state}
              onSelectGoal={handleSelectGoal}
              onUpdateCycleMultiplier={handleUpdateCycleMultiplier}
              onUpdateRetirementGoal={handleUpdateRetirementGoal}
              onUpdateRetirementPrice={handleUpdateRetirementPrice}
            />
          )}
        </div>
      </main>

      <GoalModal
        isOpen={goalModalOpen}
        editingGoal={editingGoal}
        preselectSymbol={preselectSymbol}
        currency={state.currency}
        fxRate={fxRate}
        pricesUSD={state.pricesUSD}
        onClose={() => setGoalModalOpen(false)}
        onSave={handleSaveGoal}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}
