import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 border border-amber-400/50 px-3.5 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-sm"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Modo Offline — usando seus dados salvos em cache.</span>
    </div>
  );
};
