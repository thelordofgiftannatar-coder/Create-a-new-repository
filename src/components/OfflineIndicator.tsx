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
      className="fixed bottom-24 left-3 z-30 flex items-center gap-2 rounded-xl bg-amber-500/90 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-black shadow-lg border border-amber-300/60"
    >
      <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Offline Mode — Cached app &amp; local audio active</span>
    </div>
  );
};
