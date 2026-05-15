'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} });

/**
 * Apply a theme to <html>. We set BOTH:
 *  - the `data-theme` attribute — legacy (not-yet-migrated) pages key off it
 *  - the `.dark` class — the shadcn / Tailwind v4 convention for migrated pages
 * Once every page is on the new design system the `data-theme` half is dropped.
 */
function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.setAttribute('data-theme', theme);
  el.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Pick up what the anti-flash inline script already applied.
    const current = document.documentElement.getAttribute('data-theme');
    const resolved: Theme = current === 'dark' ? 'dark' : 'light';
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch { /* ignore */ }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
