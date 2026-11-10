import React, { useRef, useEffect } from 'react';
import { Sliders, X, RotateCcw, Volume2, Sparkles, Waves } from 'lucide-react';
import { EqualizerSettings } from '../types/music';
import { EQ_PRESETS, audioEngine, triggerHaptic } from '../services/audioEngine';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EqualizerSettings;
  onUpdateSettings: (newSettings: EqualizerSettings) => void;
}

const BAND_LABELS = ['60 Hz', '250 Hz', '1 kHz', '4 kHz', '12 kHz'];
const BAND_ROLES = ['Sub-Bass', 'Punch', 'Vocals', 'Presence', 'Treble'];

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const curveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw EQ Curve on canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = curveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // 0dB center line
    const zeroY = height / 2;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();

    // +6dB and -6dB lines
    ctx.beginPath();
    ctx.moveTo(0, height * 0.25);
    ctx.lineTo(width, height * 0.25);
    ctx.moveTo(0, height * 0.75);
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();

    // Interpolate 5 bands to draw a smooth curve
    const bandPoints = settings.bands.map((gain, index) => {
      const x = (index / (BAND_LABELS.length - 1)) * (width - 40) + 20;
      // map -12dB..+12dB to height..0
      const y = zeroY - (gain / 12) * (height * 0.4);
      return { x, y };
    });

    if (bandPoints.length > 0) {
      // Glow curve
      ctx.beginPath();
      ctx.moveTo(0, bandPoints[0].y);

      for (let i = 0; i < bandPoints.length - 1; i++) {
        const p0 = bandPoints[i];
        const p1 = bandPoints[i + 1];
        const midX = (p0.x + p1.x) / 2;
        ctx.bezierCurveTo(midX, p0.y, midX, p1.y, p1.x, p1.y);
      }
      ctx.lineTo(width, bandPoints[bandPoints.length - 1].y);

      ctx.strokeStyle = settings.enabled ? '#06b6d4' : '#64748b';
      ctx.lineWidth = 3;
      ctx.shadowColor = settings.enabled ? '#06b6d4' : 'transparent';
      ctx.shadowBlur = settings.enabled ? 10 : 0;
      ctx.stroke();

      // Under-curve gradient
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
      fillGrad.addColorStop(0, settings.enabled ? 'rgba(6, 182, 212, 0.25)' : 'rgba(100, 116, 139, 0.1)');
      fillGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Draw points
      bandPoints.forEach((pt) => {
        ctx.fillStyle = settings.enabled ? '#38bdf8' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleBandChange = (index: number, val: number) => {
    const updated = [...settings.bands];
    updated[index] = val;
    const newSettings: EqualizerSettings = {
      ...settings,
      bands: updated,
      preset: 'custom',
    };
    onUpdateSettings(newSettings);
    audioEngine.applyEqualizer(newSettings);
  };

  const handlePresetChange = (presetKey: string) => {
    triggerHaptic(15);
    const p = EQ_PRESETS[presetKey];
    if (p) {
      const newSettings: EqualizerSettings = {
        ...settings,
        bands: [...p.bands],
        bassBoost: p.bassBoost,
        surround: p.surround,
        preset: presetKey,
      };
      onUpdateSettings(newSettings);
      audioEngine.applyEqualizer(newSettings);
    }
  };

  const handleToggleEnabled = () => {
    triggerHaptic(20);
    const newSettings: EqualizerSettings = {
      ...settings,
      enabled: !settings.enabled,
    };
    onUpdateSettings(newSettings);
    audioEngine.applyEqualizer(newSettings);
  };

  const handleBassBoostChange = (val: number) => {
    const newSettings: EqualizerSettings = {
      ...settings,
      bassBoost: val,
      preset: 'custom',
    };
    onUpdateSettings(newSettings);
    audioEngine.applyEqualizer(newSettings);
  };

  const handleSurroundToggle = () => {
    triggerHaptic(15);
    const newSettings: EqualizerSettings = {
      ...settings,
      surround: !settings.surround,
    };
    onUpdateSettings(newSettings);
    audioEngine.applyEqualizer(newSettings);
  };

  const handleReset = () => {
    triggerHaptic(20);
    handlePresetChange('flat');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0f172a] border border-cyan-500/30 p-5 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Top Drag bar / Header */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Equalizer & Audio FX</h2>
              <p className="text-xs text-slate-400">5-band hardware tuning</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Master EQ toggle */}
            <button
              onClick={handleToggleEnabled}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                settings.enabled
                  ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/25'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${settings.enabled ? 'bg-black' : 'bg-slate-500'}`} />
              {settings.enabled ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* EQ Curve Display */}
        <div className="mt-4 bg-[#090d16] rounded-2xl p-3 border border-white/5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 px-1">
            <span>+12 dB</span>
            <span className="font-mono text-cyan-400 font-semibold uppercase">{settings.preset}</span>
            <span>-12 dB</span>
          </div>
          <canvas ref={curveCanvasRef} width={400} height={90} className="w-full h-20 block" />
        </div>

        {/* Presets Horizontal Selector */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-300 block mb-2">Presets</label>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {Object.keys(EQ_PRESETS).map((key) => {
              const active = settings.preset === key;
              return (
                <button
                  key={key}
                  onClick={() => handlePresetChange(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition font-medium border ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-sm'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                  }`}
                >
                  {EQ_PRESETS[key].name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5-Band Vertical Sliders */}
        <div className="mt-4 bg-white/5 rounded-2xl p-4 border border-white/5">
          <div className="grid grid-cols-5 gap-2 text-center">
            {BAND_LABELS.map((freqLabel, i) => {
              const gain = settings.bands[i] || 0;
              return (
                <div key={freqLabel} className="flex flex-col items-center">
                  <span className="text-[10px] font-mono text-cyan-300 font-bold mb-1">
                    {gain > 0 ? `+${gain}` : gain}dB
                  </span>

                  {/* Vertical Range Slider */}
                  <div className="relative h-32 flex items-center justify-center my-1">
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={gain}
                      disabled={!settings.enabled}
                      onChange={(e) => handleBandChange(i, Number(e.target.value))}
                      className="h-28 w-2 appearance-none bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
                      style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                      }}
                    />
                  </div>

                  <span className="text-xs font-bold text-white mt-1">{freqLabel}</span>
                  <span className="text-[9px] text-slate-400">{BAND_ROLES[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sound Enhancements: Bass Boost & 3D Spatial */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Bass Boost */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                Bass Booster
              </span>
              <span className="text-xs font-mono text-cyan-300">{settings.bassBoost}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.bassBoost}
              disabled={!settings.enabled}
              onChange={(e) => handleBassBoostChange(Number(e.target.value))}
              className="w-full accent-cyan-400 disabled:opacity-40"
            />
          </div>

          {/* 3D Spatial Surround */}
          <div
            onClick={() => settings.enabled && handleSurroundToggle()}
            className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
              settings.surround && settings.enabled
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-white/5 border-white/5 text-slate-400'
            } ${!settings.enabled ? 'opacity-40 pointer-events-none' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-purple-400" />
                3D Surround
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.surround && settings.enabled ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              {settings.surround ? 'Spatial Widener Active' : 'Headphone standard'}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-white/10">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Flat</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 active:scale-95 transition"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
