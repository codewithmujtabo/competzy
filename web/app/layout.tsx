import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/context';
import { ThemeProvider } from '@/lib/theme/context';
import { LocaleProvider } from '@/lib/i18n/context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';
// KaTeX styles — loaded once at the root so any TipTap math node
// (Question Bank editor, student exam runner, etc.) renders correctly.
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  title: 'Competzy',
  description: 'Competzy — Indonesia’s unified K-12 academic competition platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply theme before first paint (both legacy data-theme + shadcn .dark) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'light';var e=document.documentElement;e.setAttribute('data-theme',t);if(t==='dark')e.classList.add('dark');}catch(e){}`,
          }}
        />
        {/* Anti-flash: apply locale before first paint. Auto-detect from the
            browser language on the first visit (Indonesian → 'id', else 'en');
            a manual toggle is remembered in localStorage thereafter. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem('locale');if(l!=='id'&&l!=='en'){l=(navigator.language||navigator.userLanguage||'').toLowerCase().indexOf('id')===0?'id':'en';}document.documentElement.lang=l;}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <TooltipProvider delayDuration={200}>
                {children}
              </TooltipProvider>
              <Toaster richColors closeButton position="top-right" />
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
