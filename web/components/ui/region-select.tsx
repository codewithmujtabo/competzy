'use client';

// Cascading province + city picker for Indonesia.
// Mirrors the country-select look (button trigger → popover with a search
// input + filtered list). Province is independent; city depends on province
// and is disabled until one is chosen. Values are the human-readable names
// (e.g. "Jawa Barat" / "Kota Bandung") — that's what users.city / users.province
// store as plain TEXT.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getProvinces,
  getRegencies,
  type Province,
  type Regency,
} from '@/lib/regions/service';

interface Props {
  province: string | null;
  city: string | null;
  onChange: (next: { province: string | null; city: string | null }) => void;
  disabled?: boolean;
  className?: string;
  idProvince?: string;
  idCity?: string;
}

export function RegionSelect({
  province,
  city,
  onChange,
  disabled,
  className,
  idProvince,
  idCity,
}: Props) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [provincesLoading, setProvincesLoading] = useState(true);
  const [regencies, setRegencies] = useState<Regency[]>([]);
  const [regenciesLoading, setRegenciesLoading] = useState(false);

  // Load provinces once.
  useEffect(() => {
    let cancelled = false;
    setProvincesLoading(true);
    getProvinces()
      .then((p) => { if (!cancelled) setProvinces(p); })
      .catch(() => { /* network — silent fallback to empty list */ })
      .finally(() => { if (!cancelled) setProvincesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Resolve province name → province code → load regencies whenever province changes.
  const provinceCode = useMemo(() => {
    if (!province) return null;
    const match = provinces.find((p) => p.name.toLowerCase() === province.toLowerCase());
    return match?.code ?? null;
  }, [province, provinces]);

  useEffect(() => {
    if (!provinceCode) {
      setRegencies([]);
      return;
    }
    let cancelled = false;
    setRegenciesLoading(true);
    getRegencies(provinceCode)
      .then((r) => { if (!cancelled) setRegencies(r); })
      .catch(() => { if (!cancelled) setRegencies([]); })
      .finally(() => { if (!cancelled) setRegenciesLoading(false); });
    return () => { cancelled = true; };
  }, [provinceCode]);

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <ProvincePopover
        id={idProvince}
        disabled={disabled || provincesLoading}
        items={provinces}
        loading={provincesLoading}
        value={province}
        placeholder={provincesLoading ? 'Loading provinces…' : 'Select province'}
        emptyHint="No province matches"
        onPick={(name) => {
          if (name === province) return;
          // Clear city when province changes — the previous city no longer applies.
          onChange({ province: name, city: null });
        }}
      />
      <ProvincePopover
        id={idCity}
        disabled={disabled || !province || regenciesLoading}
        items={regencies}
        loading={regenciesLoading}
        value={city}
        placeholder={
          !province
            ? 'Pick a province first'
            : regenciesLoading
              ? 'Loading cities…'
              : 'Select city / regency'
        }
        emptyHint="No city matches"
        onPick={(name) => onChange({ province, city: name })}
      />
    </div>
  );
}

// Shared searchable popover used for both columns. Kept private to this file —
// the public API is RegionSelect.
function ProvincePopover({
  id,
  disabled,
  items,
  loading,
  value,
  placeholder,
  emptyHint,
  onPick,
}: {
  id?: string;
  disabled?: boolean;
  items: { code: string; name: string }[];
  loading: boolean;
  value: string | null;
  placeholder: string;
  emptyHint: string;
  onPick: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [query, items]);

  useEffect(() => { setActiveIndex(0); }, [query, items]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

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

  function pick(name: string) {
    onPick(name);
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
      const item = filtered[activeIndex];
      if (item) pick(item.name);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
          'hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-muted-foreground',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">
          {value ?? placeholder}
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
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {emptyHint}
                {query ? ` “${query}”` : ''}
              </p>
            ) : (
              filtered.map((it, i) => {
                const isSel = it.name === value;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={it.code}
                    type="button"
                    onClick={() => pick(it.name)}
                    onMouseEnter={() => setActiveIndex(i)}
                    role="option"
                    aria-selected={isSel}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                      isActive && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <span className="flex-1 truncate">{it.name}</span>
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
