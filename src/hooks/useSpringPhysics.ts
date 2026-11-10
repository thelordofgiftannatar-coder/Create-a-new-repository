import { useRef, useCallback, useEffect } from 'react';

export interface SpringConfig {
  stiffness?: number; // spring constant k (default 340)
  damping?: number; // damping coefficient c (default 34)
  mass?: number; // mass m (default 1)
  restDelta?: number; // positional settle threshold (default 0.001)
  restVelocity?: number; // velocity settle threshold (default 0.004)
}

export interface SpringDriverOptions {
  initialValue?: number;
  defaultConfig?: SpringConfig;
  onUpdate: (value: number, velocity: number) => void;
  onRest?: (finalValue: number) => void;
}

/**
 * Interruptible GPU-friendly requestAnimationFrame damped spring driver.
 * Never triggers React re-renders per frame; delegates directly to onUpdate for
 * synchronous transform: translate3d / scale / opacity DOM mutations at 60/120fps.
 */
export function useSpringDriver({
  initialValue = 0,
  defaultConfig = {},
  onUpdate,
  onRest,
}: SpringDriverOptions) {
  const valueRef = useRef<number>(initialValue);
  const velocityRef = useRef<number>(0);
  const targetRef = useRef<number>(initialValue);
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const onUpdateRef = useRef(onUpdate);
  const onRestRef = useRef(onRest);
  onUpdateRef.current = onUpdate;
  onRestRef.current = onRest;

  const stop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastTimeRef.current = 0;
  }, []);

  const setImmediate = useCallback(
    (value: number, velocity = 0) => {
      stop();
      valueRef.current = value;
      targetRef.current = value;
      velocityRef.current = velocity;
      onUpdateRef.current(value, velocity);
    },
    [stop]
  );

  const animateTo = useCallback(
    (target: number, initialVelocity?: number, overrideConfig?: SpringConfig) => {
      stop();
      targetRef.current = target;
      if (initialVelocity !== undefined) {
        velocityRef.current = initialVelocity;
      }

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        valueRef.current = target;
        velocityRef.current = 0;
        onUpdateRef.current(target, 0);
        onRestRef.current?.(target);
        return;
      }

      const stiffness = overrideConfig?.stiffness ?? defaultConfig.stiffness ?? 360;
      const damping = overrideConfig?.damping ?? defaultConfig.damping ?? 34;
      const mass = overrideConfig?.mass ?? defaultConfig.mass ?? 1;
      const restDelta = overrideConfig?.restDelta ?? defaultConfig.restDelta ?? 0.0012;
      const restVelocity = overrideConfig?.restVelocity ?? defaultConfig.restVelocity ?? 0.005;

      lastTimeRef.current = performance.now();

      const tick = (now: number) => {
        const rawDt = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;
        // Clamp frame delta to max 32ms so tab backgrounding never explodes solver
        const dt = Math.min(Math.max(rawDt, 0.001), 0.032);

        // Sub-step integration (max 8ms step) for crisp 120Hz / 60Hz numerical stability
        const subSteps = dt > 0.01 ? 2 : 1;
        const stepDt = dt / subSteps;

        let x = valueRef.current;
        let v = velocityRef.current;

        for (let i = 0; i < subSteps; i++) {
          const displacement = x - targetRef.current;
          const force = -stiffness * displacement - damping * v;
          const accel = force / mass;
          v += accel * stepDt;
          x += v * stepDt;
        }

        valueRef.current = x;
        velocityRef.current = v;

        const isAtRest =
          Math.abs(targetRef.current - x) <= restDelta && Math.abs(v) <= restVelocity;

        if (isAtRest) {
          valueRef.current = targetRef.current;
          velocityRef.current = 0;
          rafIdRef.current = null;
          onUpdateRef.current(targetRef.current, 0);
          onRestRef.current?.(targetRef.current);
          return;
        }

        onUpdateRef.current(x, v);
        rafIdRef.current = requestAnimationFrame(tick);
      };

      rafIdRef.current = requestAnimationFrame(tick);
    },
    [stop, defaultConfig.stiffness, defaultConfig.damping, defaultConfig.mass, defaultConfig.restDelta, defaultConfig.restVelocity]
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    getValue: () => valueRef.current,
    getVelocity: () => velocityRef.current,
    getTarget: () => targetRef.current,
    isAnimating: () => rafIdRef.current !== null,
    stop,
    setImmediate,
    animateTo,
  };
}

/**
 * Rolling pointer sample velocity estimator over the trailing ~90ms window.
 * Gives smooth, noise-free release velocity (units / second) for velocity-based snapping.
 */
export class PointerVelocityTracker {
  private samples: Array<{ val: number; time: number }> = [];
  private readonly windowMs = 95;

  reset(initialVal = 0) {
    this.samples = [{ val: initialVal, time: performance.now() }];
  }

  addSample(val: number) {
    const now = performance.now();
    this.samples.push({ val, time: now });
    const cutoff = now - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
  }

  getVelocity(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dtSec = (last.time - first.time) / 1000;
    if (dtSec <= 0.004) return 0;
    return (last.val - first.val) / dtSec;
  }
}
