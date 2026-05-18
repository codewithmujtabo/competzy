'use client';

import { cn } from '@/lib/utils';

// Numeric grades 1-12 — the platform's grade vocabulary (replaced SD/SMP/SMA).
const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));

interface GradeMultiSelectProps {
  /** Comma-joined selected grades, e.g. "7,8,9". */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * A toggle-chip multi-select for numeric grades 1-12. Reads/writes a
 * comma-joined string so it drops straight into the competition forms'
 * existing `grade_level` text field.
 */
export function GradeMultiSelect({ value, onChange, className }: GradeMultiSelectProps) {
  const selected = new Set(
    value
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean),
  );

  const toggle = (g: string) => {
    const next = new Set(selected);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    onChange([...next].sort((a, b) => Number(a) - Number(b)).join(','));
  };

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {GRADES.map((g) => {
        const on = selected.has(g);
        return (
          <button
            key={g}
            type="button"
            onClick={() => toggle(g)}
            aria-pressed={on}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-transparent text-muted-foreground hover:bg-accent',
            )}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}
