'use client';

import { AccountTabs } from '@/components/account/account-tabs';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Doc {
  id: string;
  docType: string;
  fileName: string;
  fileSize: number;
  fileUrl: string | null;
  uploadedAt: string;
}

// Document types — kept in sync with the mobile app's DOC_TYPES so an upload
// from either surface satisfies the same competition `required_docs` entry.
const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'id_card', label: 'ID Card' },
  { value: 'report_card', label: 'Report Card' },
  { value: 'recommendation', label: 'Recommendation Letter' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other Document' },
];

function docTypeLabel(v: string): string {
  return DOC_TYPES.find((t) => t.value === v)?.label ?? v;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AccountDocumentsPage() {
  const t = useT();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [docType, setDocType] = useState('id_card');
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      // Signed URLs expire in 15 min, so the list is always re-fetched fresh.
      setDocs(await emcHttp.get<Doc[]>('/documents'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load documents');
      setDocs([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Client-side guard before posting — backend also enforces, but failing
    // early avoids a long upload + cryptic backend error.
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      await emcHttp.postFormData<{ id: string }>('/documents/upload', fd);
      toast.success(t('acc.docUploaded'));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await emcHttp.delete<{ message: string }>(`/documents/${toDelete.id}`);
      toast.success(t('acc.docDeleted'));
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <AccountTabs />
      <PageHeader
        eyebrow={t('apf.eyebrow')}
        title={t('acc.docsTitle')}
        subtitle={t('acc.docsSubtitle')}
      />

      {/* Upload */}
      <Card className="gap-4 p-6">
        <h2 className="font-serif text-lg font-medium text-foreground">{t('acc.uploadDoc')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>{t('acc.docType')}</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            hidden
            onChange={onPick}
          />
          <Button disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {t('acc.chooseFile')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('acc.uploadHint')}</p>
      </Card>

      {/* List */}
      <Card className="gap-0 p-0">
        {!docs ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <FileText className="size-7 text-muted-foreground" />
            <h2 className="font-serif text-lg font-medium text-foreground">{t('acc.noDocuments')}</h2>
            <p className="text-sm text-muted-foreground">{t('acc.noDocsBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('acc.colType')}</TableHead>
                <TableHead>{t('acc.colFile')}</TableHead>
                <TableHead>{t('acc.colSize')}</TableHead>
                <TableHead>{t('acc.colUploaded')}</TableHead>
                <TableHead className="text-right">{t('acc.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{docTypeLabel(d.docType)}</TableCell>
                  <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                    {d.fileName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtSize(d.fileSize)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(d.uploadedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {d.fileUrl && (
                        <Button asChild size="icon" variant="ghost" title={t('acc.download')}>
                          <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="size-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title={t('acc.delete')}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setToDelete(d)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('acc.deleteDocTitle')}</DialogTitle>
            <DialogDescription>
              {t('acc.deleteDocConfirm', { name: toDelete?.fileName ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t('acc.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
