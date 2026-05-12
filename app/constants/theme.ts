/**
 * Competzy design tokens — Gen Z playful pass.
 * Claymorphism-inspired: chunky radius, soft elevation, vibrant accents.
 * Restrained on critical flows (payment, registration) — see pay.tsx.
 *
 * Import tokens — never hardcode hex values, spacing, radius, or shadows.
 */

import { Platform, TextStyle } from "react-native";

// ─── Brand palette ───────────────────────────────────────────────────────────
// Indigo-navy primary anchors trust; purple/yellow/coral/mint accents bring
// the playful Gen Z energy. Soft lavender background ties everything together.
export const Brand = {
  primary: "#6F4FE8",         // vibrant purple — main CTA, links, active state
  primaryDark: "#5A3FCB",     // deeper purple — pressed state
  primaryLight: "#B8A3F5",    // light purple — soft backgrounds, highlights
  primarySoft: "#EFEAFB",     // lavender — chips, container surfaces

  navy: "#1E2A78",            // deep indigo — display headers, anchor text
  navyDark: "#141B52",        // pressed navy
  navySoft: "#DDE3FB",        // pale navy halo

  sunshine: "#F8D24A",        // sunshine yellow — highlights, streaks, badges
  sunshineSoft: "#FFF6D6",
  coral: "#F47B5A",           // warm coral — secondary actions, accents
  coralSoft: "#FFE6DD",
  mint: "#7BD389",            // playful green — success, progress
  mintSoft: "#DFF6E2",
  sky: "#C5D8FF",             // sky blue tint — chill background
  skySoft: "#EDF3FF",

  // Semantic aliases (keep these stable so screens don't break)
  secondary: "#F47B5A",
  secondarySoft: "#FFE6DD",
  success: "#7BD389",
  successSoft: "#DFF6E2",
  warning: "#F8D24A",
  warningSoft: "#FFF6D6",
  error: "#EF5A6F",
  errorSoft: "#FEE9ED",
  info: "#5DA9FF",
  infoSoft: "#EDF3FF",
} as const;

// ─── Semantic neutral surfaces (light mode) ──────────────────────────────────
export const Surface = {
  background: "#FAF8FF",      // soft lavender-white page background
  card: "#FFFFFF",            // raised cards
  cardAlt: "#F4F1FB",         // alt surface, slightly more saturated
  overlay: "rgba(20, 27, 82, 0.55)",  // navy-tinted overlay
  divider: "#ECE7F8",
  border: "#E6E1F2",
  borderStrong: "#CFC6E8",
} as const;

// ─── Semantic text colors ────────────────────────────────────────────────────
export const Text = {
  primary: "#141B52",        // navy — body & headings (warmer than slate)
  secondary: "#5C5A7D",      // muted purple-grey
  tertiary: "#9C99B8",       // light purple-grey
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

// ─── Border radius scale — chunkier for clay-style playfulness ───────────────
export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  "2xl": 28,
  "3xl": 36,
  "4xl": 44,
  pill: 999,
} as const;

// ─── Elevation / shadow presets — soft purple-tinted clay shadows ────────────
type Elevation = {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
};

export const Shadow: Record<"sm" | "md" | "lg" | "xl" | "playful", Elevation> = {
  sm: Platform.select<Elevation>({
    ios: {
      shadowColor: "#1E2A78",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    android: { elevation: 1 },
    default: {},
  })!,
  md: Platform.select<Elevation>({
    ios: {
      shadowColor: "#1E2A78",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
    },
    android: { elevation: 3 },
    default: {},
  })!,
  lg: Platform.select<Elevation>({
    ios: {
      shadowColor: "#1E2A78",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 22,
    },
    android: { elevation: 6 },
    default: {},
  })!,
  xl: Platform.select<Elevation>({
    ios: {
      shadowColor: Brand.primary,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.22,
      shadowRadius: 26,
    },
    android: { elevation: 10 },
    default: {},
  })!,
  // Clay-style halo — chunky purple bloom for primary CTAs
  playful: Platform.select<Elevation>({
    ios: {
      shadowColor: Brand.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.32,
      shadowRadius: 18,
    },
    android: { elevation: 8 },
    default: {},
  })!,
};

// ─── Typography roles ────────────────────────────────────────────────────────
// Bumped weights on display sizes for chunkier headlines.
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
  displayLg: { fontSize: 36, lineHeight: 42, fontWeight: "900", letterSpacing: -0.8, color: Text.primary, fontFamily: fontFamily.rounded },
  displayMd: { fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: -0.6, color: Text.primary, fontFamily: fontFamily.rounded },
  h1:        { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.4, color: Text.primary, fontFamily: fontFamily.rounded },
  h2:        { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.3, color: Text.primary, fontFamily: fontFamily.rounded },
  h3:        { fontSize: 18, lineHeight: 24, fontWeight: "700", color: Text.primary, fontFamily: fontFamily.rounded },
  title:     { fontSize: 16, lineHeight: 22, fontWeight: "700", color: Text.primary, fontFamily: fontFamily.rounded },
  body:      { fontSize: 15, lineHeight: 22, fontWeight: "400", color: Text.primary, fontFamily: fontFamily.rounded },
  bodySm:    { fontSize: 13, lineHeight: 18, fontWeight: "500", color: Text.secondary, fontFamily: fontFamily.rounded },
  label:     { fontSize: 13, lineHeight: 16, fontWeight: "700", color: Text.secondary, fontFamily: fontFamily.rounded, letterSpacing: 0.3 },
  caption:   { fontSize: 12, lineHeight: 16, fontWeight: "600", color: Text.tertiary, fontFamily: fontFamily.rounded },
  button:    { fontSize: 16, lineHeight: 22, fontWeight: "800", color: Text.inverse, fontFamily: fontFamily.rounded, letterSpacing: 0.2 },
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
    text: "#F5F2FF",
    textSecondary: "#A8A4C8",
    background: "#141B52",
    surface: "#1E2A78",
    border: "#2E3A8E",
    tint: tintColorDark,
    icon: "#A8A4C8",
    tabIconDefault: "#A8A4C8",
    tabIconSelected: tintColorDark,
  },
};

// ─── Category color system — chunky vibrant tiles ────────────────────────────
export const CategoryAccent: Record<string, string> = {
  Math:       "#6F4FE8",    // vibrant purple
  Science:    "#7BD389",    // mint
  Debate:     "#F8D24A",    // sunshine
  Arts:       "#F47B5A",    // coral
  Language:   "#5DA9FF",    // sky
  Technology: "#1E2A78",    // deep navy
  Sports:     "#EF5A6F",    // berry
};

export const CategoryBg: Record<string, string> = {
  Math:       "#EFEAFB",
  Science:    "#DFF6E2",
  Debate:     "#FFF6D6",
  Arts:       "#FFE6DD",
  Language:   "#EDF3FF",
  Technology: "#DDE3FB",
  Sports:     "#FEE9ED",
};

// Kept for back-compat. New screens should use <SubjectCircle> with the
// initial letter on a colored disk instead of emoji icons.
export const CategoryEmoji: Record<string, string> = {
  Math: "📐",
  Science: "🔬",
  Debate: "🎤",
  Arts: "🎨",
  Language: "📚",
  Technology: "🤖",
  Sports: "⚽",
};

// ─── Subject-letter color system (Tuitorial-style colored disks) ─────────────
// Used by <SubjectCircle> to pick a stable color per subject name/letter.
// Falls back to a deterministic hash if not in the table.
export const SubjectColors: { bg: string; fg: string }[] = [
  { bg: "#1E2A78", fg: "#F8D24A" },  // navy + sunshine letter
  { bg: "#6F4FE8", fg: "#FFFFFF" },  // purple
  { bg: "#5DA9FF", fg: "#FFFFFF" },  // sky
  { bg: "#F47B5A", fg: "#FFFFFF" },  // coral
  { bg: "#F8D24A", fg: "#1E2A78" },  // sunshine + navy letter
  { bg: "#7BD389", fg: "#1E2A78" },  // mint + navy letter
  { bg: "#B8A3F5", fg: "#141B52" },  // lavender + navy letter
  { bg: "#EF5A6F", fg: "#FFFFFF" },  // berry
];

export function subjectColorFor(key: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return SubjectColors[Math.abs(h) % SubjectColors.length];
}

export const GradeBg: Record<string, string> = {
  SD:  "#DDE3FB",
  SMP: "#DFF6E2",
  SMA: "#FFF6D6",
};

export const GradeText: Record<string, string> = {
  SD:  "#1E2A78",
  SMP: "#3E8B4D",
  SMA: "#8A6D14",
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
