import React from 'react';
import { Sparkles, X, Play, Square, CloudRain, Disc, Radio, Eye } from 'lucide-react';
import { audioEngine, triggerHaptic } from '../services/audioEngine';
import { VisualizerCanvas } from './VisualizerCanvas';

interface AmbientGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActiveStateChange: () => void;
}

const PRESETS = [
  {
    id: 'rain-chords' as const,
    title: 'Lofi Rain & Warm Chords',
    desc: 'Harmonic jazz minor 7th chords with gentle acoustic filter sweep.',
    icon: CloudRain,
    color: 'from-blue-500/20 to-cyan-500/20 border-cyan-500/30 text-cyan-300',
  },
  {
    id: 'binaural-432' as const,
    title: '432Hz Deep Focus Pulse',
    desc: 'Binaural harmonic waves tuned to 432Hz for meditation and studying.',
    icon: Disc,
    color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300',
  },
  {
    id: 'space-drone' as const,
    title: 'Celestial Deep Void',
    desc: 'Low-frequency resonant cosmic drone for deep sleep and decompression.',
    icon: Radio,
    color: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-300',
  },
  {
    id: 'lofi-warmth' as const,
    title: 'Midnight Nostalgia Pad',
    desc: 'Analog polyphonic chords with subtle frequency detuning.',
    icon: Sparkles,
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300',
  },
];

export const AmbientGeneratorModal: React.FC<AmbientGeneratorModalProps> = ({
  isOpen,
  onClose,
  onActiveStateChange,
}) => {
  if (!isOpen) return null;

  const active = audioEngine.isAmbientActive();
  const currentMode = audioEngine.getAmbientMode();

  const handleSelectMode = (mode: 'rain-chords' | 'binaural-432' | 'space-drone' | 'lofi-warmth') => {
    triggerHaptic(20);
    if (active && currentMode === mode) {
      audioEngine.stopSynth();
    } else {
      audioEngine.startAmbientGenerator(mode);
    }
    onActiveStateChange();
  };

  const handleStop = () => {
    triggerHaptic(20);
    audioEngine.stopSynth();
    onActiveStateChange();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#0f172a] border border-cyan-500/30 p-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ambient Soundscapes</h2>
              <p className="text-xs text-slate-400">100% offline Web Audio generator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Visualizer preview */}
        {active && (
          <div className="mt-4">
            <div className="h-24 w-full rounded-2xl overflow-hidden border border-cyan-500/30">
              <VisualizerCanvas compact />
            </div>
          </div>
        )}

        {/* Preset soundscape cards */}
        <div className="mt-4 space-y-2.5">
          {PRESETS.map((p) => {
            const isThisPlaying = active && currentMode === p.id;
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectMode(p.id)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between group ${
                  isThisPlaying
                    ? 'bg-gradient-to-r ' + p.color + ' ring-1 ring-cyan-400'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      isThisPlaying ? 'bg-cyan-500 text-black' : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{p.title}</span>
                      {isThisPlaying && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{p.desc}</div>
                  </div>
                </div>

                <button
                  aria-label={isThisPlaying ? 'Stop' : 'Play'}
                  className={`p-2 rounded-xl transition ${
                    isThisPlaying ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-white/5 text-slate-300 group-hover:text-white'
                  }`}
                >
                  {isThisPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
              </div>
            );
          })}
        </div>

        {active && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleStop}
              className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Ambient Sound</span>
            </button>
          </div>
        )}

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
