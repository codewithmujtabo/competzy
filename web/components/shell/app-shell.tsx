'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Bell, ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';

import { useTheme } from '@/lib/theme/context';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface NavItem {
  label: string;
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
}

export interface NavSection {
  /** Optional small heading shown above the group. */
  label?: string;
  items: NavItem[];
}

export interface AppShellUser {
  name: string;
  email: string;
  role?: string;
}

export interface AppShellProps {
  brand: { name: string; tagline: string; icon: LucideIcon };
  nav: NavSection[];
  user: AppShellUser;
  onSignOut: () => void;
  /** When set, the top-bar bell links here; otherwise it stays inert. */
  notificationsHref?: string;
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
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

/**
 * The unified Competzy operator/portal chrome — a collapsible sidebar + a
 * sticky top bar. Every web portal renders its pages inside one of these,
 * passing its own role-gated `nav` config; the look is identical across roles.
 */
export function AppShell({
  brand,
  nav,
  user,
  onSignOut,
  notificationsHref,
  children,
}: AppShellProps) {
  const pathname = usePathname() ?? '';
  const { theme, toggle } = useTheme();
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
                {brand.tagline}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {nav.map((section, i) => (
            <SidebarGroup key={section.label ?? i}>
              {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const active = isActive(pathname, item);
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          {item.external ? (
                            // Plain anchor for download endpoints (e.g. PDFs).
                            // target="_blank" so the active page state survives.
                            <a href={item.href} target="_blank" rel="noreferrer">
                              <Icon />
                              <span>{item.label}</span>
                            </a>
                          ) : (
                            <Link href={item.href}>
                              <Icon />
                              <span>{item.label}</span>
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

        <SidebarFooter className="border-t border-sidebar-border/60 pt-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="rounded-2xl bg-gradient-to-br from-[#f5f0ff] to-white data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-10 rounded-xl">
                      <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary to-[#7849ff] text-primary-foreground font-semibold">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-semibold">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side={isMobile ? 'bottom' : 'right'}
                  align="end"
                  sideOffset={8}
                  className="w-56"
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="grid leading-tight">
                      <span className="text-sm font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          {user.role && (
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {user.role}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="size-[1.1rem]" /> : <Moon className="size-[1.1rem]" />}
            </Button>
            {notificationsHref ? (
              <Button variant="ghost" size="icon" aria-label="Notifications" title="Notifications" asChild>
                <Link href={notificationsHref}>
                  <Bell className="size-[1.1rem]" />
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="icon" aria-label="Notifications" title="Notifications">
                <Bell className="size-[1.1rem]" />
              </Button>
            )}
          </div>
        </header>
        <main className={cn('flex-1 overflow-y-auto')}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
