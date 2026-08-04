import type { SlideLayoutType } from "@/lib/slideLayout";
import {
  getStickerPlacement,
  pickStickerForSlide,
} from "@/lib/slideStickerDecoration";
import type { StickerSlideThemeId } from "@/lib/themes/types";

type ThemeStickerSlideDecorationProps = {
  themeId: StickerSlideThemeId;
  slideIndex: number;
  layout: SlideLayoutType;
};

export function ThemeStickerSlideDecoration({
  themeId,
  slideIndex,
  layout,
}: ThemeStickerSlideDecorationProps) {
  const sticker = pickStickerForSlide(themeId, slideIndex, layout);
  if (!sticker) return null;

  const placement = getStickerPlacement(sticker);

  return (
    <img
      aria-hidden
      alt=""
      src={placement.imageUrl}
      className={placement.className}
      style={placement.style}
    />
  );
}
