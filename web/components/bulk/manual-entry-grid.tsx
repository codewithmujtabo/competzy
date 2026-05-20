'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Inline / Excel-paste student entry grid for bulk-registration. Six columns:
 *   Full name *, Email *, WhatsApp, NISN, Grade, School name
 * Starts with 10 empty rows; the operator can add or trash rows. Each cell is
 * a plain text input. The kicker: pasting multi-cell content from Excel /
 * Google Sheets into ANY cell parses the clipboard text (TSV or CSV) and
 * spreads it across the grid starting from that cell, expanding rows as
 * needed — matches the legacy EMC entry experience and beats CSV upload for
 * small batches.
 *
 * Validation lives outside the grid: the parent decides when to submit, but
 * `isValidRow(row)` is exported so the parent can count valid rows.
 */

export interface ManualRow {
  fullName: string;
  email: string;
  phone: string;
  nisn: string;
  grade: string;
  schoolName: string;
}

const EMPTY_ROW: ManualRow = {
  fullName: '',
  email: '',
  phone: '',
  nisn: '',
  grade: '',
  schoolName: '',
};

const COLUMNS: Array<{ key: keyof ManualRow; label: string; required?: boolean; placeholder?: string }> = [
  { key: 'fullName',   label: 'Full name',  required: true,  placeholder: 'Jane Doe' },
  { key: 'email',      label: 'Email',      required: true,  placeholder: 'jane@example.com' },
  { key: 'phone',      label: 'WhatsApp',                    placeholder: '08xxx' },
  { key: 'nisn',       label: 'NISN',                        placeholder: 'optional' },
  { key: 'grade',      label: 'Grade',                       placeholder: 'e.g. 9' },
  { key: 'schoolName', label: 'School name',                 placeholder: 'optional' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isRowEmpty(r: ManualRow): boolean {
  return !r.fullName.trim() && !r.email.trim() && !r.phone.trim() && !r.nisn.trim()
    && !r.grade.trim() && !r.schoolName.trim();
}

export function isValidRow(r: ManualRow): boolean {
  if (!r.fullName.trim()) return false;
  if (!r.email.trim()) return false;
  if (!EMAIL_RE.test(r.email.trim())) return false;
  return true;
}

/** Split a pasted multiline block into a 2-D array. Handles tab AND comma. */
function parseClipboard(text: string): string[][] {
  // Strip a trailing newline, then split on real line breaks.
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  if (lines.length === 0) return [];
  // If a tab appears anywhere, prefer tab-splitting (Excel / Sheets default).
  const sep = text.includes('\t') ? '\t' : ',';
  return lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
}

interface Props {
  rows: ManualRow[];
  onChange: (rows: ManualRow[]) => void;
  /** Bumped to ~500 server-side, but the UI nudge stays at 100 for usability. */
  softMax?: number;
}

export function ManualEntryGrid({ rows, onChange, softMax = 100 }: Props) {
  const [focused, setFocused] = useState<{ row: number; col: number } | null>(null);
  const inputsRef = useRef<Map<string, HTMLInputElement>>(new Map());

  const updateCell = (rowIdx: number, key: keyof ManualRow, value: string) => {
    const next = rows.slice();
    next[rowIdx] = { ...next[rowIdx], [key]: value };
    onChange(next);
  };

  const addRow = () => onChange([...rows, { ...EMPTY_ROW }]);

  const removeRow = (idx: number) => {
    if (rows.length <= 1) {
      // Don't remove the last row — clear it instead so the grid is never empty.
      onChange([{ ...EMPTY_ROW }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== idx));
  };

  // Multi-cell paste — when the clipboard contains rows × columns of data,
  // spread it into the grid starting at the focused cell, growing the grid
  // if the pasted block extends past the bottom row.
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      // Heuristic: only intercept when this looks like a multi-cell block.
      // Single-line single-cell paste falls through to the normal Input handler
      // so the user can paste an email or a name without surprise.
      if (!text.includes('\n') && !text.includes('\t')) return;
      e.preventDefault();
      const grid = parseClipboard(text);
      if (grid.length === 0) return;

      const next = rows.slice();
      for (let r = 0; r < grid.length; r++) {
        const targetRow = rowIdx + r;
        // Grow the grid as needed.
        while (next.length <= targetRow) next.push({ ...EMPTY_ROW });
        const cells = grid[r];
        for (let c = 0; c < cells.length; c++) {
          const targetCol = colIdx + c;
          if (targetCol >= COLUMNS.length) break;
          const key = COLUMNS[targetCol].key;
          next[targetRow] = { ...next[targetRow], [key]: cells[c] };
        }
      }
      onChange(next);
    },
    [rows, onChange],
  );

  const validCount = rows.filter(isValidRow).length;
  const issueCount = rows.filter((r) => !isRowEmpty(r) && !isValidRow(r)).length;
  const overSoftMax = rows.length > softMax;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-10 px-2 py-2 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                #
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="px-2 py-2 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
                >
                  {c.label}
                  {c.required && <span className="text-destructive"> *</span>}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => {
              const empty = isRowEmpty(row);
              const invalid = !empty && !isValidRow(row);
              const emailBad = row.email.trim() !== '' && !EMAIL_RE.test(row.email.trim());
              return (
                <tr
                  key={rIdx}
                  className={cn(
                    'border-t',
                    invalid && 'bg-amber-50/60 dark:bg-amber-950/20',
                  )}
                >
                  <td className="px-2 py-1 align-middle font-mono text-xs text-muted-foreground">
                    {rIdx + 1}
                  </td>
                  {COLUMNS.map((c, cIdx) => {
                    const k = c.key;
                    const cellBad = (c.key === 'email' && emailBad)
                      || (c.required && invalid && !row[k].trim());
                    return (
                      <td key={k} className="px-1 py-1">
                        <input
                          ref={(el) => {
                            if (el) inputsRef.current.set(`${rIdx}-${cIdx}`, el);
                          }}
                          value={row[k]}
                          onFocus={() => setFocused({ row: rIdx, col: cIdx })}
                          onBlur={() => setFocused((f) => (f?.row === rIdx && f.col === cIdx ? null : f))}
                          onChange={(e) => updateCell(rIdx, k, e.target.value)}
                          onPaste={(e) => handlePaste(e, rIdx, cIdx)}
                          placeholder={c.placeholder ?? ''}
                          className={cn(
                            'w-full rounded border bg-background px-2 py-1.5 text-sm outline-none',
                            'placeholder:text-muted-foreground/60',
                            'focus:border-primary focus:ring-1 focus:ring-primary/40',
                            cellBad && 'border-destructive ring-1 ring-destructive/30',
                            focused?.row === rIdx && focused?.col === cIdx && !cellBad && 'border-primary',
                          )}
                          aria-label={`${c.label} — row ${rIdx + 1}`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-1 py-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground opacity-60 hover:text-destructive hover:opacity-100"
                      onClick={() => removeRow(rIdx)}
                      aria-label={`Remove row ${rIdx + 1}`}
                      tabIndex={-1}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-3.5" />
          Add row
        </Button>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{validCount}</span> ready
          {issueCount > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              {' · '}
              {issueCount} need{issueCount === 1 ? 's' : ''} attention
            </span>
          )}
          {overSoftMax && (
            <span className="text-amber-700 dark:text-amber-400">
              {' · '}consider splitting — {rows.length} rows is a lot for one submission
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tip — copy a block of rows from Excel or Google Sheets, click any cell, and paste. The
        grid fills automatically.
      </p>
    </div>
  );
}
