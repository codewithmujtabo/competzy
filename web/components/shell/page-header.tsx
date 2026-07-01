import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Small mono uppercase line above the title. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned controls (buttons, filters). */
  actions?: React.ReactNode;
  className?: string;
}

/** The standard page heading — eyebrow + display title + subtitle, optional actions.
 *  Enters with the design system's fade-up; actions follow a beat later. */
export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 animate-fade-up">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 animate-fade-up flex-wrap items-center gap-2 [animation-delay:120ms]">
          {actions}
        </div>
      )}
    </div>
  );
}
