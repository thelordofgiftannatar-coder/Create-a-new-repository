import React from 'react';
import { AlertTriangle, Trash2, UploadCloud, ShieldCheck, X } from 'lucide-react';
import { triggerHaptic } from '../services/audioEngine';

export interface ConfirmActionConfig {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'danger' | 'primary';
  details?: string[];
  onConfirm: () => Promise<void> | void;
}

interface ConfirmActionModalProps {
  config: ConfirmActionConfig | null;
  isBusy?: boolean;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  config,
  isBusy = false,
  onCancel,
}) => {
  if (!config) return null;

  const isDanger = config.variant === 'danger';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-[#111827] border border-white/15 p-5 shadow-2xl text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl ${
                isDanger
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              {isDanger ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <UploadCloud className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{config.title}</h3>
              <p className="text-[11px] text-slate-400">Google Account Action Confirmation</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-300 leading-relaxed">{config.description}</p>

        {config.details && config.details.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/10 max-h-32 overflow-y-auto space-y-1">
            {config.details.map((item, i) => (
              <div key={i} className="text-[11px] text-slate-300 font-mono truncate">
                • {item}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
          {isDanger ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          )}
          <span>
            {isDanger
              ? 'Files deleted from Google Drive may be moved to trash or removed permanently.'
              : 'Prime One only accesses files inside its folder or files you explicitly select.'}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              triggerHaptic(10);
              onCancel();
            }}
            className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={async () => {
              triggerHaptic(20);
              try {
                await config.onConfirm();
              } finally {
                onCancel();
              }
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
              isDanger
                ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
            } disabled:opacity-50`}
          >
            {isBusy ? 'Processing...' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
