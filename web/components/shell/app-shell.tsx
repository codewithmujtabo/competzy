'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Bell, LogOut, Moon, Settings, Sun } from 'lucide-react';

import { useTheme } from '@/lib/theme/context';
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LocaleToggle } from '@/components/shell/locale-toggle';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImpersonationBanner } from '@/components/impersonation-banner';

export interface NavItem {
  /** Plain fallback label (operator portals). */
  label: string;
  /** When set, the label is translated via `useT()` (student/parent nav). */
  labelKey?: MessageKey;
  href: string;
  icon: LucideIcon;
  /** Match the pathname exactly instead of by prefix. */
  exact?: boolean;
  badge?: string | number;
  /**
   * When true, render a plain anchor instead of a Next.js Link — used for
   * download links (e.g. the Achievement PDF endpoint) and any href that
   * shouldn't take part in client-side navigation.
   */
  external?: boolean;
  /**
   * Extra pathname prefixes that also mark this item active — e.g. a global
   * item that stays lit on related sub-routes (its own tabs, or a nested
   * portal that's logically "inside" this item).
   */
  activePrefixes?: string[];
}

export interface NavSection {
  /** Optional small heading shown above the group. */
  label?: string;
  /** When set, the heading is translated via `useT()`. */
  labelKey?: MessageKey;
  items: NavItem[];
}

export interface AppShellUser {
  name: string;
  email: string;
  role?: string;
}

export interface AppShellProps {
  brand: { name: string; tagline: string; taglineKey?: MessageKey; icon: LucideIcon };
  nav: NavSection[];
  user: AppShellUser;
  onSignOut: () => void;
  /** When set, the top-bar bell links here; otherwise it stays inert. */
  notificationsHref?: string;
  /** When set, the user dropdown's "Account Settings" item links here. */
  profileHref?: string;
  children: React.ReactNode;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(item.href + '/')) return true;
  return (item.activePrefixes ?? []).some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

/**
 * The unified Competzy operator/portal chrome — a collapsible sidebar + a
 * sticky top bar. Every web portal renders its pages inside one of these,
 * passing its own role-gated `nav` config; the look is identical across roles.
 *
 * The user identity (avatar, name, sign-out) lives in the top bar (right
 * side, next to the bell). The sidebar is dedicated to navigation only.
 *
 * The ImpersonationBanner renders inside the workspace (SidebarInset) so
 * it pushes the header + main content down naturally, instead of overlaying
 * either. When there's no impersonation it returns null and has zero
 * layout impact.
 */
export function AppShell({
  brand,
  nav,
  user,
  onSignOut,
  notificationsHref,
  profileHref,
  children,
}: AppShellProps) {
  const pathname = usePathname() ?? '';
  const { theme, toggle } = useTheme();
  const t = useT();
  const navLabel = (item: { labelKey?: MessageKey; label: string }) =>
    item.labelKey ? t(item.labelKey) : item.label;
  const isMobile = useIsMobile();
  const BrandIcon = brand.icon;

  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        className="border-r-0 bg-gradient-to-b from-white via-white to-[#f5f0ff]"
      >
        <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-[#7849ff] to-[#937aff] text-primary-foreground shadow-[0_10px_28px_-12px_rgba(86,39,255,0.65)]">
              <BrandIcon className="size-[1.4rem]" />
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#f8db46] ring-2 ring-white" />
            </div>
            <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
              <span className="font-serif text-lg font-semibold tracking-tight">{brand.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">
                {brand.taglineKey ? t(brand.taglineKey) : brand.tagline}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {nav.map((section, i) => (
            <SidebarGroup key={section.label ?? section.labelKey ?? i}>
              {(section.label || section.labelKey) && (
                <SidebarGroupLabel>
                  {section.labelKey ? t(section.labelKey) : section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const active = isActive(pathname, item);
                    const Icon = item.icon;
                    const label = navLabel(item);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={label}>
                          {item.external ? (
                            <a href={item.href} target="_blank" rel="noreferrer">
                              <Icon />
                              <span>{label}</span>
                            </a>
                          ) : (
                            <Link href={item.href}>
                              <Icon />
                              <span>{label}</span>
                            </Link>
                          )}
                        </SidebarMenuButton>
                        {item.badge != null && (
                          <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      {/* bg-transparent: the body carries the landing's --gradient-hero, and
          the workspace must let it show through on every portal page. */}
      <SidebarInset className="bg-transparent">
        {/* Impersonation banner — renders inside the workspace so it pushes
            the header + content down instead of overlaying them. Returns
            null when not impersonating, so layout is unaffected normally. */}
        <ImpersonationBanner />

        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          {user.role && (
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {user.role}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <LocaleToggle className="mr-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === 'dark' ? t('shell.lightMode') : t('shell.darkMode')}
              title={theme === 'dark' ? t('shell.lightMode') : t('shell.darkMode')}
            >
              {theme === 'dark' ? <Sun className="size-[1.1rem]" /> : <Moon className="size-[1.1rem]" />}
            </Button>
            {notificationsHref ? (
              <Button variant="ghost" size="icon" aria-label={t('shell.notifications')} title={t('shell.notifications')} asChild>
                <Link href={notificationsHref}>
                  <Bell className="size-[1.1rem]" />
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="icon" aria-label={t('shell.notifications')} title={t('shell.notifications')}>
                <Bell className="size-[1.1rem]" />
              </Button>
            )}

            <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

            {/* User menu — moved out of the sidebar footer into the top
                bar so it's reachable from every page without scrolling
                the sidebar, and one-clickable next to the bell. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="ml-1 h-10 gap-2 rounded-full px-1.5 pr-2.5 data-[state=open]:bg-accent"
                  aria-label={t('shell.accountMenu')}
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-[#7849ff] text-[12px] font-semibold text-primary-foreground">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                    {user.name.split(' ')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? 'bottom' : 'bottom'}
                align="end"
                sideOffset={8}
                className="w-60"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid leading-tight">
                    <span className="text-sm font-semibold">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profileHref && (
                  <DropdownMenuItem asChild>
                    <Link href={profileHref}>
                      <Settings className="size-4" />
                      {t('shell.accountSettings')}
                    </Link>
                  </DropdownMenuItem>
                )}
                {profileHref && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={onSignOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  {t('shell.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {/* `overflow-x-hidden` clips any horizontal overflow at the inset
            level so the sticky header above can't slide horizontally and
            overlay the sidebar. Inner overflow-x-auto containers (tables,
            wide diagrams) still scroll horizontally inside themselves. */}
        {/* Keying the wrapper on pathname replays the fade-up on every client
            navigation — the design system's page-transition without a router
            animation lib. Reduced-motion users get an instant swap (global
            prefers-reduced-motion reset in globals.css). */}
        <main className={cn('flex-1 overflow-y-auto overflow-x-hidden')}>
          <div key={pathname} className="animate-fade-up [animation-duration:450ms]">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
