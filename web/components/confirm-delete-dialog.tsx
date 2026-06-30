'use client';

// A danger confirmation dialog for irreversible deletes. For high-stakes
// actions (deleting a competition wipes registrations, payments, certificates)
// it can require the operator to type the resource name to confirm — the
// GitHub/Stripe/Vercel "type-to-confirm" pattern — so a stray click can't
// destroy paid data. Set `requireTypeToConfirm={false}` for lighter deletes.

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The resource being deleted — shown prominently and used for type-to-confirm. */
  resourceName: string;
  /** Bulleted consequences rendered in the danger panel. */
  consequences: string[];
  /** Label above the type-to-confirm input (e.g. "Type the name to confirm"). */
  typeToConfirmLabel?: string;
  requireTypeToConfirm?: boolean;
  confirmLabel: string;
  confirmingLabel: string;
  cancelLabel: string;
  confirming?: boolean;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  resourceName,
  consequences,
  typeToConfirmLabel,
  requireTypeToConfirm = true,
  confirmLabel,
  confirmingLabel,
  cancelLabel,
  confirming = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the typed value whenever the dialog (re)opens for a fresh target.
  useEffect(() => {
    if (open) {
      setTyped('');
      // Focus the confirm input shortly after the dialog mounts/animates in.
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [open, resourceName]);

  const matched = !requireTypeToConfirm || typed.trim() === resourceName.trim();
  const canConfirm = matched && !confirming;

  const handleConfirm = () => {
    if (canConfirm) onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !confirming && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!confirming}>
        <DialogHeader className="items-center text-center sm:text-center">
          <div
            className="mb-1 flex size-12 items-center justify-center rounded-full bg-destructive/10 ring-8 ring-destructive/5"
            aria-hidden
          >
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <DialogTitle className="text-center text-base">{title}</DialogTitle>
        </DialogHeader>

        {/* The resource name, prominent + selectable (copy-friendly for names with
            special characters like an em-dash). */}
        <p className="text-center text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{resourceName}</span>
        </p>

        {/* Danger consequences panel. */}
        <ul className="space-y-1.5 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-[13px] leading-snug text-foreground/90">
          {consequences.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-[3px] size-1.5 shrink-0 rounded-full bg-destructive" />
              <span>{c}</span>
            </li>
          ))}
        </ul>

        {requireTypeToConfirm && (
          <div className="space-y-1.5">
            {typeToConfirmLabel && (
              <label htmlFor="confirm-delete-input" className="block text-xs text-muted-foreground">
                {typeToConfirmLabel}
              </label>
            )}
            <Input
              id="confirm-delete-input"
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              placeholder={resourceName}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={typed.length > 0 && !matched}
              className="font-mono text-sm aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm}>
            {confirming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {confirming ? confirmingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
