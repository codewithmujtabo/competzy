import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PagerProps {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

/** Compact prev/next pagination footer for table cards. */
export function Pager({ page, total, limit, onChange }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of {pages}
        <span className="hidden sm:inline"> · {total.toLocaleString('en-US')} total</span>
      </p>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
