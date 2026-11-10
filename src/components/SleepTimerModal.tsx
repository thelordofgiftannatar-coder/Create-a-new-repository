import React, { useState, useEffect } from 'react';
import { Moon, X, Clock, Check, PowerOff } from 'lucide-react';
import { SleepTimerState } from '../types/music';
import { audioEngine, triggerHaptic } from '../services/audioEngine';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sleepTimer: SleepTimerState;
  onSetTimer: (timer: SleepTimerState) => void;
}

const PRESET_MINUTES = [15, 30, 45, 60, 90];

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  isOpen,
  onClose,
  sleepTimer,
  onSetTimer,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!sleepTimer.active || !sleepTimer.targetTimestamp) {
      setRemainingSeconds(null);
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((sleepTimer.targetTimestamp! - Date.now()) / 1000));
      setRemainingSeconds(diff);

      // Fade out volume in the last 20 seconds
      if (diff > 0 && diff <= 20) {
        audioEngine.setVolume(diff / 20);
      }

      if (diff <= 0) {
        audioEngine.pause();
        audioEngine.setVolume(1.0);
        onSetTimer({
          active: false,
          targetTimestamp: null,
          durationMinutes: 0,
          stopAtTrackEnd: false,
        });
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimer, onSetTimer]);

  if (!isOpen) return null;

  const startPresetTimer = (minutes: number) => {
    triggerHaptic(20);
    const target = Date.now() + minutes * 60 * 1000;
    onSetTimer({
      active: true,
      targetTimestamp: target,
      durationMinutes: minutes,
      stopAtTrackEnd: false,
    });
    onClose();
  };

  const startTrackEndTimer = () => {
    triggerHaptic(20);
    const currentPos = audioEngine.getCurrentTime();
    const duration = audioEngine.getDuration();
    const remainMs = Math.max(5000, (duration - currentPos) * 1000);

    onSetTimer({
      active: true,
      targetTimestamp: Date.now() + remainMs,
      durationMinutes: Math.round(remainMs / 60000),
      stopAtTrackEnd: true,
    });
    onClose();
  };

  const cancelTimer = () => {
    triggerHaptic(20);
    audioEngine.setVolume(1.0);
    onSetTimer({
      active: false,
      targetTimestamp: null,
      durationMinutes: 0,
      stopAtTrackEnd: false,
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#0f172a] border border-cyan-500/30 p-5 shadow-2xl text-slate-100">
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sleep Timer</h3>
              <p className="text-xs text-slate-400">Auto-stop with volume fade-out</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Timer Indicator */}
        {sleepTimer.active && remainingSeconds !== null && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-cyan-400 animate-pulse" />
              <div>
                <div className="text-xs text-slate-300">Audio stops in</div>
                <div className="text-xl font-bold font-mono text-cyan-300">
                  {formatTime(remainingSeconds)}
                </div>
              </div>
            </div>
            <button
              onClick={cancelTimer}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition flex items-center gap-1"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {/* Preset Minutes */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold text-slate-400 block mb-1">Select Duration</label>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_MINUTES.map((min) => {
              const isSelected = sleepTimer.active && sleepTimer.durationMinutes === min;
              return (
                <button
                  key={min}
                  onClick={() => startPresetTimer(min)}
                  className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-white/5 border-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm">{min} minutes</span>
                  {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                </button>
              );
            })}

            {/* End of Track option */}
            <button
              onClick={startTrackEndTimer}
              className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                sleepTimer.active && sleepTimer.stopAtTrackEnd
                  ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold'
                  : 'bg-white/5 border-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              <span className="text-sm">End of song</span>
              {sleepTimer.active && sleepTimer.stopAtTrackEnd && <Check className="w-4 h-4 text-purple-400" />}
            </button>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
