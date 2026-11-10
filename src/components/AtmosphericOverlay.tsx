import React, { useEffect, useRef } from 'react';
import { OverlayEffectType } from '../types/themeLandscape';

interface AtmosphericOverlayProps {
  effect: OverlayEffectType;
  enabled: boolean;
  intensity?: number;
  accentHex?: string;
  secondaryHex?: string;
}

function hexToRgbTuple(hex?: string, fallback: [number, number, number] = [56, 189, 248]): [number, number, number] {
  if (!hex) return fallback;
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return fallback;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export const AtmosphericOverlay: React.FC<AtmosphericOverlayProps> = ({
  effect,
  enabled,
  intensity = 1.0,
  accentHex = '#38bdf8',
  secondaryHex = '#a855f7',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled || effect === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const safeIntensity = Math.max(0.2, Math.min(1.5, intensity));
    const [ar, ag, ab] = hexToRgbTuple(accentHex, [56, 189, 248]);
    const [sr, sg, sb] = hexToRgbTuple(secondaryHex, [168, 85, 247]);

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let tick = 0;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Particle {
      x: number;
      y: number;
      length?: number;
      speed?: number;
      speedX?: number;
      speedY?: number;
      opacity?: number;
      size?: number;
      radius?: number;
      hue?: number;
      vx?: number;
      vy?: number;
      alpha?: number;
      pulseSpeed?: number;
      fade?: number;
      char?: string;
      angle?: number;
      dist?: number;
    }

    const particles: Particle[] = [];
    const baseCount =
      effect === 'rain'
        ? 75
        : effect === 'sandstorm'
        ? 85
        : effect === 'embers' || effect === 'candles'
        ? 36
        : effect === 'fireflies'
        ? 28
        : effect === 'digital-rain'
        ? 32
        : effect === 'snow'
        ? 48
        : effect === 'portal'
        ? 44
        : 28;
    const count = Math.max(8, Math.round(baseCount * Math.min(1.4, safeIntensity)));

    for (let i = 0; i < count; i++) {
      if (effect === 'rain') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: Math.random() * 18 + 12,
          speed: Math.random() * 12 + 16,
          opacity: Math.random() * 0.4 + 0.2,
        });
      } else if (effect === 'sandstorm') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: Math.random() * 24 + 8,
          speedX: Math.random() * 9 + 8,
          speedY: Math.random() * 2.5 - 0.5,
          opacity: Math.random() * 0.35 + 0.15,
        });
      } else if (effect === 'embers' || effect === 'candles') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: effect === 'candles' ? Math.random() * 3.5 + 2 : Math.random() * 2.5 + 1,
          speedY: effect === 'candles' ? -(Math.random() * 0.55 + 0.25) : -(Math.random() * 1.5 + 0.8),
          speedX: (Math.random() - 0.5) * (effect === 'candles' ? 0.45 : 1.2),
          opacity: Math.random() * 0.7 + 0.3,
          hue: effect === 'candles' ? 36 + Math.random() * 14 : 15 + Math.random() * 25,
        });
      } else if (effect === 'fireflies') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2.5 + 1.5,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          alpha: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.03 + 0.01,
        });
      } else if (effect === 'snow') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 2.5 + 1,
          speedY: Math.random() * 1.5 + 0.8,
          speedX: (Math.random() - 0.5) * 0.8,
          opacity: Math.random() * 0.6 + 0.2,
        });
      } else if (effect === 'digital-rain') {
        particles.push({
          x: Math.floor(Math.random() * Math.max(1, width / 20)) * 20,
          y: Math.random() * height,
          speed: Math.random() * 4 + 3,
          char: String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96)),
        });
      } else if (effect === 'portal') {
        particles.push({
          x: width * 0.5,
          y: height * 0.34,
          angle: Math.random() * Math.PI * 2,
          dist: 30 + Math.random() * Math.min(width, height) * 0.42,
          speed: 0.008 + Math.random() * 0.014,
          radius: Math.random() * 2.2 + 1,
          alpha: Math.random() * 0.7 + 0.2,
        });
      } else {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: effect === 'red-smoke' ? Math.random() * 4.5 + 2 : Math.random() * 2 + 1,
          alpha: Math.random() * 0.7 + 0.2,
          fade: (Math.random() - 0.5) * 0.02,
          speedY: effect === 'red-smoke' ? -(Math.random() * 0.4 + 0.15) : 0,
        });
      }
    }

    const render = () => {
      tick += 0.018;
      ctx.clearRect(0, 0, width, height);

      if (effect === 'aurora-waves') {
        for (let w = 0; w < 3; w++) {
          const baseY = height * (0.2 + w * 0.14);
          const grad = ctx.createLinearGradient(0, baseY - 120, 0, baseY + 140);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(
            0.5,
            w % 2 === 0
              ? `rgba(${ar}, ${ag}, ${ab}, ${0.24 * safeIntensity})`
              : `rgba(${sr}, ${sg}, ${sb}, ${0.2 * safeIntensity})`
          );
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, baseY + 140);
          for (let x = 0; x <= width; x += 28) {
            const waveY =
              baseY +
              Math.sin(x * 0.006 + tick * (1 + w * 0.35) + w * 1.4) * (42 * safeIntensity) +
              Math.cos(x * 0.012 - tick * 0.7) * 18;
            ctx.lineTo(x, waveY);
          }
          ctx.lineTo(width, baseY + 140);
          ctx.closePath();
          ctx.fill();
        }
      } else if (effect === 'prism-rays') {
        const originX = width * 0.5;
        const originY = -height * 0.12;
        for (let b = 0; b < 5; b++) {
          const swing = Math.sin(tick * 0.65 + b * 1.2) * 0.12;
          const spread = (b - 2) * 0.26 + swing;
          const endX = originX + spread * width * 1.1;
          const beam = ctx.createLinearGradient(originX, 0, endX, height);
          beam.addColorStop(
            0,
            b % 2 === 0
              ? `rgba(${ar}, ${ag}, ${ab}, ${0.2 * safeIntensity})`
              : `rgba(${sr}, ${sg}, ${sb}, ${0.16 * safeIntensity})`
          );
          beam.addColorStop(1, 'transparent');
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(originX - 20, originY);
          ctx.lineTo(originX + 20, originY);
          ctx.lineTo(endX + 120, height);
          ctx.lineTo(endX - 120, height);
          ctx.closePath();
          ctx.fill();
        }
      } else if (effect === 'scanlines') {
        ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.07 * safeIntensity})`;
        for (let y = 0; y < height; y += 4) {
          ctx.fillRect(0, y, width, 1);
        }
        const scanY = ((tick * 120) % (height + 160)) - 80;
        const bar = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
        bar.addColorStop(0, 'transparent');
        bar.addColorStop(0.5, `rgba(${ar}, ${ag}, ${ab}, ${0.22 * safeIntensity})`);
        bar.addColorStop(1, 'transparent');
        ctx.fillStyle = bar;
        ctx.fillRect(0, scanY - 60, width, 120);
      } else if (effect === 'rain') {
        ctx.strokeStyle = `rgba(186, 230, 253, ${Math.min(0.75, 0.35 * safeIntensity)})`;
        ctx.lineWidth = 1.2;
        particles.forEach((p) => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 2, p.y + (p.length || 14));
          ctx.stroke();

          p.y += p.speed || 18;
          p.x -= 1;
          if (p.y > height) {
            p.y = -20;
            p.x = Math.random() * (width + 50);
          }
        });
      } else if (effect === 'sandstorm') {
        ctx.strokeStyle = `rgba(251, 146, 60, ${Math.min(0.6, 0.28 * safeIntensity)})`;
        ctx.lineWidth = 1.4;
        particles.forEach((p) => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + (p.length || 14), p.y + 3);
          ctx.stroke();

          p.x += p.speedX || 9;
          p.y += p.speedY || 1;
          if (p.x > width + 20) {
            p.x = -20;
            p.y = Math.random() * height;
          }
        });
      } else if (effect === 'embers' || effect === 'candles') {
        particles.forEach((p) => {
          const alpha = Math.min(1, (p.opacity || 0.5) * safeIntensity);
          ctx.fillStyle = `hsla(${p.hue || 25}, 95%, 60%, ${alpha})`;
          ctx.shadowColor = `hsl(${p.hue || 25}, 100%, 50%)`;
          ctx.shadowBlur = effect === 'candles' ? 12 : 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
          ctx.fill();

          p.y += p.speedY || -1;
          p.x += p.speedX || 0;
          p.opacity = (p.opacity || 0.6) - 0.0025;

          if (p.y < 0 || (p.opacity || 0) <= 0) {
            p.y = height + 10;
            p.x = Math.random() * width;
            p.opacity = Math.random() * 0.7 + 0.3;
          }
        });
        ctx.shadowBlur = 0;
      } else if (effect === 'fireflies') {
        particles.forEach((p) => {
          p.alpha = (p.alpha || 0) + (p.pulseSpeed || 0.02);
          const currentAlpha = ((Math.sin(p.alpha) + 1) / 2) * Math.min(1, safeIntensity);

          ctx.fillStyle = `rgba(52, 211, 153, ${currentAlpha * 0.8})`;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
          ctx.fill();

          p.x += p.vx || 0.4;
          p.y += p.vy || 0.4;

          if (p.x < 0 || p.x > width) p.vx = -(p.vx || 0.4);
          if (p.y < 0 || p.y > height) p.vy = -(p.vy || 0.4);
        });
        ctx.shadowBlur = 0;
      } else if (effect === 'snow') {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.9, 0.65 * safeIntensity)})`;
        particles.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius || 2, 0, Math.PI * 2);
          ctx.fill();

          p.y += p.speedY || 1;
          p.x += p.speedX || 0;

          if (p.y > height) {
            p.y = -10;
            p.x = Math.random() * width;
          }
        });
      } else if (effect === 'digital-rain') {
        ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, ${Math.min(0.95, 0.75 * safeIntensity)})`;
        ctx.font = '12px monospace';
        particles.forEach((p) => {
          ctx.fillText(p.char || '0', p.x, p.y);
          p.y += p.speed || 4;
          if (p.y > height) {
            p.y = -10;
            p.char = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96));
          }
        });
      } else if (effect === 'portal') {
        const cx = width * 0.5;
        const cy = height * 0.34;
        particles.forEach((p) => {
          p.angle = (p.angle || 0) + (p.speed || 0.01);
          const px = cx + Math.cos(p.angle) * (p.dist || 60);
          const py = cy + Math.sin(p.angle) * (p.dist || 60) * 0.55;
          ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, ${Math.min(0.9, (p.alpha || 0.5) * safeIntensity)})`;
          ctx.beginPath();
          ctx.arc(px, py, p.radius || 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // Red smoke & ambient stars
        particles.forEach((p) => {
          p.alpha = (p.alpha || 0.4) + (p.fade || 0.01);
          if (p.alpha <= 0.1 || p.alpha >= 0.8) p.fade = -(p.fade || 0.01);
          if (p.speedY) {
            p.y += p.speedY;
            if (p.y < -10) p.y = height + 10;
          }

          ctx.fillStyle =
            effect === 'red-smoke'
              ? `rgba(239, 68, 68, ${Math.min(0.65, p.alpha * 0.38 * safeIntensity)})`
              : `rgba(255, 255, 255, ${Math.min(0.9, p.alpha * 0.6 * safeIntensity)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius || 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [effect, enabled, intensity, accentHex, secondaryHex]);

  if (!enabled || effect === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none w-full h-full z-0 opacity-85"
    />
  );
};
