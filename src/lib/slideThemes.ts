import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type SlideThemeId =
  | "regular"
  | "gray"
  | "blue"
  | "red"
  | "green"
  | "yellow"
  | "purple";

export type PresetSlideThemeId = Exclude<SlideThemeId, "regular">;

export type SlideTheme = {
  id: SlideThemeId;
  name: { en: string; zh: string };
  swatch: string;
};

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: "regular",
    name: { en: "Regular", zh: "默认" },
    swatch: "#d4d4d8",
  },
  {
    id: "gray",
    name: { en: "Gray", zh: "灰色" },
    swatch: "#9ca3af",
  },
  {
    id: "blue",
    name: { en: "Blue", zh: "蓝色" },
    swatch: "#3b82f6",
  },
  {
    id: "red",
    name: { en: "Red", zh: "红色" },
    swatch: "#ef4444",
  },
  {
    id: "green",
    name: { en: "Green", zh: "绿色" },
    swatch: "#22c55e",
  },
  {
    id: "yellow",
    name: { en: "Yellow", zh: "黄色" },
    swatch: "#eab308",
  },
  {
    id: "purple",
    name: { en: "Purple", zh: "紫色" },
    swatch: "#a855f7",
  },
];

export const TINT_THEME_HUES: Record<Exclude<PresetSlideThemeId, "gray">, number> = {
  blue: 250,
  red: 27,
  green: 145,
  yellow: 92,
  purple: 300,
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

/** @deprecated Use getSlideThemeAttributes instead. */
export function slideThemeClass(themeId: SlideThemeId): string {
  return getSlideThemeAttributes(themeId).className;
}
