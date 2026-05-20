/**
 * Competzy design tokens — Futuristic palette.
 *
 * Pop-art futurism: Deep Indigo #3D087B primary, Hot Pink #F43B86 accent,
 * Solar Yellow #FFE459 highlight, Midnight #11052C ink on soft mauve paper.
 * Bricolage Grotesque (display) + Plus Jakarta Sans (body/UI). Crisp radii,
 * indigo-tinted shadows, yellow-on-indigo CTAs for the futuristic pop.
 *
 * Import tokens — never hardcode hex values, spacing, radius, or shadows.
 */

import { Platform, TextStyle } from "react-native";

// ─── Brand palette — Futuristic ───────────────────────────────────────────────
// Deep Indigo anchors every CTA; Hot Pink is the punchy accent; Solar Yellow
// highlights the pop-art moments; Midnight is the deepest ink. Everything sits
// on soft mauve paper.
export const Brand = {
  primary: "#3D087B",         // Deep Indigo — main CTA, links, active state
  primaryDark: "#1F0454",     // Pressed indigo
  primaryLight: "#7A3FC4",    // Lifted indigo — highlights, hover, soft
  primarySoft: "#EDE1F5",     // Mauve tint — chips, container surfaces

  navy: "#11052C",            // Midnight — display headers, deepest ink
  navyDark: "#080117",        // Pressed midnight
  navySoft: "#E5DDF0",        // Pale lavender halo

  sunshine: "#FFE459",        // Solar Yellow — highlights, accent dots, badges
  sunshineSoft: "#FFF6C9",
  coral: "#F43B86",           // Hot Pink — secondary actions, accents
  coralSoft: "#FDDAE7",
  mint: "#1F9D57",            // Green — success, progress
  mintSoft: "#D6EEDF",
  sky: "#A36EF0",             // Lavender — cool background accent
  skySoft: "#F1E4FE",

  // Semantic aliases (keep these stable so screens don't break)
  secondary: "#F43B86",
  secondarySoft: "#FDDAE7",
  success: "#1F9D57",
  successSoft: "#D6EEDF",
  warning: "#FFE459",
  warningSoft: "#FFF6C9",
  error: "#D92D2D",
  errorSoft: "#F8DEDE",
  info: "#3D087B",
  infoSoft: "#EDE1F5",
} as const;

// ─── Semantic neutral surfaces (light) ───────────────────────────────────────
// The app is light-only — futuristic on soft mauve paper.
export const Surface = {
  background: "#F4EEF9",      // soft mauve — page background
  card: "#FFFFFF",            // crisp white — raised cards
  cardAlt: "#EDE1F5",         // light mauve — alt / inset surface
  overlay: "rgba(17, 5, 44, 0.55)",   // midnight overlay
  divider: "#E0D2EE",
  border: "#DCCAEE",          // mauve border
  borderStrong: "#C7B0E0",
} as const;

// ─── Semantic text colors ────────────────────────────────────────────────────
export const Text = {
  primary: "#11052C",        // midnight — body & headings
  secondary: "#5C4677",      // muted purple-grey
  tertiary: "#8A78A3",       // light purple-grey
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

// ─── Border radius scale — flattened toward an editorial feel ────────────────
export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  "4xl": 28,
  pill: 999,
} as const;

// ─── Elevation / shadow presets — soft ink-tinted shadows ────────────────────
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
      shadowColor: "#11052C",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    android: { elevation: 1 },
    default: {},
  })!,
  md: Platform.select<Elevation>({
    ios: {
      shadowColor: "#11052C",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: { elevation: 2 },
    default: {},
  })!,
  lg: Platform.select<Elevation>({
    ios: {
      shadowColor: "#11052C",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    android: { elevation: 5 },
    default: {},
  })!,
  xl: Platform.select<Elevation>({
    ios: {
      shadowColor: "#11052C",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
    android: { elevation: 9 },
    default: {},
  })!,
  // Indigo-tinted lift for primary CTAs — the futuristic halo.
  playful: Platform.select<Elevation>({
    ios: {
      shadowColor: Brand.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.32,
      shadowRadius: 18,
    },
    android: { elevation: 6 },
    default: {},
  })!,
};

// ─── Font families ───────────────────────────────────────────────────────────
// Custom fonts are loaded in app/app/_layout.tsx (expo-font useFonts). React
// Native custom fonts are per-weight families — each name IS a weight, so the
// Type roles point at a specific weighted family and do NOT set fontWeight.
export const FontFamily = {
  displaySemi: "BricolageGrotesque_600SemiBold",
  displayBold: "BricolageGrotesque_700Bold",
  displayExtra: "BricolageGrotesque_800ExtraBold",
  bodyRegular: "PlusJakartaSans_400Regular",
  bodyMedium: "PlusJakartaSans_500Medium",
  bodySemi: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
} as const;

// ─── Typography roles ────────────────────────────────────────────────────────
// Bricolage Grotesque for display, Plus Jakarta Sans for body/UI. Sizes are
// deliberately restrained — editorial, not oversized.
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
  displayLg: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: Text.primary, fontFamily: FontFamily.displayBold },
  displayMd: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: Text.primary, fontFamily: FontFamily.displayBold },
  h1:        { fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: Text.primary, fontFamily: FontFamily.displayBold },
  h2:        { fontSize: 19, lineHeight: 25, letterSpacing: -0.2, color: Text.primary, fontFamily: FontFamily.displaySemi },
  h3:        { fontSize: 17, lineHeight: 23, color: Text.primary, fontFamily: FontFamily.displaySemi },
  title:     { fontSize: 15, lineHeight: 21, color: Text.primary, fontFamily: FontFamily.bodySemi },
  body:      { fontSize: 14, lineHeight: 21, color: Text.primary, fontFamily: FontFamily.bodyRegular },
  bodySm:    { fontSize: 13, lineHeight: 18, color: Text.secondary, fontFamily: FontFamily.bodyMedium },
  label:     { fontSize: 12, lineHeight: 16, color: Text.secondary, letterSpacing: 0.3, fontFamily: FontFamily.bodyBold },
  caption:   { fontSize: 11, lineHeight: 15, color: Text.tertiary, fontFamily: FontFamily.bodyMedium },
  button:    { fontSize: 15, lineHeight: 20, color: Text.inverse, letterSpacing: 0.1, fontFamily: FontFamily.bodyBold },
};

// ─── Backwards-compat: keep existing Colors export for legacy callers ────────
const tintColorLight = Brand.primary;
const tintColorDark = Brand.primaryLight;

export const Colors = {
  light: {
    text: Text.primary,
    textSecondary: Text.secondary,
    background: Surface.background,
    surface: Surface.card,
    border: Surface.border,
    tint: tintColorLight,
    icon: Text.secondary,
    tabIconDefault: Text.tertiary,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#F4EEF9",
    textSecondary: "#B8A8D6",
    background: "#11052C",
    surface: "#1A0D3D",
    border: "#2A1850",
    tint: tintColorDark,
    icon: "#B8A8D6",
    tabIconDefault: "#B8A8D6",
    tabIconSelected: tintColorDark,
  },
};

// ─── Category color system — Futuristic 4-color cycle ────────────────────────
export const CategoryAccent: Record<string, string> = {
  Math:       "#3D087B",    // deep indigo
  Science:    "#1F9D57",    // green (kept for semantic)
  Debate:     "#F43B86",    // hot pink
  Arts:       "#8A6D14",    // dark gold (ink-readable on yellow tint)
  Language:   "#7A3FC4",    // lifted indigo
  Technology: "#11052C",    // midnight
  Sports:     "#D92D2D",    // berry red
};

export const CategoryBg: Record<string, string> = {
  Math:       "#EDE1F5",
  Science:    "#D6EEDF",
  Debate:     "#FDDAE7",
  Arts:       "#FFF6C9",
  Language:   "#F1E4FE",
  Technology: "#E5DDF0",
  Sports:     "#F8DEDE",
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

// ─── Subject-letter color system (colored disks) ─────────────────────────────
// Used by <SubjectCircle> to pick a stable color per subject name/letter.
// Falls back to a deterministic hash if not in the table.
export const SubjectColors: { bg: string; fg: string }[] = [
  { bg: "#3D087B", fg: "#FFE459" },  // deep indigo + yellow letter
  { bg: "#F43B86", fg: "#FFFFFF" },  // hot pink + cream
  { bg: "#11052C", fg: "#FFE459" },  // midnight + yellow letter
  { bg: "#FFE459", fg: "#11052C" },  // yellow + midnight letter
  { bg: "#7A3FC4", fg: "#FFFFFF" },  // lifted indigo + white
  { bg: "#F43B86", fg: "#FFE459" },  // pink + yellow letter (pop-art)
  { bg: "#A36EF0", fg: "#11052C" },  // lavender + midnight letter
  { bg: "#1F0454", fg: "#FFE459" },  // deepest indigo + yellow letter
];

export function subjectColorFor(key: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return SubjectColors[Math.abs(h) % SubjectColors.length];
}

export const GradeBg: Record<string, string> = {
  SD:  "#EDE1F5",
  SMP: "#D6EEDF",
  SMA: "#FFF6C9",
};

export const GradeText: Record<string, string> = {
  SD:  "#3D087B",
  SMP: "#15703E",
  SMA: "#8A6D14",
};

// ─── Backwards-compat Fonts export ───────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.bodyRegular,
    serif: FontFamily.displayBold,
    rounded: FontFamily.displayBold,
    mono: "ui-monospace",
  },
  default: {
    sans: FontFamily.bodyRegular,
    serif: FontFamily.displayBold,
    rounded: FontFamily.displayBold,
    mono: "monospace",
  },
  web: {
    sans: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "'Bricolage Grotesque', Georgia, serif",
    rounded: "'Bricolage Grotesque', Georgia, serif",
    mono: "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace",
  },
});

// ─── Animation timings ───────────────────────────────────────────────────────
export const Motion = {
  fast: 150,
  base: 220,
  slow: 320,
} as const;
