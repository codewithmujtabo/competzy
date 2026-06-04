'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Phase 4 — dynamic-content authoring. An English (canonical) field paired with
// an optional Bahasa Indonesia translation field, with a "Copy from English"
// shortcut. The student app shows the ID value when the locale is ID and it's
// filled, else falls back to English (see pickText). Mirrors the question-bank
// authoring pattern. Use `textarea` for long-form prose.
export function BilingualInput({
  label,
  value,
  valueId,
  onChange,
  onChangeId,
  placeholder,
  textarea,
  required,
}: {
  label: string;
  value: string;
  valueId: string;
  onChange: (v: string) => void;
  onChangeId: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  required?: boolean;
}) {
  const taCls =
    'flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          {label}
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">EN</span>
          {required && <span className="text-destructive">*</span>}
        </Label>
        {textarea ? (
          <textarea
            className={taCls}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-muted-foreground">
            {label}
            <span className="font-mono text-[9px] uppercase tracking-wide text-primary">ID</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            disabled={!value.trim()}
            onClick={() => onChangeId(value)}
          >
            Copy from English
          </Button>
        </div>
        {textarea ? (
          <textarea
            className={taCls}
            value={valueId}
            placeholder="Bahasa Indonesia (optional)"
            onChange={(e) => onChangeId(e.target.value)}
          />
        ) : (
          <Input
            value={valueId}
            placeholder="Bahasa Indonesia (optional)"
            onChange={(e) => onChangeId(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
