import { BEAR_ACADEMY_ASSETS } from "@/lib/bearAcademyAssets";
import type { SlideThemeId } from "@/lib/slideThemes";
import { THE_BEAUTIES_ASSETS } from "@/lib/theBeautiesAssets";

export type StickerThemeAssets = {
  icon: string;
  titleBgs: readonly [string, string];
  pageBgs: readonly [string, string, string];
};

export type StickerSlideThemeId = "bear-academy" | "the-beauties";

const STICKER_THEME_ASSETS: Record<StickerSlideThemeId, StickerThemeAssets> = {
  "bear-academy": BEAR_ACADEMY_ASSETS,
  "the-beauties": THE_BEAUTIES_ASSETS,
};

export function isStickerSlideTheme(
  themeId: SlideThemeId,
): themeId is StickerSlideThemeId {
  return themeId in STICKER_THEME_ASSETS;
}

export function getStickerThemeAssets(
  themeId: StickerSlideThemeId,
): StickerThemeAssets {
  return STICKER_THEME_ASSETS[themeId];
}
