import React, { useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Download,
  RotateCcw,
  Upload,
  Cloud,
  CloudCheck,
  CloudOff,
  Loader2,
  LogOut,
  Sparkles
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppState, CurrencyMode } from '../types';
import { SUPPORTED_CRYPTOS } from '../constants';
import { formatBRL, formatMoney, formatUSDT, getEffectiveUsdtBrlRate } from '../utils/calculations';
import { CryptoLogo } from './CryptoLogo';
import { PWAInstallButton } from './PWAInstallButton';

export type CloudSyncStatus = 'offline' | 'loading' | 'syncing' | 'saved' | 'error';

interface HeaderProps {
  state: AppState;
  isSyncing: boolean;
  user: User | null;
  authReady: boolean;
  cloudStatus: CloudSyncStatus;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onManualCloudSync: () => void;
  onSetCurrency: (mode: CurrencyMode) => void;
  onRefreshPrices: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onOpenResetModal: () => void;
  onTickerClick: (symbol: string) => void;
  onOpenAiReport: () => void;
  onNotify?: (message: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  isSyncing,
  user,
  authReady,
  cloudStatus,
  onSignInGoogle,
  onSignOutGoogle,
  onManualCloudSync,
  onSetCurrency,
  onRefreshPrices,
  onExportCSV,
  onExportJSON,
  onImportJSON,
  onOpenResetModal,
  onTickerClick,
  onOpenAiReport,
  onNotify
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cloudMenuOpen, setCloudMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cloudDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fxRate = getEffectiveUsdtBrlRate(state);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (cloudDropdownRef.current && !cloudDropdownRef.current.contains(e.target as Node)) {
        setCloudMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const tickerAssets = [...SUPPORTED_CRYPTOS.map((c) => ({ symbol: c.symbol, name: c.name, color: c.color }))];
  for (const g of state.goals) {
    if (!tickerAssets.some((a) => a.symbol === g.symbol)) {
      tickerAssets.push({ symbol: g.symbol, name: g.name, color: g.color || '#10b981' });
    }
  }

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Conta';
  const lastSyncTime = state.lastPriceUpdate
    ? new Date(state.lastPriceUpdate).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : null;

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#18070b]/95 via-[#0f090c]/95 to-[#18070b]/95 backdrop-blur-md border-b border-red-950/60">
      {/* Faixa Tricolor inspirada no São Paulo FC */}
      <div className="h-[3px] w-full spfc-tricolor-stripe" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Marca */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg spfc-gradient-btn ring-1 ring-white/20 shadow-md shadow-red-950/60 flex items-center justify-center text-white font-extrabold text-xs tracking-tight">
            RG
          </div>
          <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap">
            RG Crypto <span className="text-[#ff3b4a]">DCA</span>
          </h1>
        </div>

        {/* Controles compactos */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status real da API + Câmbio */}
          <div
            title={
              lastSyncTime
                ? `Fonte: ${state.priceSource} · 1 USDT = R$ ${fxRate.toFixed(4).replace('.', ',')} · Atualizado às ${lastSyncTime}`
                : `Fonte: ${state.priceSource}`
            }
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#120a0d] border border-red-950/70 text-[11px] whitespace-nowrap shrink-0"
          >
            <span className="relative flex h-2 w-2">
              <span
                className={
                  state.isLiveConnected
                    ? 'live-dot relative inline-flex rounded-full h-2 w-2 bg-emerald-500'
                    : 'relative inline-flex rounded-full h-2 w-2 bg-amber-500'
                }
              />
            </span>
            <span className="text-slate-200 font-medium hidden md:inline">
              {state.isLiveConnected ? state.priceSource : 'Offline'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono font-semibold tabular-nums md:border-l md:border-red-950/70 md:pl-2">
              <CryptoLogo symbol="USDT" size={14} />
              <span>
                1 USDT = R$ {fxRate.toFixed(2).replace('.', ',')}
                {state.manualFxOverride ? ' [Trava]' : ''}
              </span>
            </span>
          </div>

          {/* Seletor 3 Modos */}
          <div
            className="inline-flex rounded-lg bg-[#120a0d] p-0.5 border border-red-950/70 shrink-0"
            role="group"
            aria-label="Modo de exibição monetária"
          >
            {(
              [
                { id: 'USDT', label: '$ USDT' },
                { id: 'HYBRID', label: 'USDT + R$' },
                { id: 'BRL', label: 'R$ BRL' }
              ] as Array<{ id: CurrencyMode; label: string }>
            ).map((item) => {
              const active = state.currency === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSetCurrency(item.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                    active ? 'spfc-gradient-btn text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Botão Baixar App (PWA para Android, iOS, Windows, Mac e Linux) */}
          <PWAInstallButton onInstalledToast={onNotify} />

          {/* Firebase Cloud Sync / Login Google (somente ícone de nuvem) */}
          <div className="relative" ref={cloudDropdownRef}>
            {!user ? (
              <button
                type="button"
                disabled={!authReady}
                onClick={onSignInGoogle}
                title="Salvar dados na nuvem (Firebase)"
                aria-label="Salvar dados na nuvem (Firebase)"
                className="p-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 transition-colors shrink-0 disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCloudMenuOpen((prev) => !prev)}
                  title={
                    cloudStatus === 'syncing'
                      ? `Salvando no Firebase (${firstName})...`
                      : cloudStatus === 'loading'
                        ? `Carregando do Firebase (${firstName})...`
                        : cloudStatus === 'error'
                          ? `Erro na sincronização Firebase (${firstName})`
                          : `Firebase conectado (${firstName}) · Salvamento automático`
                  }
                  aria-label="Status da nuvem Firebase"
                  className={`p-2 rounded-lg border transition-colors shrink-0 ${
                    cloudStatus === 'error'
                      ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {cloudStatus === 'loading' || cloudStatus === 'syncing' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : cloudStatus === 'error' ? (
                    <CloudOff className="w-3.5 h-3.5" />
                  ) : (
                    <CloudCheck className="w-3.5 h-3.5" />
                  )}
                </button>

                {cloudMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-xs">
                    <div className="px-4 py-2 border-b border-slate-800">
                      <div className="font-bold text-white truncate">{user.displayName || 'Usuário Google'}</div>
                      <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                      <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                        {cloudStatus === 'syncing'
                          ? 'Sincronizando com Firebase...'
                          : cloudStatus === 'error'
                            ? 'Falha na última sincronização'
                            : 'Firebase conectado · Salvamento automático'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onManualCloudSync();
                        setCloudMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2 whitespace-nowrap"
                    >
                      <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Salvar tudo no Firebase agora</span>
                    </button>
                    <div className="border-t border-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        onSignOutGoogle();
                        setCloudMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-rose-950/60 text-rose-400 flex items-center gap-2 whitespace-nowrap"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Sair da conta Google</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Atualizar */}
          <button
            type="button"
            onClick={onRefreshPrices}
            title="Atualizar cotações agora"
            aria-label="Atualizar cotações agora"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {/* Menu Dados */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Dados</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#140b0e] border border-red-950/80 shadow-2xl py-1.5 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onOpenAiReport();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-red-950/40 text-white font-bold flex items-center gap-2.5 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#ff4d5a] shrink-0" />
                  <span>Relatório Completo IA + PDF</span>
                </button>
                <div className="border-t border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (user) {
                      onManualCloudSync();
                    } else {
                      onSignInGoogle();
                    }
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sky-300 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <Cloud className="w-3.5 h-3.5 shrink-0" />
                  <span>{user ? 'Sincronizar Firebase Agora' : 'Conectar Firebase (Google)'}</span>
                </button>
                <div className="border-t border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onExportCSV();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-200 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <span className="text-emerald-400 font-bold font-mono w-8">CSV</span>
                  <span>Exportar Planilha Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportJSON();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-200 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <span className="text-sky-400 font-bold font-mono w-8">JSON</span>
                  <span>Exportar Backup</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-200 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Importar Backup JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportJSON(file);
                      e.target.value = '';
                      setMenuOpen(false);
                    }
                  }}
                />
                <div className="border-t border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onOpenResetModal();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-rose-950/60 text-rose-400 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Restaurar Exemplo Padrão</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticker Compacto com Logos Oficiais */}
      <div className="bg-[#0a0709]/85 border-t border-red-950/50 py-1.5 px-4 sm:px-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-[11px] whitespace-nowrap">
          {tickerAssets.map((asset) => {
            const pUSD = Number(state.pricesUSD[asset.symbol]) || 0;
            const hasGoal = state.goals.some((g) => g.symbol === asset.symbol);
            return (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => onTickerClick(asset.symbol)}
                title={`${asset.name} (${asset.symbol})`}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors shrink-0 whitespace-nowrap ${
                  hasGoal
                    ? 'bg-[#190d11]/90 border border-red-900/50 hover:border-[#E11D2E]/70'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#170c10]'
                }`}
              >
                <CryptoLogo symbol={asset.symbol} color={asset.color} size={16} />
                <span className="font-bold text-slate-100">{asset.symbol}</span>
                <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                  {pUSD > 0 ? (
                    state.currency === 'HYBRID' ? (
                      <>
                        {formatUSDT(pUSD)}{' '}
                        <span className="text-slate-400 font-normal">({formatBRL(pUSD * fxRate)})</span>
                      </>
                    ) : (
                      formatMoney(pUSD, state.currency, fxRate)
                    )
                  ) : (
                    '--'
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
