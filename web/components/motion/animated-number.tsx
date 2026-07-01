'use client';

// Count-up number for KPI tiles and hero stats. Eases toward `value` with the
// design system's expo-out curve, re-animating from the previous value when it
// changes (so live refreshes tick, not jump). Honors prefers-reduced-motion by
// rendering the final value immediately.

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  /** Formatter — receives FRACTIONAL values mid-flight; round inside if needed.
   *  Defaults to `Math.round(n).toLocaleString()`. */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}

export function AnimatedNumber({ value, format, durationMs = 900, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(from + (value - from) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString('en-US'));
  return <span className={className ?? 'tabular-nums'}>{fmt(display)}</span>;
}
