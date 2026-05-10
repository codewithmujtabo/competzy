/**
 * Competzy design tokens.
 * Modern Indonesian edutech vibe: warm palette, big rounded surfaces,
 * soft elevation, friendly micro-copy. Keep brand purple, warm everything else.
 *
 * Import tokens — never hardcode hex values, spacing, radius, or shadows.
 */

import { Platform, TextStyle } from "react-native";

// ─── Brand palette ───────────────────────────────────────────────────────────
export const Brand = {
  primary: "#6366F1",         // indigo-500 — main CTA, links, active state
  primaryDark: "#4F46E5",     // indigo-600 — pressed state
  primaryLight: "#A5B4FC",    // indigo-300 — soft backgrounds, highlights
  primarySoft: "#EEF2FF",     // indigo-50 — chips, container surfaces

  secondary: "#F97316",       // warm orange — accents, achievements, streaks
  secondarySoft: "#FFF7ED",   // orange-50 — secondary surfaces

  success: "#10B981",
  successSoft: "#ECFDF5",
  warning: "#F59E0B",
  warningSoft: "#FFFBEB",
  error: "#EF4444",
  errorSoft: "#FEF2F2",
  info: "#0EA5E9",
  infoSoft: "#F0F9FF",
} as const;

// ─── Semantic neutral surfaces (light mode) ──────────────────────────────────
export const Surface = {
  background: "#FAFAFB",      // page background — slightly off-white, warmer than pure white
  card: "#FFFFFF",            // raised cards
  cardAlt: "#F5F5F7",         // alt card / inset surface
  overlay: "rgba(15, 23, 42, 0.45)",
  divider: "#EEF0F3",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
} as const;

// ─── Semantic text colors ────────────────────────────────────────────────────
export const Text = {
  primary: "#0F172A",        // slate-900 — body & headings
  secondary: "#475569",      // slate-600 — supporting copy
  tertiary: "#94A3B8",       // slate-400 — captions, placeholders
  inverse: "#FFFFFF",
  link: Brand.primary,
} as const;

// ─── Spacing scale (4 / 8 pt rhythm) ─────────────────────────────────────────
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 56,
  "6xl": 72,
} as const;

// ─── Border radius scale ─────────────────────────────────────────────────────
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  pill: 999,
} as const;

// ─── Elevation / shadow presets (cross-platform) ─────────────────────────────
// Narrow type: only shadow-related properties so spread into Image/TextInput
// styles does not widen to full ViewStyle.
type Elevation = {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
};

export const Shadow: Record<"sm" | "md" | "lg" | "xl", Elevation> = {
  sm: Platform.select<Elevation>({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {},
  })!,
  md: Platform.select<Elevation>({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
    default: {},
  })!,
  lg: Platform.select<Elevation>({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
    },
    android: { elevation: 6 },
    default: {},
  })!,
  xl: Platform.select<Elevation>({
    ios: {
      shadowColor: Brand.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
    },
    android: { elevation: 10 },
    default: {},
  })!,
};

// ─── Typography roles (system rounded for friendly edutech feel) ─────────────
const fontFamily = Platform.select({
  ios: { rounded: "System", sans: "System", mono: "Menlo" },
  android: { rounded: "sans-serif", sans: "sans-serif", mono: "monospace" },
  default: { rounded: "System", sans: "System", mono: "monospace" },
})!;

export const Type: Record<
  | "displayLg"
  | "displayMd"
  | "h1"
  | "h2"
  | "h3"
  | "title"
  | "body"
  | "bodySm"
  | "label"
  | "caption"
  | "button",
  TextStyle
> = {
  displayLg: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -0.5, color: Text.primary, fontFamily: fontFamily.rounded },
  displayMd: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.4, color: Text.primary, fontFamily: fontFamily.rounded },
  h1:        { fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3, color: Text.primary, fontFamily: fontFamily.rounded },
  h2:        { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.2, color: Text.primary, fontFamily: fontFamily.rounded },
  h3:        { fontSize: 18, lineHeight: 24, fontWeight: "700", color: Text.primary, fontFamily: fontFamily.rounded },
  title:     { fontSize: 16, lineHeight: 22, fontWeight: "600", color: Text.primary, fontFamily: fontFamily.rounded },
  body:      { fontSize: 15, lineHeight: 22, fontWeight: "400", color: Text.primary, fontFamily: fontFamily.rounded },
  bodySm:    { fontSize: 13, lineHeight: 18, fontWeight: "400", color: Text.secondary, fontFamily: fontFamily.rounded },
  label:     { fontSize: 13, lineHeight: 16, fontWeight: "600", color: Text.secondary, fontFamily: fontFamily.rounded, letterSpacing: 0.2 },
  caption:   { fontSize: 12, lineHeight: 16, fontWeight: "500", color: Text.tertiary, fontFamily: fontFamily.rounded },
  button:    { fontSize: 16, lineHeight: 22, fontWeight: "700", color: Text.inverse, fontFamily: fontFamily.rounded, letterSpacing: 0.1 },
};

// ─── Backwards-compat: keep existing Colors export for legacy callers ────────
const tintColorLight = Brand.primary;
const tintColorDark = Brand.primaryLight;

export const Colors = {
  light: {
    text: Text.primary,
    textSecondary: Text.secondary,
    background: Surface.background,
    surface: Surface.cardAlt,
    border: Surface.border,
    tint: tintColorLight,
    icon: Text.secondary,
    tabIconDefault: Text.tertiary,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    background: "#0F172A",
    surface: "#1E293B",
    border: "#334155",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

// ─── Category color system (warmed up, illustrated edutech) ──────────────────
export const CategoryAccent: Record<string, string> = {
  Math: "#7C3AED",
  Science: "#10B981",
  Debate: "#F59E0B",
  Arts: "#EC4899",
  Language: "#3B82F6",
  Technology: "#6366F1",
  Sports: "#F97316",
};

export const CategoryBg: Record<string, string> = {
  Math: "#F5F3FF",
  Science: "#ECFDF5",
  Debate: "#FFFBEB",
  Arts: "#FDF2F8",
  Language: "#EFF6FF",
  Technology: "#EEF2FF",
  Sports: "#FFF7ED",
};

export const CategoryEmoji: Record<string, string> = {
  Math: "📐",
  Science: "🔬",
  Debate: "🎤",
  Arts: "🎨",
  Language: "📚",
  Technology: "🤖",
  Sports: "⚽",
};

export const GradeBg: Record<string, string> = {
  SD: "#DBEAFE",
  SMP: "#D1FAE5",
  SMA: "#FEF3C7",
};

export const GradeText: Record<string, string> = {
  SD: "#1D4ED8",
  SMP: "#047857",
  SMA: "#B45309",
};

// ─── Backwards-compat Fonts export ───────────────────────────────────────────
export const Fonts = Platform.select({
  ios: { sans: "system-ui", serif: "ui-serif", rounded: "ui-rounded", mono: "ui-monospace" },
  default: { sans: "normal", serif: "serif", rounded: "normal", mono: "monospace" },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ─── Animation timings ───────────────────────────────────────────────────────
export const Motion = {
  fast: 150,
  base: 220,
  slow: 320,
} as const;
