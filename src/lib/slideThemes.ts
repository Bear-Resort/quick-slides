import type { CSSProperties } from "react";
import { bearAcademySetup, theBeautiesSetup } from "@/lib/themes/registry";
import { cn } from "@/lib/utils";

export type SlideThemeId =
  | "regular"
  | "gray"
  | "blue"
  | "red"
  | "green"
  | "purple"
  | "bear-academy"
  | "the-beauties";

/** Slide surface light/dark — independent of app chrome theme. */
export type SlideColorMode = "light" | "dark";

export type PresetSlideThemeId = Exclude<SlideThemeId, "regular">;

export type SlideTheme = {
  id: SlideThemeId;
  name: { en: string; zh: string };
  /** Preview chip color for light slide mode. */
  swatch: string;
  /** Preview chip color for dark slide mode. */
  swatchDark: string;
  /** Lighter swatch fill when an icon is shown on top (light mode). */
  iconSwatch?: string;
  /** Icon-chip fill for dark slide mode. */
  iconSwatchDark?: string;
  iconUrl?: string;
};

const SLIDE_THEME_IDS = new Set<SlideThemeId>([
  "regular",
  "gray",
  "blue",
  "red",
  "green",
  "purple",
  "bear-academy",
  "the-beauties",
]);

export function isSlideThemeId(value: string): value is SlideThemeId {
  return SLIDE_THEME_IDS.has(value as SlideThemeId);
}

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: "regular",
    name: { en: "Regular", zh: "默认" },
    swatch: "#e4e4e7",
    swatchDark: "#27272a",
  },
  {
    id: "gray",
    name: { en: "Gray", zh: "灰色" },
    swatch: "#9ca3af",
    swatchDark: "#3f3f46",
  },
  {
    id: "blue",
    name: { en: "Blue", zh: "蓝色" },
    swatch: "#3b82f6",
    swatchDark: "#1e3a8a",
  },
  {
    id: "red",
    name: { en: "Red", zh: "红色" },
    swatch: "#ef4444",
    swatchDark: "#7f1d1d",
  },
  {
    id: "green",
    name: { en: "Green", zh: "绿色" },
    swatch: "#22c55e",
    swatchDark: "#14532d",
  },
  {
    id: "purple",
    name: { en: "Purple", zh: "紫色" },
    swatch: "#a855f7",
    swatchDark: "#581c87",
  },
  {
    id: "bear-academy",
    name: { en: "Bear Academy", zh: "小熊學園" },
    swatch: "#eab308",
    swatchDark: "#713f12",
    iconSwatch: "#fefce8",
    iconSwatchDark: "#292524",
    iconUrl: bearAcademySetup.icon.src,
  },
  {
    id: "the-beauties",
    name: { en: "The Beauties", zh: "美少女们" },
    swatch: "#ec4899",
    swatchDark: "#9d174d",
    iconSwatch: "#fdf2f8",
    iconSwatchDark: "#1f0a14",
    iconUrl: theBeautiesSetup.icon.src,
  },
];

export const TINT_THEME_HUES: Record<Exclude<PresetSlideThemeId, "gray">, number> = {
  blue: 250,
  red: 27,
  green: 145,
  purple: 300,
  "bear-academy": 92,
  "the-beauties": 350,
};

export function isTintedSlideTheme(themeId: SlideThemeId): boolean {
  return themeId !== "regular";
}

export function resolveSlideThemeHue(themeId: SlideThemeId): number | undefined {
  if (themeId === "regular" || themeId === "gray") return undefined;
  return TINT_THEME_HUES[themeId];
}

export function getSlideThemeAttributes(
  themeId: SlideThemeId,
): { className: string; style?: CSSProperties } {
  if (themeId === "regular") {
    return { className: "slide-theme-regular" };
  }

  return {
    className: cn("slide-theme-tinted", `slide-theme-${themeId}`),
  };
}

export function slideColorModeClass(mode: SlideColorMode): string {
  return mode === "dark" ? "slide-color-dark" : "slide-color-light";
}

export function isSlideColorMode(value: string): value is SlideColorMode {
  return value === "light" || value === "dark";
}

/** @deprecated Use getSlideThemeAttributes instead. */
export function slideThemeClass(themeId: SlideThemeId): string {
  return getSlideThemeAttributes(themeId).className;
}
