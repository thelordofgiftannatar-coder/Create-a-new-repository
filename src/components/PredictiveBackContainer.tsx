import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { ArrowLeft } from 'lucide-react';
import { triggerHaptic } from '../services/audioEngine';
import { useSpringDriver, PointerVelocityTracker } from '../hooks/useSpringPhysics';

export interface PredictiveBackHandle {
  triggerBack: () => void;
}

interface PredictiveBackContainerProps {
  /** Whether the foreground detail screen is currently active above background */
  canGoBack: boolean;
  onBack: () => void;
  /** Parent / previous screen shown underneath during edge-swipe */
  backgroundContent?: React.ReactNode;
  /** Active detail view shown on top when canGoBack is true */
  foregroundContent?: React.ReactNode;
  /** Edge threshold from left border in CSS px (default 36px) */
  edgeWidthPx?: number;
  /** Full-viewport modal dismiss mode: fills screen seamlessly and fades scrim behind it on edge swipe */
  fullScreenModal?: boolean;
  className?: string;
}

/**
 * Predictive Back Gesture Container (Pointer Events + rAF damped spring + translate3d/scale/opacity).
 * Dragging from the left edge peels away the foreground view while smoothly revealing & parallax-scaling
 * the previous screen underneath. Works together with Top App Bar back buttons via triggerBack().
 */
export const PredictiveBackContainer = forwardRef<
  PredictiveBackHandle,
  PredictiveBackContainerProps
>(
  (
    {
      canGoBack,
      onBack,
      backgroundContent,
      foregroundContent,
      edgeWidthPx = 36,
      fullScreenModal = false,
      className = '',
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const fgRef = useRef<HTMLDivElement | null>(null);
    const bgRef = useRef<HTMLDivElement | null>(null);
    const scrimRef = useRef<HTMLDivElement | null>(null);
    const edgeIndicatorRef = useRef<HTMLDivElement | null>(null);

    const onBackRef = useRef(onBack);
    onBackRef.current = onBack;

    const dragStateRef = useRef({
      active: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      width: 380,
      pendingCommit: false,
      crossedHaptic: false,
    });

    const velocityTrackerRef = useRef(new PointerVelocityTracker());

    const applyVisualProgress = (progress: number) => {
      const clamped = Math.max(0, Math.min(1, progress));
      const width = dragStateRef.current.width || containerRef.current?.clientWidth || 380;
      const translateX = clamped * width;

      if (fgRef.current) {
        if (clamped > 0.001) {
          const fgScale = 1 - clamped * 0.055;
          fgRef.current.style.transform = `translate3d(${translateX.toFixed(2)}px, 0, 0) scale(${fgScale.toFixed(4)})`;
          fgRef.current.style.borderRadius = `${Math.round(clamped * 28)}px`;
        } else {
          fgRef.current.style.transform = '';
          fgRef.current.style.borderRadius = '0px';
        }
      }

      if (bgRef.current) {
        if (clamped > 0.001) {
          const bgTranslateX = -32 * (1 - clamped);
          const bgScale = 0.94 + 0.06 * clamped;
          bgRef.current.style.transform = `translate3d(${bgTranslateX.toFixed(2)}px, 0, 0) scale(${bgScale.toFixed(4)})`;
          bgRef.current.style.opacity = String(Math.min(1, 0.35 + 0.65 * clamped));
        } else {
          bgRef.current.style.transform = '';
          bgRef.current.style.opacity = '';
        }
      }

      if (scrimRef.current) {
        scrimRef.current.style.opacity = String(Math.max(0, 0.65 * (1 - clamped)));
      }

      if (edgeIndicatorRef.current) {
        const indicatorX = -48 + Math.min(1, clamped * 2.8) * 64;
        const indicatorScale = 0.8 + Math.min(1, clamped * 2.5) * 0.25;
        edgeIndicatorRef.current.style.transform = `translate3d(${indicatorX.toFixed(1)}px, -50%, 0) scale(${indicatorScale.toFixed(3)})`;
        edgeIndicatorRef.current.style.opacity = clamped > 0.01 ? String(Math.min(1, clamped * 3.5)) : '0';
      }
    };

    const spring = useSpringDriver({
      initialValue: 0,
      defaultConfig: { stiffness: 420, damping: 36, mass: 1 },
      onUpdate: (val) => {
        applyVisualProgress(val);
      },
      onRest: (finalVal) => {
        if (dragStateRef.current.pendingCommit && finalVal >= 0.99) {
          dragStateRef.current.pendingCommit = false;
          spring.setImmediate(0);
          onBackRef.current();
        }
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        triggerBack: () => {
          if (!canGoBack) return;
          dragStateRef.current.width = containerRef.current?.clientWidth || window.innerWidth || 380;
          dragStateRef.current.pendingCommit = true;
          spring.animateTo(1, 2.2, { stiffness: 460, damping: 38 });
        },
      }),
      [canGoBack, spring]
    );

    // Reset spring cleanly whenever screen swaps externally or modal opens
    useEffect(() => {
      dragStateRef.current.pendingCommit = false;
      dragStateRef.current.active = false;
      spring.setImmediate(0);
      if (fgRef.current && !canGoBack) {
        fgRef.current.style.transform = '';
        fgRef.current.style.borderRadius = '0px';
      }
    }, [canGoBack, spring]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canGoBack) return;
      const rect = containerRef.current?.getBoundingClientRect();
      const localX = rect ? e.clientX - rect.left : e.clientX;
      if (localX > edgeWidthPx) return;

      dragStateRef.current.active = true;
      dragStateRef.current.pointerId = e.pointerId;
      dragStateRef.current.startX = e.clientX;
      dragStateRef.current.startY = e.clientY;
      dragStateRef.current.width = rect?.width || window.innerWidth || 380;
      dragStateRef.current.crossedHaptic = false;
      dragStateRef.current.pendingCommit = false;

      // Interrupt any running return spring right under the user's finger
      const currentProgress = spring.getValue();
      spring.setImmediate(currentProgress);
      velocityTrackerRef.current.reset(currentProgress);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragStateRef.current;
      if (!ds.active || ds.pointerId !== e.pointerId) return;

      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;

      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        // Vertical gesture takes priority unless deliberate horizontal edge swipe
        if (Math.abs(dy) > 12 && Math.abs(dy) > dx) {
          ds.active = false;
          return;
        }
        if (dx > 8) {
          e.currentTarget.setPointerCapture(e.pointerId);
        } else {
          return;
        }
      }

      const progress = Math.max(0, Math.min(1, dx / Math.max(220, ds.width)));
      velocityTrackerRef.current.addSample(progress);
      spring.setImmediate(progress);

      if (!ds.crossedHaptic && progress >= 0.34) {
        ds.crossedHaptic = true;
        triggerHaptic(12);
      } else if (ds.crossedHaptic && progress < 0.28) {
        ds.crossedHaptic = false;
      }
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragStateRef.current;
      if (!ds.active || ds.pointerId !== e.pointerId) return;
      ds.active = false;

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      const p = spring.getValue();
      if (p <= 0.005) {
        spring.setImmediate(0);
        return;
      }

      const vel = velocityTrackerRef.current.getVelocity();
      // Velocity-based snapping: quick rightward flick or drag past 34% completes back navigation
      const shouldCommit = vel > 0.75 || p + vel * 0.14 >= 0.36;

      if (shouldCommit) {
        ds.pendingCommit = true;
        triggerHaptic(15);
        spring.animateTo(1, Math.max(0.8, vel));
      } else {
        ds.pendingCommit = false;
        spring.animateTo(0, vel);
      }
    };

    return (
      <div
        ref={containerRef}
        style={{ touchAction: canGoBack ? 'pan-y' : 'auto' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`relative overflow-x-clip ${className}`}
      >
        {/* Background Layer (In normal flow at root; anchored behind foreground during predictive back!) */}
        {backgroundContent && (
          <div
            ref={bgRef}
            style={{
              willChange: canGoBack ? 'transform, opacity' : 'auto',
              pointerEvents: canGoBack ? 'none' : 'auto',
            }}
            className={
              canGoBack
                ? 'absolute inset-x-0 top-0 max-h-[82vh] overflow-hidden origin-center z-0'
                : 'w-full'
            }
          >
            {backgroundContent}
          </div>
        )}

        {/* Dimming Scrim behind Foreground during swipe */}
        {canGoBack && (backgroundContent || fullScreenModal) && (
          <div
            ref={scrimRef}
            style={{ willChange: 'opacity', opacity: 0.65 }}
            className="fixed inset-0 bg-black/65 pointer-events-none z-10"
          />
        )}

        {/* Active Foreground View */}
        {foregroundContent && (canGoBack || !backgroundContent) && (
          <div
            ref={fgRef}
            style={{
              willChange: canGoBack ? 'transform' : 'auto',
              transformOrigin: 'right center',
            }}
            className={
              fullScreenModal
                ? 'relative z-20 w-full h-full flex flex-col overflow-hidden shadow-2xl'
                : 'relative z-20 w-full bg-[#090d16]/92 backdrop-blur-2xl rounded-2xl p-2 sm:p-3 border border-white/10 shadow-2xl min-h-[68vh]'
            }
          >
            {foregroundContent}
          </div>
        )}

        {/* Android-style Predictive Back Chevron Pill emerging from left edge */}
        {canGoBack && (
          <div
            ref={edgeIndicatorRef}
            style={{
              top: '50%',
              left: 0,
              willChange: 'transform, opacity',
              opacity: 0,
              transform: 'translate3d(-48px, -50%, 0)',
            }}
            className="fixed z-50 w-10 h-14 rounded-full bg-violet-500 text-white shadow-2xl shadow-violet-900/60 flex items-center justify-center pointer-events-none border border-white/25"
          >
            <ArrowLeft className="w-5 h-5" />
          </div>
        )}
      </div>
    );
  }
);

PredictiveBackContainer.displayName = 'PredictiveBackContainer';
