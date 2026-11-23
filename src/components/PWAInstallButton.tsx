import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Monitor,
  Share,
  Smartphone,
  X
} from 'lucide-react';
import { DevicePlatform, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onInstalledToast?: (msg: string) => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onInstalledToast }) => {
  const { isInstallable, isInstalled, platform, isInIframe, install } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DevicePlatform>(platform);
  const [copied, setCopied] = useState(false);

  // Se o aplicativo já estiver instalado e aberto em modo standalone, oculta o botão
  if (isInstalled) {
    return null;
  }

  const handlePrimaryClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        onInstalledToast?.('RG Crypto DCA instalado como aplicativo!');
      }
      return;
    }
    setActiveTab(platform);
    setModalOpen(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      onInstalledToast?.('Link do app copiado! Abra no Chrome ou Safari para instalar.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onInstalledToast?.('Copie o endereço da barra do navegador para abrir no celular.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePrimaryClick}
        title="Baixar App (Android, iPhone, Windows, Mac e Linux)"
        aria-label="Baixar aplicativo"
        className="p-2 rounded-lg spfc-gradient-btn text-white border border-white/15 shadow-sm shadow-red-950/60 transition-all shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="bg-[#120b0e] border border-red-950/80 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl shadow-red-950/50">
            <div className="h-[3px] w-full spfc-tricolor-stripe" aria-hidden="true" />

            <div className="p-5 space-y-4">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between gap-3 border-b border-red-950/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl spfc-gradient-btn ring-1 ring-white/20 flex items-center justify-center text-white font-extrabold text-xs shrink-0">
                    RG
                  </div>
                  <div>
                    <h3 id="pwa-install-title" className="text-base font-extrabold text-white">
                      Baixar RG Crypto DCA
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Instale como aplicativo em Android, iPhone, Windows, Mac ou Linux
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Fechar"
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Botão de instalação direta se o evento nativo ficar disponível */}
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) {
                      setModalOpen(false);
                      onInstalledToast?.('RG Crypto DCA instalado como aplicativo!');
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl spfc-gradient-btn text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-red-950/50"
                >
                  <Download className="w-4 h-4" />
                  <span>Instalar Agora (1 Clique)</span>
                </button>
              )}

              {/* Aviso útil quando aberto dentro de preview/iframe */}
              {isInIframe && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-2">
                  <p>
                    Para liberar o botão de instalação nativa no seu celular ou PC, abra o app diretamente no navegador:
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg spfc-gradient-btn text-white font-bold text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Abrir Direto no Navegador</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px]"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Seletor de Plataforma */}
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
                {(
                  [
                    { id: 'android', label: 'Android', icon: <Smartphone className="w-3.5 h-3.5" /> },
                    { id: 'ios', label: 'iPhone / iPad', icon: <Share className="w-3.5 h-3.5" /> },
                    { id: 'desktop', label: 'PC / Mac', icon: <Monitor className="w-3.5 h-3.5" /> }
                  ] as Array<{ id: DevicePlatform; label: string; icon: React.ReactNode }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                      activeTab === tab.id
                        ? 'spfc-gradient-btn text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Instruções por dispositivo */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 space-y-2.5">
                {activeTab === 'android' && (
                  <>
                    <div className="font-bold text-white">Instalar no Android (Chrome, Edge, Samsung, Brave)</div>
                    <ol className="space-y-1.5 list-decimal list-inside text-[12px] text-slate-300">
                      <li>
                        Abra o link do aplicativo no <strong className="text-white">Google Chrome</strong>.
                      </li>
                      <li>
                        Toque no botão <strong className="text-white">Baixar App</strong> no topo ou no menu{' '}
                        <strong className="text-white">⋮</strong> (canto superior direito).
                      </li>
                      <li>
                        Toque em <strong className="text-emerald-400">Instalar aplicativo</strong> ou{' '}
                        <strong className="text-emerald-400">Adicionar à tela inicial</strong>.
                      </li>
                    </ol>
                  </>
                )}

                {activeTab === 'ios' && (
                  <>
                    <div className="font-bold text-white">Instalar no iPhone / iPad (Safari)</div>
                    <ol className="space-y-1.5 list-decimal list-inside text-[12px] text-slate-300">
                      <li>
                        Abra este site no navegador <strong className="text-white">Safari</strong>.
                      </li>
                      <li>
                        Toque no botão <strong className="text-white">Compartilhar</strong>{' '}
                        <span className="inline-flex align-middle px-1 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px]">
                          ↑
                        </span>{' '}
                        na barra inferior.
                      </li>
                      <li>
                        Role para baixo e toque em{' '}
                        <strong className="text-emerald-400">Adicionar à Tela de Início</strong> e depois em{' '}
                        <strong className="text-white">Adicionar</strong>.
                      </li>
                    </ol>
                  </>
                )}

                {activeTab === 'desktop' && (
                  <>
                    <div className="font-bold text-white">Instalar no Windows, Mac ou Linux</div>
                    <ol className="space-y-1.5 list-decimal list-inside text-[12px] text-slate-300">
                      <li>
                        Abra o aplicativo no <strong className="text-white">Chrome</strong>,{' '}
                        <strong className="text-white">Edge</strong> ou <strong className="text-white">Brave</strong>.
                      </li>
                      <li>
                        Clique no ícone de <strong className="text-emerald-400">Instalar</strong> no canto direito da
                        barra de endereço (ou no menu → <strong className="text-white">Salvar e compartilhar → Instalar página como app</strong>).
                      </li>
                      <li>
                        O <strong className="text-white">RG Crypto DCA</strong> abrirá em janela própria como um app
                        nativo, com acesso rápido na área de trabalho e funcionamento offline.
                      </li>
                    </ol>
                  </>
                )}
              </div>

              {/* Ações inferiores */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {!isInIframe ? (
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Link Copiado' : 'Copiar Link'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">Funciona offline + Sync Firebase</span>
                )}

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
