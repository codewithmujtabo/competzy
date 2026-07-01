'use client';

import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

// Competzy Design System — a single, self-contained showcase of the shared
// design language: the competzy.com brand palette, typography, and the
// shadcn/ui component set. The page renders entirely from the live Tailwind v4
// token layer (web/app/globals.css), so it always reflects the real system.
// Public route — no auth, mirrors /privacy and /terms.

interface ColorRow {
  name: string;
  cls: string;
  hex: string;
  note?: string;
}

const brandColors: ColorRow[] = [
  { name: 'Primary', cls: 'bg-primary', hex: '#5627FF', note: 'Electric Indigo' },
  { name: 'Brand Pink', cls: 'bg-brand-pink', hex: '#D9277B', note: 'Hot Pink accent' },
  { name: 'Brand Gold', cls: 'bg-brand-gold', hex: '#F8DB46', note: 'Sunshine' },
  { name: 'Accent', cls: 'bg-accent', hex: '#E9E3FF', note: 'Soft violet tint' },
];

const surfaceColors: ColorRow[] = [
  { name: 'Background', cls: 'bg-background', hex: '#F4ECDC', note: 'Ivory paper' },
  { name: 'Card', cls: 'bg-card', hex: '#FAF3E3' },
  { name: 'Secondary', cls: 'bg-secondary', hex: '#EBE0C8' },
  { name: 'Muted', cls: 'bg-muted', hex: '#ECE1CA' },
  { name: 'Border', cls: 'bg-border', hex: '#DDD1B9' },
  { name: 'Foreground', cls: 'bg-foreground', hex: '#161214', note: 'Ink text' },
];

const statusColors: ColorRow[] = [
  { name: 'Success', cls: 'bg-success', hex: '#1F9D57' },
  { name: 'Warning', cls: 'bg-warning', hex: '#F8DB46' },
  { name: 'Destructive', cls: 'bg-destructive', hex: '#D92D2D' },
];

const chartColors: ColorRow[] = [
  { name: 'Chart 1', cls: 'bg-chart-1', hex: '#5627FF' },
  { name: 'Chart 2', cls: 'bg-chart-2', hex: '#D9277B' },
  { name: 'Chart 3', cls: 'bg-chart-3', hex: '#F8DB46' },
  { name: 'Chart 4', cls: 'bg-chart-4', hex: '#937AFF' },
  { name: 'Chart 5', cls: 'bg-chart-5', hex: '#1F9D57' },
];

interface TypeRow {
  label: string;
  cls: string;
  meta: string;
  sample: string;
}

const typeScale: TypeRow[] = [
  { label: 'Display', cls: 'font-serif text-4xl font-semibold', meta: 'Bricolage · 36 / 600', sample: 'Compete. Learn. Grow.' },
  { label: 'Heading 1', cls: 'font-serif text-2xl font-semibold', meta: 'Bricolage · 24 / 600', sample: 'Mathematics Competition' },
  { label: 'Heading 2', cls: 'font-serif text-lg font-medium', meta: 'Bricolage · 18 / 500', sample: 'Question Bank workspace' },
  { label: 'Body', cls: 'text-base', meta: 'Plus Jakarta · 16 / 400', sample: 'Indonesia’s unified K-12 academic competition platform.' },
  { label: 'Small', cls: 'text-sm text-muted-foreground', meta: 'Plus Jakarta · 14 / 400', sample: 'Saved competitions, applications, and ones you’ve joined.' },
  { label: 'Mono', cls: 'font-mono text-sm', meta: 'JetBrains Mono · 14', sample: 'CTZ-2026-00042' },
];

const radii = [
  { name: 'sm', cls: 'rounded-sm' },
  { name: 'md', cls: 'rounded-md' },
  { name: 'lg', cls: 'rounded-lg' },
  { name: 'xl', cls: 'rounded-xl' },
  { name: '2xl', cls: 'rounded-2xl' },
];

function Swatch({ name, cls, hex, note }: ColorRow) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className={`h-20 w-full ${cls}`} />
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">{name}</p>
        {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{hex}</p>
      </div>
    </div>
  );
}

function SwatchGrid({ label, rows }: { label: string; rows: ColorRow[] }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((c) => (
          <Swatch key={c.name} {...c} />
        ))}
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-7">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-1.5 font-serif text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const [dark, setDark] = useState(false);

  // Dark mode is scoped to this page by toggling `.dark` on the wrapper — the
  // shadcn dark variant (`&:is(.dark *)`) recolours every descendant token, so
  // no global side effect leaks to the rest of the app.
  return (
    <div className={dark ? 'dark' : undefined}>
      <div className="min-h-screen bg-background text-foreground">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/85 px-6 py-3.5 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-serif text-sm font-bold text-primary-foreground">
              C
            </div>
            <div className="leading-tight">
              <p className="font-serif text-sm font-semibold text-foreground">Competzy</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Design System
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDark((d) => !d)}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {dark ? 'Light' : 'Dark'}
          </Button>
        </header>

        {/* Hero */}
        <section className="border-b bg-gradient-to-br from-primary to-[#3a1bb8] px-6 py-20 text-center text-primary-foreground">
          <p className="font-mono text-xs uppercase tracking-[0.22em] opacity-80">
            The Competzy design language
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">
            One system across every Competzy surface
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm opacity-90">
            Colors, typography, and components, the shared vocabulary behind the admin,
            organizer, school, and student portals and the mobile app.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {['Tailwind v4', 'shadcn/ui', 'Bricolage Grotesque', 'Plus Jakarta Sans'].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 font-mono text-[11px]"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        <main className="mx-auto max-w-5xl space-y-20 px-6 py-16">
          {/* Color */}
          <Section
            eyebrow="Foundations"
            title="Color"
            description="An ivory-cream paper ground, Electric Indigo as the primary, and Hot Pink for accents. Every value is a CSS token with a matched dark-mode variant. Toggle the header switch to preview."
          >
            <div className="space-y-7">
              <SwatchGrid label="Brand" rows={brandColors} />
              <SwatchGrid label="Surfaces & text" rows={surfaceColors} />
              <SwatchGrid label="Status" rows={statusColors} />
              <SwatchGrid label="Data / charts" rows={chartColors} />
            </div>
          </Section>

          {/* Typography */}
          <Section
            eyebrow="Foundations"
            title="Typography"
            description="Bricolage Grotesque carries display and headings; Plus Jakarta Sans is the body face; JetBrains Mono is reserved for codes, IDs, and labels."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <p className="font-serif text-5xl font-semibold text-foreground">Aa</p>
                <p className="mt-3 text-sm font-medium text-foreground">Bricolage Grotesque</p>
                <p className="text-xs text-muted-foreground">Display & headings</p>
              </Card>
              <Card className="p-5">
                <p className="text-5xl font-semibold text-foreground">Aa</p>
                <p className="mt-3 text-sm font-medium text-foreground">Plus Jakarta Sans</p>
                <p className="text-xs text-muted-foreground">Body & UI</p>
              </Card>
              <Card className="p-5">
                <p className="font-mono text-5xl font-semibold text-foreground">Aa</p>
                <p className="mt-3 text-sm font-medium text-foreground">JetBrains Mono</p>
                <p className="text-xs text-muted-foreground">Codes & labels</p>
              </Card>
            </div>
            <Card className="divide-y p-0">
              {typeScale.map((t) => (
                <div key={t.label} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-4">
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-medium text-foreground">{t.label}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{t.meta}</p>
                  </div>
                  <p className={`${t.cls} text-foreground`}>{t.sample}</p>
                </div>
              ))}
            </Card>
          </Section>

          {/* Radius */}
          <Section
            eyebrow="Foundations"
            title="Radius"
            description="Corner rounding steps from a 0.7rem base. Cards and dialogs use lg; pills and inputs use md."
          >
            <div className="flex flex-wrap gap-5">
              {radii.map((r) => (
                <div key={r.name} className="text-center">
                  <div className={`size-20 border-2 border-primary bg-accent ${r.cls}`} />
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{r.name}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Components */}
          <Section
            eyebrow="Library"
            title="Components"
            description="The shadcn/ui primitives, themed to the Competzy tokens. These are the exact components used across the portals."
          >
            <div className="space-y-4">
              <Card className="space-y-4 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Buttons, variants
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Buttons, sizes
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                </div>
              </Card>

              <Card className="space-y-4 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Badges
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="space-y-3 p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Form input
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="ds-email">Email address</Label>
                    <Input id="ds-email" type="email" placeholder="student@school.id" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ds-code">Registration code</Label>
                    <Input id="ds-code" placeholder="CTZ-2026-XXXXX" />
                  </div>
                </Card>
                <Card className="space-y-3 p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Loading state
                  </p>
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-3/4" />
                  <Skeleton className="h-9 w-1/2" />
                </Card>
              </div>

              <Card className="space-y-2 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Card
                </p>
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  Mathematics Competition
                </h3>
                <p className="text-sm text-muted-foreground">
                  The card is the workhorse container. Sectioned content, list rows, and stat
                  panels across every portal sit on it.
                </p>
                <div className="flex gap-2 pt-1">
                  <Badge variant="secondary">Native</Badge>
                  <Badge variant="outline">Registration open</Badge>
                </div>
              </Card>
            </div>
          </Section>
        </main>

        <footer className="border-t px-6 py-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Competzy · Design System
          </p>
        </footer>
      </div>
    </div>
  );
}
