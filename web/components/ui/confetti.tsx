'use client';

import { useEffect, useRef } from 'react';

// Self-contained celebratory confetti — a one-shot particle burst on a fixed,
// full-screen canvas. No dependencies. Honours prefers-reduced-motion (renders
// nothing and calls onDone immediately). Auto-cleans once the burst settles.
//
// Colours follow the Competzy brand palette (warm gold/pink + cyan family)
// rather than a generic rainbow.
const COLORS = ['#F7B643', '#BE65A9', '#FEE404', '#4BC2EC', '#4CBCBE', '#65C8DB', '#ffffff'];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: number;
};

export function Confetti({
  duration = 4200,
  count = 180,
  onDone,
}: {
  duration?: number;
  count?: number;
  onDone?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep the latest onDone without retriggering the effect.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      onDoneRef.current?.();
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = window.innerWidth;
    let H = window.innerHeight;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    // Two lower corners fire up-and-inward for a fuller celebration.
    const particles: Particle[] = Array.from({ length: count }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? W * 0.12 : W * 0.88,
        y: H * 0.55,
        vx: fromLeft ? rand(2.5, 10) : rand(-10, -2.5),
        vy: rand(-15, -7),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.22, 0.22),
        size: rand(6, 13),
        color: COLORS[i % COLORS.length],
        shape: i % 3,
      };
    });

    const gravity = 0.26;
    const drag = 0.995;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);
      const fade =
        elapsed > duration - 1000 ? Math.max(0, 1 - (elapsed - (duration - 1000)) / 1000) : 1;
      for (const p of particles) {
        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size * 0.42, p.size);
        }
        ctx.restore();
      }
      if (elapsed < duration) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, W, H);
        onDoneRef.current?.();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [duration, count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[200] h-full w-full"
    />
  );
}
