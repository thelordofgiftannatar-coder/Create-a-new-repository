import React, { useMemo } from 'react';
import { generateRealisticWaveform } from '../services/curatedTracks';

interface WaveformPreviewProps {
  waveform?: number[];
  seed?: string;
  progress?: number; // 0 to 1 (current playback progress)
  isCurrent?: boolean;
  isPlaying?: boolean;
  barCount?: number;
  height?: number;
  className?: string;
  onSeek?: (ratio: number) => void;
  showDensityBadge?: boolean;
}

export const WaveformPreview: React.FC<WaveformPreviewProps> = ({
  waveform,
  seed = 'sonic-track',
  progress = 0,
  isCurrent = false,
  isPlaying = false,
  barCount = 32,
  height = 20,
  className = '',
  onSeek,
  showDensityBadge = false,
}) => {
  // Compute or resample waveform to exact barCount
  const bars = useMemo(() => {
    let source = waveform;
    if (!source || source.length === 0) {
      source = generateRealisticWaveform(seed, barCount);
    }

    if (source.length === barCount) {
      return source;
    }

    // Resample to target barCount
    const resampled: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const srcIdx = Math.floor((i / barCount) * source.length);
      resampled.push(source[srcIdx] ?? 0.3);
    }
    return resampled;
  }, [waveform, seed, barCount]);

  // Calculate audio density metrics
  const avgDensity = useMemo(() => {
    const sum = bars.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / bars.length) * 100);
  }, [bars]);

  const peakDensity = useMemo(() => {
    return Math.round(Math.max(...bars) * 100);
  }, [bars]);

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = clickX / rect.width;
    onSeek(ratio);
  };

  const progressClamped = Math.max(0, Math.min(1, progress));
  const activeBarIndex = isCurrent ? Math.floor(progressClamped * barCount) : -1;

  return (
    <div
      className={`relative flex items-center group ${onSeek ? 'cursor-pointer' : ''} ${className}`}
      style={{ height }}
      onClick={onSeek ? handlePointerDown : undefined}
      title={onSeek ? `Audio Density: ~${avgDensity}% (Tap to seek)` : `Audio Density: ~${avgDensity}%`}
    >
      {/* Bars container */}
      <div className="w-full h-full flex items-center justify-between gap-[2px]">
        {bars.map((amp, index) => {
          const isPassed = isCurrent && index <= activeBarIndex;
          const isHead = isCurrent && index === activeBarIndex;
          const barHeightPx = Math.max(3, Math.round(amp * height));

          return (
            <div
              key={index}
              className="relative flex-1 flex items-center justify-center h-full"
            >
              <div
                style={{ height: `${barHeightPx}px` }}
                className={`w-full max-w-[3px] rounded-full transition-colors duration-150 ${
                  isHead
                    ? 'bg-cyan-300 shadow-sm shadow-cyan-400 scale-y-110'
                    : isPassed
                    ? 'bg-cyan-400/90'
                    : isCurrent
                    ? 'bg-slate-600/80 group-hover:bg-slate-500'
                    : 'bg-slate-600/40 group-hover:bg-cyan-500/30'
                }`}
              />

              {/* Glowing playhead dot */}
              {isHead && isPlaying && (
                <div
                  className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping pointer-events-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Optional Audio Density Badge */}
      {showDensityBadge && (
        <div className="absolute right-0 -bottom-3 text-[9px] font-mono text-slate-500 tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
          Peak {peakDensity}% • Avg {avgDensity}%
        </div>
      )}
    </div>
  );
};
