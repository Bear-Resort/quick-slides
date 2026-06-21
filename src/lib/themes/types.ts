import type { CSSProperties } from "react";
import type { SlideLayoutType } from "@/lib/slideLayout";

export type StickerCorner = "br" | "bl";

export type StickerSidePlacement = "bottom" | "center";

export type StickerContentMitigation = {
  shiftUpPx: number;
  /** Split overflowing text into 2 or 3 columns (1 = no split). */
  contentColumns: 1 | 2 | 3;
  /** Extra right padding on the body so text clears a side-mounted sticker. */
  reserveRightPx: number;
  /** Extra left padding on the body so text clears a left-mounted sticker. */
  reserveLeftPx: number;
};

/** One sticker image and how it should appear on matching slides. */
export type StickerThemeEntry = {
  /** Filename in `themes/<theme-id>/` (for reference when swapping assets). */
  file: string;
  /** Bundled image URL from Vite. */
  src: string;
  /** Maximum rendered height in px on the 1280×720 canvas — adjust per asset. */
  maxHeight: number;
  /** Slide layouts that may use this sticker. */
  layouts: SlideLayoutType[];
};

export type StickerThemeSetup = {
  id: StickerSlideThemeId;
  icon: { file: string; src: string };
  stickers: StickerThemeEntry[];
};

export type StickerSlideThemeId = "bear-academy" | "the-beauties";

export type ResolvedStickerPlacement = {
  imageUrl: string;
  maxHeight: number;
  renderedMaxHeight: number;
  className: string;
  style: CSSProperties;
  contentMitigation: StickerContentMitigation;
};
