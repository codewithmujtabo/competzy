import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  description?: string;
  /** Right-aligned control in the header (e.g. a range select). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Padding around the body. Defaults to comfortable card padding. */
  bodyClassName?: string;
}

/** A titled card wrapper for charts and list panels. */
export function ChartCard({ title, description, action, children, className, bodyClassName }: ChartCardProps) {
  return (
    <Card className={cn('gap-0 p-0', className)}>
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </Card>
  );
}
