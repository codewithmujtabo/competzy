'use client';

// Shared competition-logo uploader — used by the admin competitions dialog and
// the organizer competition-edit page. Uploads on file-select and shows a live
// preview. Each role has its own backend endpoint that stores the image and
// sets competitions.logo_url. Fully controlled: the parent owns `logoUrl` and
// updates it from `onUploaded`.

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** Backend endpoint that stores the file, e.g. /admin/competitions/<id>/logo */
  endpoint: string;
  /** An http client exposing postFormData (adminHttp / organizerHttp). */
  http: { postFormData: <T>(path: string, fd: FormData) => Promise<T> };
  /** The current logo URL, or null when none has been set. */
  logoUrl: string | null;
  /** Called with the new URL after a successful upload. */
  onUploaded: (url: string) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function CompetitionLogoUploader({ endpoint, http, logoUrl, onUploaded }: Props) {
  // A stale/broken stored URL renders as the browser's broken-image glyph —
  // treat it as "no logo yet" instead.
  const [broken, setBroken] = useState<string | null>(null);
  const showUrl = logoUrl && logoUrl !== broken ? logoUrl : null;
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('The image must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await http.postFormData<{ logoUrl: string }>(endpoint, fd);
      onUploaded(res.logoUrl);
      toast.success('Competition logo updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload the logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
        {showUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={showUrl}
            alt="Competition logo"
            onError={() => setBroken(logoUrl)}
            className="size-full object-contain"
          />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {logoUrl ? 'Change logo' : 'Upload logo'}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          PNG, JPG or SVG · up to 5 MB · a square image works best.
        </p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
