import type { SlideLayoutType } from "@/lib/slideLayout";
import { getStickerThemeSetup } from "@/lib/themes/registry";
import type {
  ResolvedStickerPlacement,
  StickerSlideThemeId,
  StickerThemeEntry,
} from "@/lib/themes/types";

const EMPTY_MITIGATION = {
  shiftUpPx: 0,
  contentColumns: 1 as const,
  reserveRightPx: 0,
  reserveLeftPx: 0,
};

export function pickStickerForSlide(
  themeId: StickerSlideThemeId,
  slideIndex: number,
  layout: SlideLayoutType,
): StickerThemeEntry | null {
  const setup = getStickerThemeSetup(themeId);
  const candidates = setup.stickers.filter((entry) => entry.layouts.includes(layout));
  if (candidates.length === 0) return null;
  return candidates[slideIndex % candidates.length] ?? null;
}

/** Stickers always sit bottom-right, behind slide content. */
export function getStickerPlacement(entry: StickerThemeEntry): ResolvedStickerPlacement {
  return {
    imageUrl: entry.src,
    maxHeight: entry.maxHeight,
    renderedMaxHeight: entry.maxHeight,
    className: "slide-sticker-decoration slide-sticker-corner-br",
    style: { maxHeight: entry.maxHeight },
    contentMitigation: EMPTY_MITIGATION,
  };
}
