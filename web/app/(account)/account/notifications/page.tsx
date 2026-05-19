'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Loader2,
  Trash2,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

interface NotifResponse {
  notifications: Notif[];
  unreadCount: number;
}

const PAGE = 30;

// Icon per notification type — falls back to a bell for anything unmapped.
const TYPE_ICON: Record<string, LucideIcon> = {
  deadline: CalendarClock,
  approval: CheckCircle2,
  payment: CreditCard,
  competition: Trophy,
  registration: ClipboardList,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AccountNotificationsPage() {
  const [items, setItems] = useState<Notif[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchPage = useCallback(async (off: number): Promise<Notif[]> => {
    const r = await emcHttp.get<NotifResponse>(`/notifications?limit=${PAGE}&offset=${off}`);
    setUnread(r.unreadCount);
    // The API has no grand total — a full page means there may be more.
    setHasMore(r.notifications.length === PAGE);
    return r.notifications;
  }, []);

  useEffect(() => {
    fetchPage(0)
      .then((n) => {
        setItems(n);
        setOffset(n.length);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load notifications');
        setItems([]);
      });
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const more = await fetchPage(offset);
      setItems((cur) => [...(cur ?? []), ...more]);
      setOffset((o) => o + more.length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(n: Notif) {
    if (n.read) return;
    setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
    setUnread((u) => Math.max(0, u - 1));
    try {
      await emcHttp.post<{ message: string }>(`/notifications/${n.id}/read`, {});
    } catch {
      setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: false } : x)) ?? null);
      setUnread((u) => u + 1);
      toast.error('Could not mark as read');
    }
  }

  async function markAll() {
    if (unread === 0) return;
    setBusy(true);
    try {
      await emcHttp.post<{ message: string }>('/notifications/read-all', {});
      setItems((cur) => cur?.map((x) => ({ ...x, read: true })) ?? null);
      setUnread(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to mark all read');
    } finally {
      setBusy(false);
    }
  }

  async function remove(n: Notif) {
    setItems((cur) => cur?.filter((x) => x.id !== n.id) ?? null);
    if (!n.read) setUnread((u) => Math.max(0, u - 1));
    try {
      await emcHttp.delete<{ message: string }>(`/notifications/${n.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
      // Re-sync on failure so the list reflects the server.
      fetchPage(0)
        .then((nn) => {
          setItems(nn);
          setOffset(nn.length);
        })
        .catch(() => {});
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="My Account"
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up.'}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={markAll}
            disabled={busy || unread === 0}
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        }
      />

      {!items ? (
        <Card className="items-center p-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </Card>
      ) : items.length === 0 ? (
        <Card className="items-center gap-2 p-12 text-center">
          <Bell className="size-7 text-muted-foreground" />
          <h2 className="font-serif text-lg font-medium text-foreground">No notifications</h2>
          <p className="text-sm text-muted-foreground">
            Updates about your competitions will appear here.
          </p>
        </Card>
      ) : (
        <>
          <Card className="gap-0 p-0">
            {items.map((n, i) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              return (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-3 p-4',
                    i > 0 && 'border-t',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => markRead(n)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={cn(
                        'text-sm text-foreground',
                        n.read ? 'font-medium' : 'font-semibold',
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </button>
                  {!n.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(n)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </Card>
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
