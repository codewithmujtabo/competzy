import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatAccent = 'teal' | 'indigo' | 'amber' | 'rose' | 'green';

/** Full class strings (not interpolated) so Tailwind's scanner keeps them. */
const ACCENT: Record<StatAccent, string> = {
  teal: 'bg-chart-1/10 text-chart-1',
  indigo: 'bg-chart-2/10 text-chart-2',
  amber: 'bg-chart-3/10 text-chart-3',
  rose: 'bg-chart-4/10 text-chart-4',
  green: 'bg-chart-5/10 text-chart-5',
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** Small muted line under the value. */
  hint?: string;
  accent?: StatAccent;
  className?: string;
}

/** A KPI card — label, big serif value, optional hint, accent-tinted icon tile. */
export function StatCard({ label, value, icon: Icon, hint, accent = 'teal', className }: StatCardProps) {
  return (
    <Card className={cn('gap-0 p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', ACCENT[accent])}>
          <Icon className="size-[1.1rem]" />
        </span>
      </div>
      <p className="mt-3 font-serif text-3xl font-medium tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
