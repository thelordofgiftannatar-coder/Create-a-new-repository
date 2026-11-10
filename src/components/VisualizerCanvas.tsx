import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Sparkles, Activity, Disc, Radio } from 'lucide-react';
import { audioEngine, triggerHaptic } from '../services/audioEngine';
import { VisualizerMode } from '../types/music';

interface VisualizerCanvasProps {
  className?: string;
  compact?: boolean;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ className = '', compact = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('neon-bars');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  // Peak bars memory for smooth drop-off
  const peaksRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const freqData = new Uint8Array(128);
    const timeData = new Uint8Array(128);

    const resize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Particle system state for galaxy mode
    const particles: { x: number; y: number; vx: number; vy: number; radius: number; hue: number; alpha: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 2 + 1,
        hue: 180 + Math.random() * 100,
        alpha: Math.random(),
      });
    }

    let rotationAngle = 0;

    const render = () => {
      audioEngine.getFrequencyData(freqData);
      audioEngine.getTimeDomainData(timeData);

      const width = containerRef.current?.clientWidth || 300;
      const height = containerRef.current?.clientHeight || 150;

      ctx.clearRect(0, 0, width, height);

      // Average bass intensity (first 10 bins)
      let bassSum = 0;
      for (let i = 0; i < 10; i++) bassSum += freqData[i];
      const bassAvg = bassSum / 10 / 255; // 0 to 1

      if (mode === 'neon-bars') {
        // Neon frequency bars
        const barCount = compact ? 24 : 40;
        const barWidth = (width / barCount) * 0.7;
        const gap = (width / barCount) * 0.3;

        if (peaksRef.current.length !== barCount) {
          peaksRef.current = new Array(barCount).fill(0);
        }

        for (let i = 0; i < barCount; i++) {
          const sampleIndex = Math.floor((i / barCount) * 64);
          const rawVal = freqData[sampleIndex] || 0;
          const barHeight = Math.max(4, (rawVal / 255) * (height * 0.85));

          // Peak fall-off
          if (barHeight > peaksRef.current[i]) {
            peaksRef.current[i] = barHeight;
          } else {
            peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 1.5);
          }

          const x = i * (barWidth + gap) + gap / 2;
          const y = height - barHeight;

          // Gradient bar
          const grad = ctx.createLinearGradient(0, height, 0, y);
          grad.addColorStop(0, '#06b6d4'); // Cyan
          grad.addColorStop(0.6, '#3b82f6'); // Blue
          grad.addColorStop(1, '#a855f7'); // Purple

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
          ctx.fill();

          // Peak dot
          const peakY = height - peaksRef.current[i] - 3;
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(x, Math.max(2, peakY), barWidth, 2);
        }
      } else if (mode === 'circular-wave') {
        // Circular Pulsing Visualizer
        const cx = width / 2;
        const cy = height / 2;
        const baseRadius = Math.min(width, height) * 0.22 + bassAvg * 15;
        const points = 48;

        rotationAngle += 0.008;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotationAngle);

        // Center glowing circle
        const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius);
        centerGrad.addColorStop(0, `rgba(6, 182, 212, ${0.4 + bassAvg * 0.4})`);
        centerGrad.addColorStop(1, 'rgba(139, 92, 246, 0.05)');
        ctx.fillStyle = centerGrad;
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing spikes
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const sampleIndex = Math.floor(((i % points) / points) * 40);
          const amp = ((freqData[sampleIndex] || 0) / 255) * (Math.min(width, height) * 0.22);
          const r = baseRadius + amp;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 12;
        ctx.stroke();

        ctx.restore();
      } else if (mode === 'liquid-wave') {
        // Smooth Oscilloscope Liquid Wave
        ctx.beginPath();
        const sliceWidth = width / (timeData.length - 1);
        let x = 0;

        for (let i = 0; i < timeData.length; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.stroke();

        // Secondary soft glow wave
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        const waveGrad = ctx.createLinearGradient(0, 0, 0, height);
        waveGrad.addColorStop(0, 'rgba(6, 182, 212, 0.15)');
        waveGrad.addColorStop(1, 'rgba(147, 51, 234, 0.0)');
        ctx.fillStyle = waveGrad;
        ctx.fill();
      } else if (mode === 'galaxy-particles') {
        // Galaxy particle explosion
        const cx = width / 2;
        const cy = height / 2;

        particles.forEach((p) => {
          // Push particles on bass
          p.x += p.vx * (1 + bassAvg * 3);
          p.y += p.vy * (1 + bassAvg * 3);

          if (Math.hypot(p.x, p.y) > Math.min(width, height) * 0.45) {
            p.x = (Math.random() - 0.5) * 10;
            p.y = (Math.random() - 0.5) * 10;
          }

          ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${0.3 + bassAvg * 0.7})`;
          ctx.beginPath();
          ctx.arc(cx + p.x, cy + p.y, p.radius * (1 + bassAvg * 1.5), 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mode, compact]);

  const toggleFullscreen = () => {
    triggerHaptic(20);
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#0c1220] to-[#080c14] border border-cyan-500/20 shadow-inner flex flex-col justify-between ${className} ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen rounded-none' : ''
      }`}
    >
      {/* Top Header / Mode Switcher */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-1 p-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => {
              triggerHaptic(10);
              setMode('neon-bars');
            }}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition ${
              mode === 'neon-bars' ? 'bg-cyan-500/30 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
            }`}
            title="Neon Bars"
          >
            <Activity className="w-3.5 h-3.5" />
            {!compact && <span>Bars</span>}
          </button>
          <button
            onClick={() => {
              triggerHaptic(10);
              setMode('circular-wave');
            }}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition ${
              mode === 'circular-wave' ? 'bg-cyan-500/30 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
            }`}
            title="Circular Wave"
          >
            <Disc className="w-3.5 h-3.5" />
            {!compact && <span>Pulse</span>}
          </button>
          <button
            onClick={() => {
              triggerHaptic(10);
              setMode('liquid-wave');
            }}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition ${
              mode === 'liquid-wave' ? 'bg-cyan-500/30 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
            }`}
            title="Liquid Wave"
          >
            <Radio className="w-3.5 h-3.5" />
            {!compact && <span>Wave</span>}
          </button>
          <button
            onClick={() => {
              triggerHaptic(10);
              setMode('galaxy-particles');
            }}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition ${
              mode === 'galaxy-particles' ? 'bg-cyan-500/30 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
            }`}
            title="Galaxy Particles"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {!compact && <span>Galaxy</span>}
          </button>
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white hover:bg-black/60 transition"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Visualizer'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Real-time Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {isFullscreen && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
          {audioEngine.currentTrack ? `${audioEngine.currentTrack.title} · ${audioEngine.currentTrack.artist}` : 'Prime One Visualizer'}
        </div>
      )}
    </div>
  );
};
