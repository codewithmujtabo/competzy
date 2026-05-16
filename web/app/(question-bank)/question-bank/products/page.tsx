'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageIcon, Package, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { commerceHttp } from '@/lib/api/client';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

const LIMIT = 20;
const TEXTAREA_CLS =
  'flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

interface Product {
  id: string;
  compId: string;
  code: string;
  name: string;
  slug: string;
  price: number;
  description: string | null;
  image: string | null;
  active: boolean;
  createdAt: string;
}

const DEFAULTS = { name: '', price: '', description: '', active: true };

function rupiah(n: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

export default function ProductsPage() {
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(DEFAULTS);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        compId: selectedId,
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) qs.set('search', search);
      const r = await commerceHttp.get<{ products: Product[]; pagination: { total: number } }>(
        `/commerce/products?${qs}`,
      );
      setRows(r.products ?? []);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [selectedId, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(DEFAULTS);
    setImageFile(null);
    setImagePreview(null);
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      price: String(p.price),
      description: p.description ?? '',
      active: p.active,
    });
    setImageFile(null);
    setImagePreview(p.image);
    setOpen(true);
  };

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!form.name.trim() || !selectedId) return;
    setSaving(true);
    try {
      const body = {
        compId: selectedId,
        name: form.name.trim(),
        price: Number(form.price) || 0,
        description: form.description.trim() || null,
        active: form.active,
      };
      const product = editing
        ? await commerceHttp.put<Product>(`/commerce/products/${editing.id}`, body)
        : await commerceHttp.post<Product>('/commerce/products', body);
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await commerceHttp.postFormData(`/commerce/products/${product.id}/image`, fd);
      }
      toast.success(editing ? 'Product saved.' : 'Product added.');
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    setBusy(p.id);
    try {
      await commerceHttp.delete(`/commerce/products/${p.id}`);
      toast.success('Product removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete product');
    } finally {
      setBusy(null);
    }
  };

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Commerce" title="Products" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A merchandise catalog is available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Commerce"
        title="Products"
        subtitle="The merchandise catalog students can order from this competition's store."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CompetitionPicker className="w-full sm:w-72" />
        <Button onClick={openAdd} disabled={!selectedId}>
          <Plus className="size-4" />
          Add product
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchVal.trim());
          setPage(1);
        }}
        className="flex gap-2"
      >
        <Input
          className="w-64"
          placeholder="Search name or code…"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-28">Code</TableHead>
                <TableHead className="w-36">Price</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No products yet — add the first one.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt={p.name}
                          className="size-10 rounded-md border bg-muted object-cover"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                          <ImageIcon className="size-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {p.code}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{rupiah(p.price)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          p.active
                            ? 'border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'border-transparent bg-muted font-mono text-[10px] text-muted-foreground'
                        }
                      >
                        {p.active ? 'Active' : 'Hidden'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={busy === p.id}
                          onClick={() => remove(p)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit product' : 'Add product'}</DialogTitle>
            <DialogDescription>
              {editing ? `Code ${editing.code}` : 'A new item in this competition’s store.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex items-center gap-4">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="preview"
                  className="size-20 rounded-lg border bg-muted object-cover"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <Package className="size-6" />
                </div>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={pickImage}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" />
                  {imagePreview ? 'Change image' : 'Upload image'}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">JPEG / PNG / WebP, up to 5 MB.</p>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Official competition T-shirt"
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Price (Rp)</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="85000"
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description shown in the store."
                rows={3}
                className={TEXTAREA_CLS}
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="size-4 accent-primary"
              />
              Visible in the store
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Save product' : 'Add product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
