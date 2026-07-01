'use client';

// Cascading location picker — Country → Province → City — with a per-field
// "+ Add custom" footer that flips that one field into a free-text input when
// the canonical list doesn't carry the student's actual place. Picking a new
// country clears province + city (the previous values no longer apply, which
// is exactly what closes the Malaysia/Bandung data-integrity gap).
//
// Province + city data exists only for Indonesia (via emsifa.com — the same
// source the mobile app uses). For any other country both fields render as
// free text from the start — typing fake region data we don't have would be
// worse than asking the user to enter it themselves.
//
// Saved values that aren't in the canonical list (because the user typed them
// via "Add custom" previously) auto-restore in free-text mode on mount.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CountrySelect } from '@/components/ui/country-select';
import { Input } from '@/components/ui/input';
import {
  getProvinces,
  getRegencies,
  type Province,
  type Regency,
} from '@/lib/regions/service';

interface Props {
  country: string | null;
  province: string | null;
  city: string | null;
  onChange: (next: {
    country: string | null;
    province: string | null;
    city: string | null;
  }) => void;
  disabled?: boolean;
  idCountry?: string;
  idProvince?: string;
  idCity?: string;
}

export function LocationCascade({
  country,
  province,
  city,
  onChange,
  disabled,
  idCountry,
  idProvince,
  idCity,
}: Props) {
  const isIndonesia = country === 'ID';

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [provincesLoading, setProvincesLoading] = useState(false);
  const [regencies, setRegencies] = useState<Regency[]>([]);
  const [regenciesLoading, setRegenciesLoading] = useState(false);

  // Indonesia only — load provinces once when the country toggles to ID.
  useEffect(() => {
    if (!isIndonesia) {
      setProvinces([]);
      return;
    }
    let cancelled = false;
    setProvincesLoading(true);
    getProvinces()
      .then((p) => {
        if (!cancelled) setProvinces(p);
      })
      .catch(() => {
        /* silent — fall back to free-text */
      })
      .finally(() => {
        if (!cancelled) setProvincesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isIndonesia]);

  // Resolve province name → code → load regencies whenever province changes.
  const provinceCode = useMemo(() => {
    if (!isIndonesia || !province) return null;
    const match = provinces.find((p) => p.name.toLowerCase() === province.toLowerCase());
    return match?.code ?? null;
  }, [isIndonesia, province, provinces]);

  useEffect(() => {
    if (!provinceCode) {
      setRegencies([]);
      return;
    }
    let cancelled = false;
    setRegenciesLoading(true);
    getRegencies(provinceCode)
      .then((r) => {
        if (!cancelled) setRegencies(r);
      })
      .catch(() => {
        if (!cancelled) setRegencies([]);
      })
      .finally(() => {
        if (!cancelled) setRegenciesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  const handleCountry = (code: string | null) => {
    // Country change clears province + city — previous values no longer apply.
    if (code === country) return;
    onChange({ country: code, province: null, city: null });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {/* Country — always a dropdown */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Country</span>
        <CountrySelect
          id={idCountry}
          value={country}
          onChange={handleCountry}
          placeholder="Select country"
          disabled={disabled}
        />
      </div>

      {/* Province */}
      <CascadeField
        id={idProvince}
        label="Province"
        value={province}
        onChange={(v) => onChange({ country, province: v, city: null })}
        items={isIndonesia ? provinces : null}
        loading={provincesLoading}
        disabled={disabled || !country}
        emptyHint="No province matches"
        placeholderList="Select province"
        placeholderText={
          !country
            ? 'Pick a country first'
            : isIndonesia
              ? 'Type your province'
              : 'Type your province / state'
        }
        customLabel="province"
      />

      {/* City */}
      <CascadeField
        id={idCity}
        label="City"
        value={city}
        onChange={(v) => onChange({ country, province, city: v })}
        items={isIndonesia && province ? regencies : null}
        loading={regenciesLoading}
        disabled={disabled || !province}
        emptyHint="No city matches"
        placeholderList="Select city / regency"
        placeholderText={
          !country
            ? 'Pick a country first'
            : !province
              ? 'Pick a province first'
              : isIndonesia
                ? 'Type your city'
                : 'Type your city'
        }
        customLabel="city"
      />
    </div>
  );
}

// One row of the cascade. When `items` is null → render a free-text input
// (international, or no-country-yet). When `items` is provided → render a
// searchable popover with an "Add custom" footer that flips the field to free
// text. A saved value that's not in the list auto-flips on mount.
function CascadeField({
  id,
  label,
  value,
  onChange,
  items,
  loading,
  disabled,
  emptyHint,
  placeholderList,
  placeholderText,
  customLabel,
}: {
  id?: string;
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  items: { code: string; name: string }[] | null;
  loading: boolean;
  disabled?: boolean;
  emptyHint: string;
  placeholderList: string;
  placeholderText: string;
  customLabel: string;
}) {
  // Free-text mode: when items === null (international) OR the saved value
  // isn't in the canonical list OR the user explicitly chose "Add custom".
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    if (!items) {
      setCustom(false); // disable mode — pure free-text below
      return;
    }
    if (!value) {
      setCustom(false);
      return;
    }
    const inList = items.some((it) => it.name.toLowerCase() === value.toLowerCase());
    if (!inList && items.length > 0) setCustom(true);
  }, [items, value]);

  // International / pre-country: pure free text.
  if (items === null) {
    return (
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Input
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={placeholderText}
          disabled={disabled}
        />
      </div>
    );
  }

  // Indonesia + we have items: popover, with a custom-text fallback.
  if (custom) {
    return (
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="relative">
          <Input
            id={id}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={placeholderText}
            disabled={disabled}
            className="pr-8"
          />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setCustom(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Pick from list instead"
            title="Pick from list instead"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <CascadePopover
        id={id}
        items={items}
        loading={loading}
        disabled={disabled}
        value={value}
        placeholder={loading ? `Loading ${customLabel}s…` : placeholderList}
        emptyHint={emptyHint}
        onPick={(name) => onChange(name)}
        onAddCustom={() => {
          onChange(null);
          setCustom(true);
        }}
        customLabel={customLabel}
      />
    </div>
  );
}

function CascadePopover({
  id,
  disabled,
  items,
  loading,
  value,
  placeholder,
  emptyHint,
  onPick,
  onAddCustom,
  customLabel,
}: {
  id?: string;
  disabled?: boolean;
  items: { code: string; name: string }[];
  loading: boolean;
  value: string | null;
  placeholder: string;
  emptyHint: string;
  onPick: (name: string) => void;
  onAddCustom: () => void;
  customLabel: string;
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

  useEffect(() => {
    setActiveIndex(0);
  }, [query, items]);

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
        <span className="min-w-0 truncate">{value ?? placeholder}</span>
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
          {/* "+ Add custom" footer — flips this field to a free-text input. */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQuery('');
              onAddCustom();
            }}
            className="flex w-full items-center gap-2 border-t bg-muted/30 px-3 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-muted"
          >
            {value && !filtered.some((it) => it.name === value) ? (
              <Pencil className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>
              Add custom {customLabel}
              <span className="text-muted-foreground">, type it manually</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
