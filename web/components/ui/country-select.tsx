'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES, countryByCode } from '@/lib/constants/countries';

interface Props {
  value: string | null;                   // ISO 2-letter code, uppercase, or null.
  onChange: (code: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Searchable country picker. Renders a button trigger that opens a popover
 * with a search input + filtered country list. No external Popover dep — a
 * plain absolute-positioned panel with click-outside + Escape to close. The
 * stored value is the ISO 3166-1 alpha-2 code (uppercase).
 */
export function CountrySelect({
  value,
  onChange,
  placeholder = 'Select country',
  disabled,
  className,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = countryByCode(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  // Reset the highlight to the top of the new filtered list.
  useEffect(() => { setActiveIndex(0); }, [query]);

  // Focus the search field whenever the panel opens.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on click-outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQuery('');
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = filtered[activeIndex];
      if (c) pick(c.code);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
          'hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !selected && 'text-muted-foreground',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected ? (
            <>
              <span className="text-base leading-none">{selected.flag}</span>
              <span className="truncate text-foreground">{selected.name}</span>
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
          )}
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Type to search…"
              className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No country matches “{query}”
              </p>
            ) : (
              filtered.map((c, i) => {
                const isSel = c.code === value;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => pick(c.code)}
                    onMouseEnter={() => setActiveIndex(i)}
                    role="option"
                    aria-selected={isSel}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                      isActive && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{c.code}</span>
                    {isSel && <Check className="size-3.5 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
