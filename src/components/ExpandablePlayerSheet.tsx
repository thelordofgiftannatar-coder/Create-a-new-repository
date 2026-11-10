import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  Volume2,
  VolumeX,
  Sliders,
  Moon,
  FileText,
  SunMedium,
  Gauge,
  Disc,
  Palette,
  Maximize2,
  Image as ImageIcon,
  X,
  Tag,
} from 'lucide-react';
import { Track, PlaybackMode } from '../types/music';
import { DEFAULT_DIY_STYLE, DiyPlayerStyle } from '../types/themeLandscape';
import { audioEngine, triggerHaptic } from '../services/audioEngine';
import { WaveformPreview } from './WaveformPreview';
import { useSpringDriver, PointerVelocityTracker } from '../hooks/useSpringPhysics';

interface ExpandablePlayerSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  track: Track | null;
  isPlaying: boolean;
  playbackMode: PlaybackMode;
  isShuffle: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  onToggleFavorite: (trackId: string) => void;
  onOpenEQ: () => void;
  onOpenSleepTimer: () => void;
  onOpenWallpaper?: () => void;
  onEditTags?: (track: Track) => void;
  useAlbumArtBackground?: boolean;
  onToggleSongArtBackground?: () => void;
  diyStyle?: DiyPlayerStyle;
  accentHex?: string;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];
const COLLAPSED_BAR_HEIGHT = 78;

/**
 * Unified GPU Gesture-Driven Mini Player <-> Bottom Sheet <-> Full-Screen Player.
 * Powered strictly by Pointer Events, CSS touch-action, transform: translate3d / scale / opacity,
 * will-change: transform, requestAnimationFrame damped springs, velocity-based snapping,
 * interruptible gestures, and live cover-art Container Transform.
 */
export const ExpandablePlayerSheet: React.FC<ExpandablePlayerSheetProps> = ({
  isOpen,
  onOpenChange,
  track,
  isPlaying,
  playbackMode,
  isShuffle,
  onTogglePlay,
  onPrev,
  onNext,
  onToggleRepeat,
  onToggleShuffle,
  onToggleFavorite,
  onOpenEQ,
  onOpenSleepTimer,
  onOpenWallpaper,
  onEditTags,
  useAlbumArtBackground = false,
  onToggleSongArtBackground,
  diyStyle,
  accentHex = '#38bdf8',
}) => {
  const diy = { ...DEFAULT_DIY_STYLE, ...(diyStyle || {}) };
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekVal, setSeekVal] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [vinylSpin, setVinylSpin] = useState(diy.heroArtMode === 'vinyl');
  const [showOriginalArtModal, setShowOriginalArtModal] = useState(false);
  const [miniProgressPct, setMiniProgressPct] = useState(0);

  useEffect(() => {
    setVinylSpin(diy.heroArtMode === 'vinyl');
  }, [diy.heroArtMode]);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // GPU-composited DOM refs
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const sheetBgRef = useRef<HTMLDivElement | null>(null);
  const miniBarRef = useRef<HTMLDivElement | null>(null);
  const miniCoverAnchorRef = useRef<HTMLDivElement | null>(null);
  const topHeaderRef = useRef<HTMLDivElement | null>(null);
  const heroCoverSlotRef = useRef<HTMLDivElement | null>(null);
  const modeSwitcherRef = useRef<HTMLDivElement | null>(null);
  const sharedCoverRef = useRef<HTMLDivElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const controlsGroupRef = useRef<HTMLDivElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const vinylOverlayRef = useRef<HTMLDivElement | null>(null);

  // Pre-measured layout vectors (measured at rest relative to sheetRef)
  const metricsRef = useRef({
    travelY: 640,
    miniCx: 40,
    miniCy: 38,
    heroCx: 200,
    heroCy: 240,
    heroSize: 280,
    minScale: 0.16,
  });

  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startY: 0,
    startX: 0,
    startProgress: 0,
    moved: false,
    allowScrollFirst: false,
  });

  const velocityTrackerRef = useRef(new PointerVelocityTracker());
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const measureGeometry = useCallback(() => {
    const vh = window.innerHeight || 800;
    const travelY = Math.max(240, vh - COLLAPSED_BAR_HEIGHT);
    const sheetEl = sheetRef.current;
    const miniAnchor = miniCoverAnchorRef.current;
    const heroSlot = heroCoverSlotRef.current;

    if (sheetEl && miniAnchor && heroSlot) {
      const sRect = sheetEl.getBoundingClientRect();
      const mRect = miniAnchor.getBoundingClientRect();
      const hRect = heroSlot.getBoundingClientRect();

      if (mRect.width > 0 && hRect.width > 0) {
        const heroSize = Math.round(hRect.width);
        const miniCx = mRect.left - sRect.left + mRect.width / 2;
        const miniCy = mRect.top - sRect.top + mRect.height / 2;
        const heroCx = hRect.left - sRect.left + hRect.width / 2;
        const heroCy = hRect.top - sRect.top + hRect.height / 2;

        metricsRef.current = {
          travelY,
          miniCx,
          miniCy,
          heroCx,
          heroCy,
          heroSize,
          minScale: Math.max(0.08, mRect.width / heroSize),
        };

        if (sharedCoverRef.current) {
          sharedCoverRef.current.style.width = `${heroSize}px`;
          sharedCoverRef.current.style.height = `${heroSize}px`;
        }
        return;
      }
    }
    metricsRef.current.travelY = travelY;
  }, []);

  const applyProgress = useCallback((rawP: number) => {
    // Allow subtle damped rubber-band at ends while clamping visuals cleanly
    const p = Math.max(-0.03, Math.min(1.02, rawP));
    const clamped = Math.max(0, Math.min(1, p));
    const m = metricsRef.current;
    const translateY = (1 - p) * m.travelY;

    if (sheetRef.current) {
      sheetRef.current.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0)`;
    }
    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(Math.min(1, clamped * 1.15));
      backdropRef.current.style.pointerEvents = clamped > 0.15 ? 'auto' : 'none';
    }
    if (sheetBgRef.current) {
      sheetBgRef.current.style.opacity = String(Math.max(0, Math.min(1, clamped * 1.4)));
    }
    if (miniBarRef.current) {
      const miniOpacity = Math.max(0, 1 - clamped * 4.2);
      miniBarRef.current.style.opacity = String(miniOpacity);
      miniBarRef.current.style.pointerEvents = clamped < 0.25 ? 'auto' : 'none';
    }

    const fullOpacity = Math.max(0, Math.min(1, (clamped - 0.12) / 0.48));
    if (topHeaderRef.current) {
      topHeaderRef.current.style.opacity = String(fullOpacity);
      topHeaderRef.current.style.pointerEvents = clamped > 0.3 ? 'auto' : 'none';
    }
    if (modeSwitcherRef.current) {
      modeSwitcherRef.current.style.opacity = String(fullOpacity);
      modeSwitcherRef.current.style.pointerEvents = clamped > 0.35 ? 'auto' : 'none';
    }
    if (controlsGroupRef.current) {
      controlsGroupRef.current.style.opacity = String(fullOpacity);
      controlsGroupRef.current.style.pointerEvents = clamped > 0.35 ? 'auto' : 'none';
    }
    if (haloRef.current) {
      haloRef.current.style.opacity = String(0.42 * fullOpacity);
    }
    if (vinylOverlayRef.current) {
      vinylOverlayRef.current.style.opacity = String(Math.max(0, (clamped - 0.6) * 2.5));
    }

    // Shared Element Container Transform on Cover Art (100% GPU translate3d + scale, unclipped)
    if (sharedCoverRef.current) {
      const covP = clamped;
      const cx = m.miniCx + (m.heroCx - m.miniCx) * covP;
      const cy = m.miniCy + (m.heroCy - m.miniCy) * covP;
      const tx = cx - m.heroSize / 2;
      const ty = cy - m.heroSize / 2;
      const s = m.minScale + (1 - m.minScale) * covP;
      sharedCoverRef.current.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
      sharedCoverRef.current.style.pointerEvents = clamped > 0.5 ? 'auto' : 'none';
    }
  }, []);

  const spring = useSpringDriver({
    initialValue: isOpen ? 1 : 0,
    defaultConfig: { stiffness: 360, damping: 34, mass: 1 },
    onUpdate: (val) => applyProgress(val),
    onRest: (finalVal) => {
      const nextOpen = finalVal >= 0.5;
      if (nextOpen !== isOpenRef.current) {
        onOpenChangeRef.current(nextOpen);
      }
      measureGeometry();
    },
  });

  // Synchronously apply resting GPU transforms before paint and re-measure on resize/scroll/vinyl toggle
  useLayoutEffect(() => {
    measureGeometry();
    applyProgress(spring.getValue());

    const ro = new ResizeObserver(() => {
      measureGeometry();
      applyProgress(spring.getValue());
    });
    if (sheetRef.current) ro.observe(sheetRef.current);
    if (heroCoverSlotRef.current) ro.observe(heroCoverSlotRef.current);
    window.addEventListener('resize', measureGeometry, { passive: true });
    const bodyEl = scrollBodyRef.current;
    const onBodyScroll = () => {
      measureGeometry();
      applyProgress(spring.getValue());
    };
    bodyEl?.addEventListener('scroll', onBodyScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureGeometry);
      bodyEl?.removeEventListener('scroll', onBodyScroll);
    };
  }, [track?.id, showLyrics, vinylSpin, measureGeometry, applyProgress, spring]);

  // Synchronize external isOpen prop changes (e.g. clicking PlayCircle tab in top bar or Back arrow)
  useEffect(() => {
    if (dragRef.current.active) return;
    const target = isOpen ? 1 : 0;
    if (Math.abs(spring.getTarget() - target) > 0.01) {
      measureGeometry();
      spring.animateTo(target, spring.getVelocity());
    }
  }, [isOpen, measureGeometry, spring]);

  // Playback polling (faster when expanded, lightweight when collapsed)
  useEffect(() => {
    if (!track) return;
    const interval = setInterval(() => {
      const cur = audioEngine.getCurrentTime();
      const dur = audioEngine.getDuration();
      if (!isSeeking) {
        setCurrentTime(cur);
        setDuration(dur);
      }
      if (dur > 0) {
        setMiniProgressPct((cur / dur) * 100);
      }
    }, isOpen ? 220 : 480);
    return () => clearInterval(interval);
  }, [track, isOpen, isSeeking]);

  // Keyboard Escape to minimize when expanded
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onOpenChange]);

  const toggleWakeLock = async () => {
    triggerHaptic(20);
    if ('wakeLock' in navigator) {
      try {
        if (!wakeLockActive) {
          const lock = await navigator.wakeLock.request('screen');
          wakeLockRef.current = lock;
          setWakeLockActive(true);
          lock.addEventListener('release', () => setWakeLockActive(false));
        } else if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          setWakeLockActive(false);
        }
      } catch (e) {
        console.warn('Wake Lock request:', e);
      }
    }
  };

  const handleSeekChange = (val: number) => {
    setIsSeeking(true);
    setSeekVal(val);
  };

  const handleSeekCommit = () => {
    setIsSeeking(false);
    audioEngine.seek(seekVal);
    setCurrentTime(seekVal);
  };

  const handleSpeedSelect = (val: number) => {
    triggerHaptic(15);
    setSpeed(val);
    audioEngine.setPlaybackRate(val);
    setShowSpeedMenu(false);
  };

  const handleToggleMute = () => {
    triggerHaptic(15);
    if (isMuted) {
      audioEngine.setVolume(volume);
      setIsMuted(false);
    } else {
      audioEngine.setVolume(0);
      setIsMuted(true);
    }
  };

  const formatTime = (secs: number) => {
    if (Number.isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const parsedLyrics = React.useMemo(() => {
    if (!track?.lyrics) return [];
    const lines = track.lyrics.split('\n');
    return lines
      .map((line) => {
        const match = line.match(/\[(\d{2}):(\d{2}\.?\d*)\](.*)/);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseFloat(match[2]);
          return { time: minutes * 60 + seconds, text: match[3].trim() };
        }
        return { time: 0, text: line.trim() };
      })
      .filter((l) => l.text.length > 0);
  }, [track?.lyrics]);

  // Unified Pointer Events drag controller (interruptible, direct manipulation, velocity snapping)
  const beginDrag = (e: React.PointerEvent<HTMLElement>, allowScrollCheck: boolean) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, a, [data-no-drag]')) {
      return;
    }

    measureGeometry();
    const currentP = spring.getValue();
    // Interrupt running spring immediately on finger contact!
    spring.setImmediate(currentP);

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      startX: e.clientX,
      startProgress: currentP,
      moved: false,
      allowScrollFirst: allowScrollCheck,
    };
    velocityTrackerRef.current.reset(currentP);
  };

  const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;

    const dy = e.clientY - d.startY;
    const dx = e.clientX - d.startX;

    if (!d.moved) {
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      // If user is swiping horizontally more than vertically, cancel sheet drag
      if (Math.abs(dx) > Math.abs(dy) * 1.15) {
        d.active = false;
        return;
      }
      // Inside expanded scroll area: let internal list scroll unless already at top & dragging down
      if (d.allowScrollFirst && scrollBodyRef.current) {
        const scTop = scrollBodyRef.current.scrollTop;
        if (scTop > 2 || dy < 0) {
          d.active = false;
          return;
        }
      }
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    const travel = Math.max(220, metricsRef.current.travelY);
    const deltaP = -dy / travel; // Drag UP = negative dy = positive deltaProgress
    let nextP = d.startProgress + deltaP;

    // Gentle rubber-band resistance past [0..1]
    if (nextP < 0) nextP *= 0.25;
    if (nextP > 1) nextP = 1 + (nextP - 1) * 0.22;

    velocityTrackerRef.current.addSample(nextP);
    spring.setImmediate(nextP);
  };

  const handleSheetPointerEnd = (e: React.PointerEvent<HTMLDivElement>, wasTapOnMini: boolean) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    d.active = false;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (!d.moved) {
      if (wasTapOnMini && d.startProgress < 0.3) {
        triggerHaptic(12);
        onOpenChange(true);
        spring.animateTo(1);
      } else {
        // Restore target cleanly after accidental tap interruption during flight
        spring.animateTo(isOpen ? 1 : 0);
      }
      return;
    }

    const p = spring.getValue();
    const vel = velocityTrackerRef.current.getVelocity(); // progress units / sec

    let target: 0 | 1;
    if (vel > 0.65) {
      target = 1; // Fast upward flick -> expand
    } else if (vel < -0.65) {
      target = 0; // Fast downward flick -> minimize
    } else {
      // Velocity-projected threshold check
      target = p + vel * 0.14 >= 0.45 ? 1 : 0;
    }

    triggerHaptic(12);
    onOpenChange(target === 1);
    spring.animateTo(target, vel);
  };

  if (!track) return null;

  const progressPercent = duration > 0 ? ((isSeeking ? seekVal : currentTime) / duration) * 100 : 0;

  const miniContainerRadius =
    diy.widgetStyle === 'floating-pill'
      ? 'rounded-full px-3.5'
      : diy.widgetStyle === 'minimal-slim'
      ? 'rounded-xl px-2.5'
      : 'rounded-2xl px-2.5';

  const miniSurfaceStyle: React.CSSProperties = {
    backgroundColor:
      diy.customSurfaceHex ||
      (diy.screenStyle === 'amoled-black' ? '#000000' : '#0d1527'),
    opacity: diy.widgetOpacity,
    borderColor:
      diy.widgetStyle === 'glass-card' || diy.screenStyle === 'neon-hud'
        ? `${accentHex}70`
        : diy.screenStyle === 'comic-panel'
        ? '#000000'
        : diy.screenStyle === 'borderless-air'
        ? 'transparent'
        : 'rgba(255,255,255,0.16)',
    borderWidth: diy.screenStyle === 'comic-panel' ? '2px' : undefined,
    boxShadow:
      diy.screenStyle === 'comic-panel'
        ? '3px 3px 0px #000000'
        : diy.widgetStyle === 'glass-card'
        ? `0 12px 30px ${accentHex}30`
        : undefined,
  };

  const miniAnchorShapeClass =
    diy.widgetArtShape === 'circle' || diy.widgetStyle === 'vinyl-dock'
      ? 'rounded-full'
      : diy.widgetArtShape === 'square'
      ? 'rounded-md'
      : 'rounded-xl';

  const sharedCoverShapeClass = vinylSpin
    ? 'rounded-full border-4 border-slate-800'
    : !isOpen && diy.widgetArtShape === 'circle'
    ? 'rounded-full border border-white/15'
    : !isOpen && diy.widgetArtShape === 'square'
    ? 'rounded-lg border border-white/15'
    : diy.heroArtMode === 'framed'
    ? 'rounded-2xl border-4 border-black shadow-[6px_6px_0px_#000]'
    : 'rounded-3xl border border-white/15';

  return (
    <>
      {/* Dimmed Scrim behind sliding sheet */}
      <div
        ref={backdropRef}
        style={{ willChange: 'opacity' }}
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm"
      />

      {/* Unified GPU Sliding Sheet (`translate3d` + `will-change: transform`) */}
      <div
        ref={sheetRef}
        style={{
          willChange: 'transform',
          pointerEvents: 'none',
        }}
        onPointerMove={handleSheetPointerMove}
        onPointerUp={(e) => handleSheetPointerEnd(e, spring.getValue() < 0.25)}
        onPointerCancel={(e) => handleSheetPointerEnd(e, false)}
        className="fixed inset-0 z-40 flex flex-col overflow-visible"
      >
        {/* Fullscreen Sheet Surface Background */}
        <div
          ref={sheetBgRef}
          style={{
            willChange: 'opacity',
            backgroundColor:
              diy.customSurfaceHex ||
              (diy.screenStyle === 'amoled-black' ? 'rgba(0,0,0,0.96)' : 'rgba(8,13,26,0.9)'),
          }}
          className="absolute inset-0 backdrop-blur-3xl pointer-events-none"
        />

        {/* DOCKED MINI PLAYER BAR (Anchored at top of sheet = resting at bottom when collapsed!) */}
        <div
          ref={miniBarRef}
          style={{
            height: COLLAPSED_BAR_HEIGHT,
            willChange: 'opacity',
            touchAction: 'none',
          }}
          onPointerDown={(e) => beginDrag(e, false)}
          className={`absolute top-0 left-0 right-0 z-20 pb-2 pt-1 max-w-4xl mx-auto ${
            diy.widgetStyle === 'floating-pill' ? 'px-4' : 'px-3'
          }`}
        >
          <div
            style={miniSurfaceStyle}
            className={`relative group w-full h-full border ${miniContainerRadius} shadow-2xl backdrop-blur-2xl flex items-center justify-between cursor-grab active:cursor-grabbing`}
          >
            {/* Subtle Bottom-Sheet Drag Pill Hint */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-white/20 pointer-events-none" />

            {/* Top Playback Progress Line */}
            {diy.widgetShowProgress && (
              <div className="absolute top-0 left-2 right-2 h-1 bg-black/40 rounded-t-2xl overflow-hidden pointer-events-none">
                <div
                  className="h-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, miniProgressPct))}%`,
                    backgroundColor: accentHex,
                  }}
                />
              </div>
            )}

            {/* Left Zone: Shared-Element Spacer + Track Info */}
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div
                ref={miniCoverAnchorRef}
                className={`w-11 h-11 ${miniAnchorShapeClass} flex-shrink-0 border border-white/5 bg-slate-900/40`}
              />

              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate transition-colors">
                  {track.title}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {track.artist}
                </div>
              </div>
            </div>

            {/* Right Zone: Playback Buttons (excluded from swipe capture) */}
            <div className="flex items-center gap-1" data-no-drag>
              {diy.widgetShowFavorite && (
                <button
                  type="button"
                  data-no-drag
                  onClick={() => {
                    triggerHaptic(15);
                    onToggleFavorite(track.id);
                  }}
                  className={`prime-icon-btn p-2 rounded-full transition active:scale-90 min-w-[38px] min-h-[38px] flex items-center justify-center ${
                    track.isFavorite ? 'text-pink-500' : 'text-slate-400 hover:text-white'
                  }`}
                  aria-label="Favorite track"
                >
                  <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-current' : ''}`} />
                </button>
              )}

              <button
                type="button"
                data-no-drag
                onClick={() => {
                  triggerHaptic(20);
                  onTogglePlay();
                }}
                style={{
                  backgroundColor: accentHex,
                  boxShadow: `0 4px 14px ${accentHex}45`,
                }}
                className="prime-icon-btn p-2.5 rounded-full text-black hover:brightness-110 active:scale-90 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                data-no-drag
                onClick={() => {
                  triggerHaptic(15);
                  onNext();
                }}
                className="prime-icon-btn p-2 rounded-full text-slate-300 hover:text-white active:scale-90 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
                aria-label="Next track"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* PERSISTENT UNCLIPPED SHARED COVER ART LAYER (Container Transform: translate3d + scale) */}
        <div
          ref={sharedCoverRef}
          onPointerDown={(e) => beginDrag(e, false)}
          onClick={() => {
            if (spring.getValue() > 0.6 && !dragRef.current.moved) {
              setShowOriginalArtModal(true);
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            willChange: 'transform',
            transformOrigin: 'center center',
            zIndex: 35,
            touchAction: 'none',
          }}
          className={`group overflow-hidden shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing select-none ${sharedCoverShapeClass}`}
          title="Swipe down to minimize or tap to inspect original art"
        >
          <img
            src={track.coverUrl || '/pwa-512x512.png'}
            alt={track.title}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover pointer-events-none ${
              (vinylSpin || (!isOpen && diy.widgetStyle === 'vinyl-dock')) && isPlaying
                ? 'animate-spin-slow'
                : ''
            }`}
          />

          {vinylSpin && (
            <div
              ref={vinylOverlayRef}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full border-4 border-black/80 bg-slate-900/90 flex items-center justify-center shadow-inner">
                <div
                  className="w-6 h-6 rounded-full shadow-lg"
                  style={{ backgroundColor: accentHex }}
                />
              </div>
            </div>
          )}

          {!vinylSpin && (
            <div className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-[10px] text-white font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Maximize2 className="w-3 h-3 text-cyan-400" />
              <span>Original Art</span>
            </div>
          )}
        </div>

        {/* FULL-SCREEN NOW PLAYING CONTENT */}
        <div
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(e) => beginDrag(e, true)}
          className="relative z-10 flex-1 flex flex-col overflow-hidden pb-safe pt-safe"
        >
          {/* Top Drag Handle + App Bar (always allows swipe-down to dismiss) */}
          <div
            ref={topHeaderRef}
            style={{
              willChange: 'opacity',
              touchAction: 'none',
            }}
            onPointerDown={(e) => beginDrag(e, false)}
            className="flex flex-col border-b border-white/10 backdrop-blur-md cursor-grab active:cursor-grabbing"
          >
            {/* Bottom Sheet Top Pill Handle */}
            <div className="pt-2 pb-0.5 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-white/25" />
            </div>

            <div className="flex items-center justify-between px-5 py-2.5">
              <button
                type="button"
                data-no-drag
                onClick={() => {
                  triggerHaptic(15);
                  onOpenChange(false);
                }}
                className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Minimize player"
              >
                <ChevronDown className="w-6 h-6 text-slate-300" />
              </button>

              <div className="text-center min-w-0 px-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 truncate">
                  {track.album || 'Now Playing'}
                </div>
                <div className="text-xs text-slate-400 max-w-[180px] truncate">
                  {track.genre || 'Prime One Music'}
                </div>
              </div>

              <div className="flex items-center gap-1" data-no-drag>
                {onToggleSongArtBackground && (
                  <button
                    type="button"
                    data-no-drag
                    onClick={() => {
                      triggerHaptic(15);
                      onToggleSongArtBackground();
                    }}
                    className={`p-2 rounded-full transition min-w-[38px] min-h-[38px] flex items-center justify-center ${
                      useAlbumArtBackground
                        ? 'text-cyan-300 bg-cyan-500/20 ring-1 ring-cyan-400'
                        : 'text-slate-400 hover:text-white bg-white/5'
                    }`}
                    title={
                      useAlbumArtBackground
                        ? 'Background: Song Original Art'
                        : 'Background: Theme Wallpaper'
                    }
                  >
                    <Disc className="w-5 h-5 text-cyan-400" />
                  </button>
                )}

                {onEditTags && (
                  <button
                    type="button"
                    data-no-drag
                    onClick={() => {
                      triggerHaptic(15);
                      onEditTags(track);
                    }}
                    className="p-2 rounded-full text-slate-400 hover:text-violet-300 transition min-w-[38px] min-h-[38px] flex items-center justify-center"
                    title="Edit Tags & Google Photos Cover Art"
                  >
                    <Tag className="w-5 h-5" />
                  </button>
                )}

                {onOpenWallpaper && (
                  <button
                    type="button"
                    data-no-drag
                    onClick={() => {
                      triggerHaptic(15);
                      onOpenWallpaper();
                    }}
                    className="p-2 rounded-full text-slate-400 hover:text-white transition min-w-[38px] min-h-[38px] flex items-center justify-center"
                    title="Change Player Wallpaper & Theme"
                  >
                    <Palette className="w-5 h-5" />
                  </button>
                )}

                <button
                  type="button"
                  data-no-drag
                  onClick={toggleWakeLock}
                  className={`p-2 -mr-1 rounded-full transition min-w-[38px] min-h-[38px] flex items-center justify-center ${
                    wakeLockActive
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={wakeLockActive ? 'Screen will stay awake' : 'Enable Keep Screen Awake'}
                >
                  <SunMedium className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Expanded Scrollable Center Body */}
          <div
            ref={scrollBodyRef}
            style={{ touchAction: 'pan-y' }}
            className="flex-1 overflow-y-auto overflow-x-visible flex flex-col items-center justify-between px-6 py-3 max-w-md mx-auto w-full"
          >
            {/* Controls Top Part: Mode Switcher + Hero Cover Target Slot */}
            <div className="w-full flex flex-col items-center">
              <div
                ref={modeSwitcherRef}
                style={{ willChange: 'opacity' }}
                className="flex items-center justify-between w-full max-w-[310px] mb-2 px-1"
              >
                <div
                  className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/10 text-[11px]"
                  data-no-drag
                >
                  <button
                    type="button"
                    data-no-drag
                    onClick={() => {
                      triggerHaptic(10);
                      setVinylSpin(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                      !vinylSpin
                        ? 'bg-cyan-500 text-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Original Art</span>
                  </button>
                  <button
                    type="button"
                    data-no-drag
                    onClick={() => {
                      triggerHaptic(10);
                      setVinylSpin(true);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                      vinylSpin
                        ? 'bg-cyan-500 text-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Disc className="w-3 h-3" />
                    <span>Vinyl</span>
                  </button>
                </div>

                <button
                  type="button"
                  data-no-drag
                  onClick={() => {
                    triggerHaptic(15);
                    setShowOriginalArtModal(true);
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-cyan-300 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-xl border border-white/10 transition"
                  title="Inspect Song Original Artwork"
                >
                  <Maximize2 className="w-3 h-3 text-cyan-400" />
                  <span>View Art</span>
                </button>
              </div>

              {/* HERO COVER TARGET SLOT (Measured anchor for unclipped sharedCoverRef) */}
              <div
                ref={heroCoverSlotRef}
                className="relative w-full aspect-square max-w-[300px] my-2 flex items-center justify-center pointer-events-none"
              >
                {/* Ambient Halo behind hero cover */}
                <div
                  ref={haloRef}
                  className={`absolute inset-0 rounded-full pointer-events-none ${
                    diy.heroArtMode === 'aurora-halo' ? 'blur-2xl scale-115' : 'blur-3xl'
                  }`}
                  style={{
                    backgroundImage: track.coverUrl ? `url(${track.coverUrl})` : 'none',
                    backgroundColor: accentHex,
                    backgroundSize: 'cover',
                    willChange: 'opacity',
                  }}
                />
              </div>
            </div>

            {/* EXPANDED CONTROLS GROUP (Fades smoothly without clipping Shared Cover) */}
            <div
              ref={controlsGroupRef}
              style={{
                willChange: 'opacity',
              }}
              className="w-full flex flex-col items-center"
            >
              {/* Title & Favorite */}
              <div className="w-full mt-2 flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <h1 className="text-xl font-extrabold text-white truncate tracking-tight">
                    {track.title}
                  </h1>
                  <p className="text-sm font-medium text-slate-400 truncate mt-0.5">
                    {track.artist}
                  </p>
                </div>

                <button
                  type="button"
                  data-no-drag
                  onClick={() => {
                    triggerHaptic(20);
                    onToggleFavorite(track.id);
                  }}
                  className={`prime-icon-btn p-2.5 rounded-full transition active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    track.isFavorite
                      ? 'text-pink-500 bg-pink-500/10'
                      : 'text-slate-400 hover:text-white bg-white/5'
                  }`}
                  aria-label="Favorite"
                >
                  <Heart className={`w-5 h-5 ${track.isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* WaveformPreview & Range Seeker */}
              <div className="w-full mt-4" data-no-drag>
                <div className="mb-2 px-1">
                  <WaveformPreview
                    waveform={track.waveform}
                    seed={track.id + track.title}
                    progress={duration > 0 ? (isSeeking ? seekVal : currentTime) / duration : 0}
                    isCurrent={true}
                    isPlaying={isPlaying}
                    barCount={44}
                    height={28}
                    showDensityBadge={true}
                    onSeek={(ratio) => {
                      const target = ratio * (duration || track.duration || 1);
                      handleSeekChange(target);
                      handleSeekCommit();
                    }}
                  />
                </div>

                <div className="relative w-full h-5 flex items-center group cursor-pointer">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.5}
                    value={isSeeking ? seekVal : currentTime}
                    onChange={(e) => handleSeekChange(Number(e.target.value))}
                    onMouseUp={handleSeekCommit}
                    onTouchEnd={handleSeekCommit}
                    aria-label="Seek audio position"
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mt-1 tabular-nums">
                  <span>{formatTime(isSeeking ? seekVal : currentTime)}</span>
                  <span className="text-[10px] text-slate-500 font-sans font-medium">
                    Audio density · {Math.round(progressPercent)}%
                  </span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Primary Playback Transport */}
              <div className="w-full mt-4 flex items-center justify-between px-2" data-no-drag>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    onToggleShuffle();
                  }}
                  style={isShuffle ? { color: accentHex, backgroundColor: `${accentHex}1f` } : undefined}
                  className={`prime-icon-btn p-2.5 rounded-full transition min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    isShuffle ? '' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Shuffle"
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    onPrev();
                  }}
                  className="prime-icon-btn p-3 rounded-full text-slate-200 hover:text-white hover:bg-white/10 active:scale-90 transition min-w-[48px] min-h-[48px] flex items-center justify-center"
                  aria-label="Previous track"
                >
                  <SkipBack className="w-7 h-7 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(25);
                    onTogglePlay();
                  }}
                  style={{
                    backgroundColor: accentHex,
                    boxShadow: `0 12px 28px ${accentHex}45`,
                  }}
                  className="prime-icon-btn w-16 h-16 rounded-full text-black flex items-center justify-center active:scale-95 transition hover:scale-105"
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
                  className="p-3 rounded-full text-slate-200 hover:text-white hover:bg-white/10 active:scale-90 transition min-w-[48px] min-h-[48px] flex items-center justify-center"
                  aria-label="Next track"
                >
                  <SkipForward className="w-7 h-7 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    onToggleRepeat();
                  }}
                  className={`p-2.5 rounded-full transition min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    playbackMode !== 'off'
                      ? 'text-cyan-400 bg-cyan-500/10'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Repeat: ${playbackMode}`}
                >
                  {playbackMode === 'repeat-one' ? (
                    <Repeat1 className="w-5 h-5" />
                  ) : (
                    <Repeat className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Utility Toolbelt */}
              <div
                className="w-full mt-5 pt-4 border-t border-white/10 flex items-center justify-around"
                data-no-drag
              >
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    onOpenEQ();
                  }}
                  className="flex flex-col items-center gap-1 text-slate-400 hover:text-cyan-300 transition min-w-[48px]"
                >
                  <Sliders className="w-5 h-5" />
                  <span className="text-[10px] font-medium">EQ &amp; FX</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    onOpenSleepTimer();
                  }}
                  className="flex flex-col items-center gap-1 text-slate-400 hover:text-purple-300 transition min-w-[48px]"
                >
                  <Moon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Sleep Timer</span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setShowSpeedMenu(!showSpeedMenu);
                    }}
                    className="flex flex-col items-center gap-1 text-slate-400 hover:text-cyan-300 transition min-w-[48px]"
                  >
                    <Gauge className="w-5 h-5" />
                    <span className="text-[10px] font-mono tabular-nums">{speed}x Speed</span>
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute bottom-11 left-1/2 -translate-x-1/2 bg-[#111827] border border-cyan-500/30 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1 z-50">
                      {SPEED_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSpeedSelect(s)}
                          className={`px-3 py-1 rounded-xl text-xs font-mono transition text-left ${
                            speed === s
                              ? 'bg-cyan-500 text-black font-bold'
                              : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    setShowLyrics(!showLyrics);
                  }}
                  className={`flex flex-col items-center gap-1 transition min-w-[48px] ${
                    showLyrics ? 'text-cyan-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Lyrics</span>
                </button>
              </div>

              {/* Volume & Mute Row */}
              <div className="w-full mt-3 flex items-center gap-3 px-2" data-no-drag>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="text-slate-400 hover:text-white transition p-1"
                  aria-label="Toggle mute"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    setIsMuted(false);
                    audioEngine.setVolume(v);
                  }}
                  aria-label="Volume"
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Expandable Synced Lyrics Sheet */}
              {showLyrics && (
                <div
                  data-no-drag
                  className="w-full mt-4 p-4 rounded-2xl bg-black/60 border border-cyan-500/20 max-h-48 overflow-y-auto space-y-2 text-center"
                >
                  {parsedLyrics.length > 0 ? (
                    parsedLyrics.map((item, idx) => {
                      const isActive =
                        currentTime >= item.time &&
                        (idx === parsedLyrics.length - 1 ||
                          currentTime < parsedLyrics[idx + 1].time);
                      return (
                        <p
                          key={idx}
                          className={`text-xs transition-all duration-300 ${
                            isActive
                              ? 'text-cyan-300 font-bold text-sm scale-105'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {item.text}
                        </p>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      No lyrics provided for this audio track.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Original Song Artwork Lightbox */}
      {showOriginalArtModal && (
        <div
          onClick={() => setShowOriginalArtModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 cursor-pointer select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#090d16]/95 border border-white/20 p-5 shadow-2xl text-slate-100 flex flex-col items-center"
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Original Song Artwork
              </span>
              <button
                type="button"
                onClick={() => setShowOriginalArtModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
                aria-label="Close artwork modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-black">
              <img
                src={track.coverUrl || '/pwa-512x512.png'}
                alt={track.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="w-full mt-4 text-center">
              <h3 className="text-base font-extrabold text-white truncate">{track.title}</h3>
              <p className="text-xs text-cyan-300 font-semibold mt-0.5">{track.artist}</p>
              {track.album && <p className="text-[11px] text-slate-400 mt-0.5">{track.album}</p>}
            </div>

            <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10">
              {onToggleSongArtBackground && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    onToggleSongArtBackground();
                    setShowOriginalArtModal(false);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    useAlbumArtBackground
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                  }`}
                >
                  <Disc className="w-3.5 h-3.5" />
                  <span>{useAlbumArtBackground ? 'Art is Background' : 'Set as Background'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowOriginalArtModal(false)}
                className="py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black text-xs font-bold shadow-md shadow-cyan-500/20 active:scale-95 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
