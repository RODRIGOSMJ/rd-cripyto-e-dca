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
  LogOut
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppState, CurrencyMode } from '../types';
import { SUPPORTED_CRYPTOS } from '../constants';
import { formatBRL, formatMoney, formatUSDT, getEffectiveUsdtBrlRate } from '../utils/calculations';

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
  onTickerClick
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

  return (
    <header className="sticky top-0 z-40 bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-800/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Marca */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-extrabold text-xs tracking-tight">
            RG
          </div>
          <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap">
            RG Crypto <span className="text-emerald-400">DCA</span>
          </h1>
        </div>

        {/* Controles compactos */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status real da API + Câmbio */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] whitespace-nowrap shrink-0">
            <span className="relative flex h-2 w-2">
              <span
                className={
                  state.isLiveConnected
                    ? 'live-dot relative inline-flex rounded-full h-2 w-2 bg-emerald-500'
                    : 'relative inline-flex rounded-full h-2 w-2 bg-amber-500'
                }
              />
            </span>
            <span className="text-slate-300 font-medium hidden md:inline">
              {state.isLiveConnected ? state.priceSource : 'Offline'}
            </span>
            <span className="text-emerald-400 font-mono font-semibold tabular-nums md:border-l md:border-slate-800 md:pl-2">
              1 USDT = R$ {fxRate.toFixed(2).replace('.', ',')}
              {state.manualFxOverride ? ' [Trava]' : ''}
            </span>
          </div>

          {/* Seletor 3 Modos */}
          <div
            className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 shrink-0"
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
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Firebase Cloud Sync / Login Google */}
          <div className="relative" ref={cloudDropdownRef}>
            {!user ? (
              <button
                type="button"
                disabled={!authReady}
                onClick={onSignInGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-xs font-bold text-sky-300 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Salvar no Firebase</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCloudMenuOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
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
                  <span className="hidden sm:inline">
                    {cloudStatus === 'syncing'
                      ? 'Salvando...'
                      : cloudStatus === 'loading'
                        ? 'Carregando...'
                        : cloudStatus === 'error'
                          ? 'Erro nuvem'
                          : firstName}
                  </span>
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
              <div className="absolute right-0 mt-2 w-60 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1.5 z-50 text-xs">
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

      {/* Ticker Compacto */}
      <div className="bg-slate-950/80 border-t border-slate-800/60 py-1.5 px-4 sm:px-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-[11px] whitespace-nowrap">
          {tickerAssets.map((asset) => {
            const pUSD = Number(state.pricesUSD[asset.symbol]) || 0;
            const hasGoal = state.goals.some((g) => g.symbol === asset.symbol);
            return (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => onTickerClick(asset.symbol)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors shrink-0 whitespace-nowrap ${
                  hasGoal
                    ? 'bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: asset.color }} />
                <span className="font-bold text-slate-200">{asset.symbol}</span>
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
