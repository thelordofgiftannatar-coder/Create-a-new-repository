import React, { useEffect, useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../services/audioEngine';

interface FastScrollerProps<T> {
  items: T[];
  getLabel: (item: T) => string;
  /** Offset from top edge below sticky app bar (px) */
  topInset?: number;
  /** Offset from bottom edge above Mini Player bar (px) */
  bottomInset?: number;
  /** Optional custom scroll element; falls back to window scrolling */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * GPU-composited touch Fast Scroller / Scroll Thumb (Pointer Events + rAF + translate3d).
 * Matches Android Musicolet vertical handle with live floating index badge during scrubbing.
 */
export function FastScroller<T>({
  items,
  getLabel,
  topInset = 114,
  bottomInset = 86,
  scrollContainerRef,
}: FastScrollerProps<T>) {
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeBadgeText, setActiveBadgeText] = useState('');

  const draggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const ratioRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  const getLabelRef = useRef(getLabel);

  itemsRef.current = items;
  getLabelRef.current = getLabel;

  const THUMB_HEIGHT = 48;

  const getScrollMetrics = useCallback(() => {
    const el = scrollContainerRef?.current;
    if (el) {
      const scrollTop = el.scrollTop;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const trackHeight = Math.max(40, el.clientHeight - THUMB_HEIGHT - 16);
      return { scrollTop, maxScroll, trackHeight };
    }
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const trackHeight = Math.max(
      60,
      window.innerHeight - topInset - bottomInset - THUMB_HEIGHT
    );
    return { scrollTop, maxScroll, trackHeight };
  }, [scrollContainerRef, topInset, bottomInset]);

  const computeBadgeLabel = useCallback((ratio: number) => {
    const list = itemsRef.current;
    if (!list || list.length === 0) return '';
    const idx = Math.min(
      list.length - 1,
      Math.max(0, Math.round(ratio * (list.length - 1)))
    );
    const raw = (getLabelRef.current(list[idx]) || '').trim();
    if (!raw) return '#';
    const firstChar = Array.from(raw)[0]?.toUpperCase() || '#';
    return /[A-Z0-9]/.test(firstChar) ? firstChar : firstChar;
  }, []);

  const positionThumbAtRatio = useCallback(
    (ratio: number) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      ratioRef.current = clamped;
      const { trackHeight } = getScrollMetrics();
      const y = clamped * trackHeight;

      if (thumbRef.current) {
        thumbRef.current.style.transform = `translate3d(0, ${y}px, 0)`;
      }
      if (bubbleRef.current) {
        bubbleRef.current.style.transform = `translate3d(0, ${y - 4}px, 0)`;
      }
    },
    [getScrollMetrics]
  );

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      if (!draggingRef.current) {
        setIsVisible(false);
      }
    }, 1400);
  }, []);

  const syncFromScroll = useCallback(() => {
    if (draggingRef.current) return;
    const { scrollTop, maxScroll } = getScrollMetrics();
    if (maxScroll <= 120 || itemsRef.current.length < 6) {
      setIsVisible(false);
      return;
    }
    const r = maxScroll > 0 ? scrollTop / maxScroll : 0;
    positionThumbAtRatio(r);
    setIsVisible(true);
    scheduleHide();
  }, [getScrollMetrics, positionThumbAtRatio, scheduleHide]);

  useEffect(() => {
    const target: EventTarget = scrollContainerRef?.current || window;
    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        syncFromScroll();
      });
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    syncFromScroll();

    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    };
  }, [scrollContainerRef, syncFromScroll, items.length]);

  const scrubToClientY = useCallback(
    (clientY: number) => {
      const rail = railRef.current;
      if (!rail) return;
      const rect = rail.getBoundingClientRect();
      const usableHeight = Math.max(1, rect.height - THUMB_HEIGHT);
      const localY = clientY - rect.top - THUMB_HEIGHT / 2;
      const ratio = Math.max(0, Math.min(1, localY / usableHeight));

      positionThumbAtRatio(ratio);

      const { maxScroll } = getScrollMetrics();
      const targetTop = ratio * maxScroll;

      const el = scrollContainerRef?.current;
      if (el) {
        el.scrollTop = targetTop;
      } else {
        window.scrollTo({ top: targetTop, behavior: 'auto' });
      }

      const nextBadge = computeBadgeLabel(ratio);
      setActiveBadgeText((prev) => {
        if (prev !== nextBadge) triggerHaptic(6);
        return nextBadge;
      });
    },
    [positionThumbAtRatio, getScrollMetrics, scrollContainerRef, computeBadgeLabel]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (itemsRef.current.length < 6) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setIsVisible(true);
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    triggerHaptic(12);
    scrubToClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    scrubToClientY(e.clientY);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || activePointerIdRef.current !== e.pointerId) return;
    draggingRef.current = false;
    activePointerIdRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    scheduleHide();
  };

  const railStyle: React.CSSProperties = scrollContainerRef
    ? { top: 8, bottom: 8 }
    : { top: topInset, bottom: bottomInset };

  return (
    <div
      ref={railRef}
      style={{
        ...railStyle,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      aria-label="Fast scroll list handle"
      role="scrollbar"
      aria-orientation="vertical"
      aria-valuenow={Math.round(ratioRef.current * 100)}
      className={`fixed right-0 z-30 w-7 flex justify-end select-none transition-opacity duration-200 ${
        isVisible || isDragging
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Floating Index / Initial Letter Bubble during drag (GPU translate3d) */}
      <div
        ref={bubbleRef}
        style={{ willChange: 'transform, opacity' }}
        className={`absolute right-9 top-0 min-w-[46px] h-12 px-3 rounded-2xl bg-violet-600/95 border border-violet-300/40 shadow-2xl shadow-violet-900/50 backdrop-blur-xl flex items-center justify-center text-white text-base font-extrabold pointer-events-none transition-opacity duration-150 ${
          isDragging && activeBadgeText ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        {activeBadgeText}
      </div>

      {/* Vertical Scroll Thumb Handle */}
      <div
        ref={thumbRef}
        style={{
          height: THUMB_HEIGHT,
          willChange: 'transform',
        }}
        className={`mr-1 rounded-full transition-colors duration-150 ${
          isDragging
            ? 'w-2 bg-violet-400 shadow-lg shadow-violet-500/40'
            : 'w-1.5 bg-slate-300/45 hover:bg-violet-400/80'
        }`}
      />
    </div>
  );
}
