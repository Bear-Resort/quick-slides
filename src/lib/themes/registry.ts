import type { SlideThemeId } from "@/lib/slideThemes";
import { bearAcademySetup } from "@/lib/themes/bear-academy.setup";
import { theBeautiesSetup } from "@/lib/themes/the-beauties.setup";
import type { StickerSlideThemeId, StickerThemeSetup } from "@/lib/themes/types";

const STICKER_THEME_SETUPS: Record<StickerSlideThemeId, StickerThemeSetup> = {
  "bear-academy": bearAcademySetup,
  "the-beauties": theBeautiesSetup,
};

export function isStickerSlideTheme(
  themeId: SlideThemeId,
): themeId is StickerSlideThemeId {
  return themeId in STICKER_THEME_SETUPS;
}

export function getStickerThemeSetup(
  themeId: StickerSlideThemeId,
): StickerThemeSetup {
  return STICKER_THEME_SETUPS[themeId];
}

export { bearAcademySetup, theBeautiesSetup };
