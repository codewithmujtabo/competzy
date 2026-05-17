'use client';

// Bulk-issues affiliated-competition credentials from a CSV (Wave 5 Phase 2b).
// The operator downloads a template pre-filled with the competition's
// registrants, fills the username/password columns, and uploads it back.

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';

import { organizerHttp } from '@/lib/auth/organizer-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Registrant {
  registrationNumber: string;
  studentName: string;
}

interface BulkResult {
  issued: number;
  failed: number;
  errors: { registrationNumber: string; error: string }[];
}

// Minimal CSV line splitter — handles double-quoted fields (the student-name
// column is quoted in the template; usernames/passwords are plain tokens).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): { registrationNumber: string; username: string; password: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const rows: { registrationNumber: string; username: string; password: string }[] = [];
  // Row layout: registration_number, student_name, username, password.
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const registrationNumber = (cols[0] ?? '').trim();
    const username = (cols[2] ?? '').trim();
    const password = (cols[3] ?? '').trim();
    if (registrationNumber && username && password) {
      rows.push({ registrationNumber, username, password });
    }
  }
  return rows;
}

export function BulkCredentialDialog({
  open,
  competitionId,
  registrants,
  onClose,
  onDone,
}: {
  open: boolean;
  competitionId: string;
  registrants: Registrant[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const downloadTemplate = () => {
    const header = 'registration_number,student_name,username,password';
    const lines = registrants.map(
      (r) => `${r.registrationNumber},"${r.studentName.replace(/"/g, '""')}",,`,
    );
    const csv = [header, ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'credentials-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) {
        toast.error('No filled credential rows found in the file.');
        return;
      }
      const res = await organizerHttp.post<BulkResult>(
        `/competitions/${competitionId}/credentials/bulk`,
        { rows },
      );
      setResult(res);
      if (res.issued > 0) {
        toast.success(`Issued ${res.issued} credential${res.issued === 1 ? '' : 's'}.`);
        onDone();
      }
      if (res.failed > 0) {
        toast.warning(`${res.failed} row${res.failed === 1 ? '' : 's'} could not be matched.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setResult(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk issue credentials</DialogTitle>
          <DialogDescription>
            Download the registrant list, fill the <span className="font-mono">username</span> and{' '}
            <span className="font-mono">password</span> columns, then upload it back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={downloadTemplate}>
            <Download className="size-4" />
            Download template ({registrants.length} registrants)
          </Button>

          <label
            className={
              'flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed ' +
              'py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent/40 ' +
              (uploading ? 'pointer-events-none opacity-60' : '')
            }
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFile}
              disabled={uploading}
            />
            <Upload className="size-4" />
            {uploading ? 'Uploading…' : 'Upload filled CSV'}
          </label>

          {result && (
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p className="font-medium text-foreground">
                {result.issued} issued · {result.failed} failed
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {result.errors.slice(0, 6).map((er, i) => (
                    <li key={i}>
                      <span className="font-mono">{er.registrationNumber}</span> — {er.error}
                    </li>
                  ))}
                  {result.errors.length > 6 && <li>+{result.errors.length - 6} more…</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
