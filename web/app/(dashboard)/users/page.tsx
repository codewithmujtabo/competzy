'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Pencil, Search, UserCog, X } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { adminHttp } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { destinationFor } from '@/lib/auth/role-destination';
import type { User } from '@/types';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { UserEditDialog } from '@/components/user-edit-dialog';

const ROLES = [
  { key: 'all', label: 'All' },
  { key: 'student', label: 'Student' },
  { key: 'parent', label: 'Parent' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'school_admin', label: 'School Admin' },
  { key: 'admin', label: 'Admin' },
];

const ROLE_STYLE: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  school_admin: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  organizer: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  teacher: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  student: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  parent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

const LIMIT = 25;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');
  const [searchVal, setSearchVal] = useState('');

  // Impersonation is gated to the super-admin (GET /auth/me → isSuperAdmin).
  const { user: me } = useAuth();
  const canImpersonate = !!me?.isSuperAdmin;
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const impersonate = async (u: User) => {
    setImpersonatingId(u.id);
    try {
      await adminHttp.post(`/auth/impersonate/${u.id}`, {});
      // Hard nav so every per-role auth provider re-hydrates as the target user.
      window.location.assign(destinationFor(u.role));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not impersonate this user');
      setImpersonatingId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await usersApi.list({
        page,
        limit: LIMIT,
        role: role === 'all' ? undefined : role,
        search: search || undefined,
      });
      setUsers(r?.users ?? []);
      setTotal(r?.pagination?.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, role, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Management"
        title="Users"
        subtitle="Browse everyone registered on Competzy across all roles."
      />

      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchVal.trim());
            setPage(1);
          }}
          className="flex gap-2"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-64 pl-9"
              placeholder="Search name or email…"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setSearchVal('');
                setPage(1);
              }}
            >
              <X className="size-4" />
              Clear
            </Button>
          )}
        </form>

        <Tabs
          value={role}
          onValueChange={(v) => {
            setRole(v);
            setPage(1);
          }}
          className="ml-auto"
        >
          <TabsList>
            {ROLES.map((r) => (
              <TabsTrigger key={r.key} value={r.key}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">{u.full_name || '—'}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent font-mono text-[10px] capitalize',
                          ROLE_STYLE[u.role] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {u.role.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-[220px] truncate text-sm text-muted-foreground"
                      title={u.school_name ?? ''}
                    >
                      {u.school_name || (
                        <span className="italic text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.id === me?.id ? (
                        <span className="text-xs text-muted-foreground">You</span>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(u.id)}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                          {canImpersonate && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={impersonatingId === u.id}
                              onClick={() => impersonate(u)}
                              title="Impersonate"
                            >
                              <UserCog className="size-3.5" />
                              {impersonatingId === u.id ? 'Starting…' : 'Impersonate'}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>

      <UserEditDialog
        userId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={load}
      />
    </div>
  );
}
