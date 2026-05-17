/**
 * Competzy design tokens — the competzy.com brand identity (EMC Wave 3).
 *
 * Editorial, not playful: Electric Indigo violet + Hot Pink accent on ivory
 * cream paper, ink text. Bricolage Grotesque for display, Plus Jakarta Sans
 * for body/UI (loaded in app/app/_layout.tsx via expo-font). Flat radii and
 * soft ink shadows — calm and grown-up.
 *
 * Import tokens — never hardcode hex values, spacing, radius, or shadows.
 */

import { Platform, TextStyle } from "react-native";

// ─── Brand palette — the competzy.com identity ───────────────────────────────
// Electric Indigo anchors trust + every CTA; Hot Pink is the punchy accent;
// Gold highlights; everything sits on warm ivory paper.
export const Brand = {
  primary: "#5627FF",         // Electric Indigo — main CTA, links, active state
  primaryDark: "#3F18CC",     // deeper indigo — pressed state
  primaryLight: "#B19EFF",    // sirih light violet — soft highlights
  primarySoft: "#E9E3FF",     // violet tint — chips, container surfaces

  navy: "#211A2E",            // deep ink-violet — display headers, anchor text
  navyDark: "#161214",        // near-black ink — pressed
  navySoft: "#ECE6FF",        // pale violet halo

  sunshine: "#F8DB46",        // gold — highlights, streaks, badges
  sunshineSoft: "#FCEFB6",
  coral: "#D9277B",           // hot pink — secondary actions, accents
  coralSoft: "#FBDDEC",
  mint: "#1F9D57",            // green — success, progress
  mintSoft: "#D6EEDF",
  sky: "#7D63FF",             // sirih violet tint — cool background accent
  skySoft: "#ECE7FF",

  // Semantic aliases (keep these stable so screens don't break)
  secondary: "#D9277B",
  secondarySoft: "#FBDDEC",
  success: "#1F9D57",
  successSoft: "#D6EEDF",
  warning: "#F8DB46",
  warningSoft: "#FCEFB6",
  error: "#D92D2D",
  errorSoft: "#F8DEDE",
  info: "#5627FF",
  infoSoft: "#E9E3FF",
} as const;

// ─── Semantic neutral surfaces (light) ───────────────────────────────────────
// The app is light-only — competzy.com is an ivory-paper brand.
export const Surface = {
  background: "#F4ECDC",      // ivory cream — page background
  card: "#FBF5E6",            // lighter cream — raised cards
  cardAlt: "#ECE1CA",         // warm cream — alt / inset surface
  overlay: "rgba(22, 18, 20, 0.55)",  // ink-tinted overlay
  divider: "#E4DAC4",
  border: "#DDD1B9",          // mist border
  borderStrong: "#CFC6B0",
} as const;

// ─── Semantic text colors ────────────────────────────────────────────────────
export const Text = {
  primary: "#161214",        // ink — body & headings
  secondary: "#6E6358",      // warm mist-grey
  tertiary: "#9C9080",       // light warm grey
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
      shadowColor: "#161214",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    android: { elevation: 1 },
    default: {},
  })!,
  md: Platform.select<Elevation>({
    ios: {
      shadowColor: "#161214",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
    },
    android: { elevation: 2 },
    default: {},
  })!,
  lg: Platform.select<Elevation>({
    ios: {
      shadowColor: "#161214",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
    },
    android: { elevation: 5 },
    default: {},
  })!,
  xl: Platform.select<Elevation>({
    ios: {
      shadowColor: "#161214",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.13,
      shadowRadius: 24,
    },
    android: { elevation: 9 },
    default: {},
  })!,
  // Calm brand-tinted lift for primary CTAs (was the Sprint-19 clay halo).
  playful: Platform.select<Elevation>({
    ios: {
      shadowColor: Brand.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
    },
    android: { elevation: 4 },
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
    text: "#F1E9DA",
    textSecondary: "#A99FB2",
    background: "#17131B",
    surface: "#211B27",
    border: "#2B2431",
    tint: tintColorDark,
    icon: "#A99FB2",
    tabIconDefault: "#A99FB2",
    tabIconSelected: tintColorDark,
  },
};

// ─── Category color system — harmonised with the ivory + violet brand ────────
export const CategoryAccent: Record<string, string> = {
  Math:       "#5627FF",    // electric indigo
  Science:    "#1F9D57",    // green
  Debate:     "#D9277B",    // hot pink
  Arts:       "#E07A1F",    // warm amber
  Language:   "#7D63FF",    // sirih violet
  Technology: "#211A2E",    // ink
  Sports:     "#C0392B",    // berry red
};

export const CategoryBg: Record<string, string> = {
  Math:       "#E9E3FF",
  Science:    "#D6EEDF",
  Debate:     "#FBDDEC",
  Arts:       "#F7E6CC",
  Language:   "#ECE7FF",
  Technology: "#E4DAC4",
  Sports:     "#F4DAD6",
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
  { bg: "#5627FF", fg: "#FFFFFF" },  // electric indigo
  { bg: "#D9277B", fg: "#FFFFFF" },  // hot pink
  { bg: "#211A2E", fg: "#F8DB46" },  // ink + gold letter
  { bg: "#1F9D57", fg: "#FFFFFF" },  // green
  { bg: "#F8DB46", fg: "#211A2E" },  // gold + ink letter
  { bg: "#7D63FF", fg: "#FFFFFF" },  // sirih violet
  { bg: "#E07A1F", fg: "#FFFFFF" },  // amber
  { bg: "#B19EFF", fg: "#211A2E" },  // light violet + ink letter
];

export function subjectColorFor(key: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return SubjectColors[Math.abs(h) % SubjectColors.length];
}

export const GradeBg: Record<string, string> = {
  SD:  "#E9E3FF",
  SMP: "#D6EEDF",
  SMA: "#FCEFB6",
};

export const GradeText: Record<string, string> = {
  SD:  "#3F18CC",
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
