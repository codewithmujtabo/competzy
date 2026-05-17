'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, Megaphone, Search } from 'lucide-react';
import { schoolsApi, competitionsApi, notificationsApi } from '@/lib/api';
import type { School, Competition } from '@/types';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: 'competition_announcement', label: 'Competition Announcement' },
  { value: 'deadline_reminder', label: 'Deadline Reminder' },
  { value: 'general', label: 'General' },
];

export default function NotificationsPage() {
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [allComps, setAllComps] = useState<Competition[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [province, setProvince] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [compId, setCompId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('competition_announcement');
  const [scheduled, setScheduled] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([
      schoolsApi.list({ limit: 500 }),
      competitionsApi.list({ limit: 200 }),
      schoolsApi.provinces(),
    ])
      .then(([s, c, p]) => {
        setAllSchools(Array.isArray(s?.schools) ? s.schools : []);
        setAllComps(Array.isArray(c?.competitions) ? c.competitions : []);
        setProvinces(Array.isArray(p) ? p : []);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load data');
        setAllSchools([]);
        setAllComps([]);
        setProvinces([]);
      })
      .finally(() => setLoadingData(false));
  }, []);

  useEffect(() => {
    if (!compId) return;
    const c = allComps.find((x) => x.id === compId);
    if (!c) return;
    setTitle(c.name);
    const close = c.reg_close_date
      ? ` Registration closes ${new Date(c.reg_close_date).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}.`
      : '';
    setBody(
      `${c.organizer_name} is opening registration for ${c.name}.${close} Category: ${c.category || 'General'}.`,
    );
  }, [compId, allComps]);

  const visible = allSchools.filter((s) => {
    const matchProvince = !province || s.province === province;
    const matchSearch =
      !schoolSearch ||
      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      (s.city ?? '').toLowerCase().includes(schoolSearch.toLowerCase());
    return matchProvince && matchSearch;
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const send = async () => {
    if (!title || !body || selected.size === 0) return;
    setSending(true);
    try {
      const r = await notificationsApi.broadcast({
        title,
        body,
        type,
        school_ids: [...selected],
        competition_id: compId || undefined,
        scheduled_for: scheduled || undefined,
      });
      toast.success(r.message);
      setSelected(new Set());
      setCompId('');
      setTitle('');
      setBody('');
      setScheduled('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Broadcast"
        title="Send Notification"
        subtitle="Announce a competition or send a reminder to selected schools."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* School selector */}
        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Target schools
            </span>
            <div className="flex items-center gap-1.5">
              {selected.size > 0 && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {selected.size} selected
                </Badge>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(visible.map((s) => s.id)))}>
                All
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b px-5 py-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search schools…"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
              />
            </div>
            <Select value={province || 'all'} onValueChange={(v) => setProvince(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All provinces</SelectItem>
                {provinces.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[460px] overflow-y-auto p-2">
            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No schools match.</p>
            ) : (
              visible.map((s) => {
                const on = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                      on ? 'border-primary/40 bg-accent' : 'border-transparent hover:bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-[18px] shrink-0 items-center justify-center rounded border',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {[s.city, s.province].filter(Boolean).join(', ') || s.npsn}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Composer */}
        <div className="space-y-4">
          <Card className="gap-4 p-5">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Message
            </span>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Competition (optional)</Label>
              <Select value={compId || 'none'} onValueChange={(v) => setCompId(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No competition —</SelectItem>
                  {allComps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Message <span className="text-destructive">*</span>
              </Label>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message body…"
                className="flex min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={scheduled}
                onChange={(e) => setScheduled(e.target.value)}
              />
            </div>
          </Card>

          {(title || body) && (
            <Card className="gap-3 bg-muted/40 p-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                Preview
              </span>
              <div className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Megaphone className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{title || 'Title…'}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {body || 'Message…'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={send}
            disabled={sending || !title || !body || selected.size === 0}
          >
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Megaphone className="size-4" />
                Send to {selected.size} school{selected.size === 1 ? '' : 's'}
              </>
            )}
          </Button>
          {selected.size === 0 && (
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              Select at least one school
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
