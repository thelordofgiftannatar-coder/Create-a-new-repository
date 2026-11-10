import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Lock, ChevronUp } from 'lucide-react';
import { Track } from '../types/music';
import { audioEngine, triggerHaptic } from '../services/audioEngine';
import { WaveformPreview } from './WaveformPreview';

interface LockScreenOverlayProps {
  isOpen: boolean;
  onUnlock: () => void;
  track: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const LockScreenOverlay: React.FC<LockScreenOverlayProps> = ({
  isOpen,
  onUnlock,
  track,
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
}) => {
  const [now, setNow] = useState(new Date());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => {
      setNow(new Date());
      const dur = audioEngine.getDuration();
      if (dur > 0) setProgress(audioEngine.getCurrentTime() / dur);
    }, 500);
    return () => clearInterval(t);
  }, [isOpen]);

  if (!isOpen || !track) return null;

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[65] bg-[#050811]/95 backdrop-blur-3xl text-white flex flex-col justify-between px-6 py-10 select-none pt-safe pb-safe">
      {/* Blurred album art backdrop */}
      {track.coverUrl && (
        <div
          className="absolute inset-0 -z-10 opacity-30 bg-cover bg-center blur-2xl scale-110"
          style={{ backgroundImage: `url(${track.coverUrl})` }}
        />
      )}

      {/* Clock Header */}
      <div className="text-center mt-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-300 mb-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Prime One Lock-Screen</span>
        </div>
        <div className="text-5xl font-extrabold tracking-tight font-mono">{timeStr}</div>
        <div className="text-xs text-slate-300 mt-1">{dateStr}</div>
      </div>

      {/* Original Artwork & Controls */}
      <div className="max-w-xs w-full mx-auto flex flex-col items-center">
        <div className="w-60 h-60 rounded-3xl overflow-hidden shadow-2xl border border-white/20 mb-6">
          <img
            src={track.coverUrl || '/pwa-512x512.png'}
            alt={track.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <h2 className="text-lg font-extrabold text-center truncate w-full">{track.title}</h2>
        <p className="text-xs text-slate-300 truncate w-full text-center mt-0.5">
          {track.artist} {track.album ? `• ${track.album}` : ''}
        </p>

        <div className="w-full mt-5">
          <WaveformPreview
            waveform={track.waveform}
            seed={track.id + track.title}
            progress={progress}
            isCurrent={true}
            isPlaying={isPlaying}
            barCount={40}
            height={24}
            onSeek={(ratio) => audioEngine.seek(ratio * (audioEngine.getDuration() || track.duration || 1))}
          />
        </div>

        <div className="flex items-center justify-center gap-6 mt-6">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              onPrev();
            }}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Previous track"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onTogglePlay();
            }}
            className="w-16 h-16 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-xl shadow-cyan-500/30 active:scale-95 transition"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              onNext();
            }}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Next track"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>
        </div>
      </div>

      {/* Unlock Button */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(15);
            onUnlock();
          }}
          className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white inline-flex items-center gap-2 min-h-[44px]"
        >
          <ChevronUp className="w-4 h-4" />
          <span>Unlock Player</span>
        </button>
      </div>
    </div>
  );
};
