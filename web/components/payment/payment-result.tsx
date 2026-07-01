'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type PayState = 'verifying' | 'success' | 'pending' | 'failed';

// Per-state accent colour for the animated icon.
const TONE: Record<Exclude<PayState, 'verifying'>, string> = {
  success: '#31ab00',
  pending: '#f08c00',
  failed: '#d92d2d',
};

// Self-contained keyframes (prefixed so they never collide). The base state of
// every animated element is its FINAL visible state, so the global
// prefers-reduced-motion rule (which zeroes animation duration) degrades to a
// fully-rendered icon rather than a hidden one.
const KEYFRAMES = `
@keyframes payRing { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }
@keyframes payMark { from { stroke-dashoffset: 80; } to { stroke-dashoffset: 0; } }
@keyframes payPop  { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
@keyframes payGlow { 0%,100% { transform: scale(1); opacity: .28; } 50% { transform: scale(1.16); opacity: .1; } }
.pay-ring { stroke-dasharray: 300; stroke-dashoffset: 0; animation: payRing .7s ease-out both; }
.pay-mark { stroke-dasharray: 80; stroke-dashoffset: 0; animation: payMark .4s .5s ease-out both; }
.pay-pop  { animation: payPop .5s ease-out both; transform-origin: center; }
.pay-glow { animation: payGlow 2.6s ease-in-out infinite; transform-origin: center; }
`;

function AnimatedIcon({ state }: { state: PayState }) {
  if (state === 'verifying') {
    return (
      <div className="relative flex size-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary/10" />
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  const tone = TONE[state];
  return (
    <svg viewBox="0 0 100 100" className="size-24" role="img" aria-hidden="true">
      {/* pulsing glow backdrop */}
      <circle className="pay-glow" cx="50" cy="50" r="48" fill={tone} />
      {/* drawn ring */}
      <circle
        className="pay-ring"
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke={tone}
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      {state === 'success' && (
        <path
          className="pay-mark"
          d="M30 52 l13 14 l27 -30"
          fill="none"
          stroke={tone}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {state === 'failed' && (
        <g className="pay-pop" stroke={tone} strokeWidth="6" strokeLinecap="round">
          <line x1="36" y1="36" x2="64" y2="64" />
          <line x1="64" y1="36" x2="36" y2="64" />
        </g>
      )}
      {state === 'pending' && (
        <g className="pay-pop" stroke={tone} strokeWidth="6" strokeLinecap="round" fill="none">
          <line x1="50" y1="32" x2="50" y2="50" />
          <line x1="50" y1="50" x2="63" y2="58" />
        </g>
      )}
    </svg>
  );
}

/**
 * Animated payment-outcome block — a drawn ring + check/cross/clock, a heading,
 * a body line, and a slot for CTAs. Shared by the standalone /payment/success
 * page and the inline "fully-covered" success card on the pay page.
 */
export function PaymentResult({
  state,
  title,
  body,
  children,
}: {
  state: PayState;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <style>{KEYFRAMES}</style>
      <AnimatedIcon state={state} />
      <h2 className="mt-6 font-serif text-2xl font-semibold text-foreground">{title}</h2>
      {body && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      )}
      {children && <div className="mt-6 flex w-full flex-col items-center gap-2">{children}</div>}
    </div>
  );
}
