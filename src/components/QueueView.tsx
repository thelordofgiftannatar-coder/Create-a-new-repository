import React, { useState } from 'react';
import {
  ListStart,
  Play,
  Trash2,
  ArrowUp,
  Shuffle,
  Sparkles,
  Activity,
} from 'lucide-react';
import { Track } from '../types/music';
import { triggerHaptic } from '../services/audioEngine';
import { VisualizerCanvas } from './VisualizerCanvas';

interface QueueViewProps {
  queue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onRemoveFromQueue: (trackId: string) => void;
  onMoveToTop: (index: number) => void;
  onShuffleQueue: () => void;
  onClearQueue: () => void;
  onOpenAmbient: () => void;
}

export const QueueView: React.FC<QueueViewProps> = ({
  queue,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onRemoveFromQueue,
  onMoveToTop,
  onShuffleQueue,
  onClearQueue,
  onOpenAmbient,
}) => {
  const [showVisualizer, setShowVisualizer] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header + Visualizer / Ambient Quick Launch */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <ListStart className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-base font-bold text-white">Playing Queue</h2>
            <p className="text-[11px] text-slate-400">{queue.length} queued songs</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              setShowVisualizer((p) => !p);
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
              showVisualizer
                ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                : 'bg-white/10 text-cyan-300 border-white/15'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Visualizer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              onOpenAmbient();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-amber-300 text-xs font-semibold flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ambient</span>
          </button>
        </div>
      </div>

      {/* Expandable 4-Mode Real-Time Audio Visualizer Canvas */}
      {showVisualizer && (
        <div className="h-56 sm:h-72 w-full rounded-3xl overflow-hidden shadow-2xl border border-white/15">
          <VisualizerCanvas />
        </div>
      )}

      {/* Queue Actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(15);
            onShuffleQueue();
          }}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
        >
          <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
          <span>Shuffle Queue</span>
        </button>

        {queue.length > 0 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              onClearQueue();
            }}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-xs font-semibold text-slate-300 hover:text-red-300 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Queue</span>
          </button>
        )}
      </div>

      {/* Queue List */}
      <div className="space-y-2">
        {queue.length > 0 ? (
          queue.map((track, idx) => {
            const isCur = currentTrack?.id === track.id;
            return (
              <div
                key={`${track.id}-${idx}`}
                onClick={() => onSelectTrack(track)}
                className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 cursor-pointer backdrop-blur-xl transition ${
                  isCur
                    ? 'bg-cyan-950/50 border-cyan-400/60'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-[11px] font-mono text-slate-400 w-5 text-center">
                    {isCur && isPlaying ? '▶' : idx + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0">
                    <img
                      src={track.coverUrl || '/pwa-512x512.png'}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-bold truncate ${
                        isCur ? 'text-cyan-300' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{track.artist}</div>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => onMoveToTop(idx)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                      title="Play next (move to top)"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectTrack(track)}
                    className="p-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-white/10"
                    title="Play now"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFromQueue(track.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/10"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 bg-white/[0.04] rounded-2xl border border-white/5">
            Queue is empty. Tap any song, album, or folder to enqueue tracks.
          </div>
        )}
      </div>
    </div>
  );
};
