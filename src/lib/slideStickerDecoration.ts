import type { CSSProperties } from "react";
import type { SlideLayoutType } from "@/lib/slideLayout";
import {
  getStickerThemeAssets,
  type StickerSlideThemeId,
} from "@/lib/stickerThemeAssets";
import { cn } from "@/lib/utils";

export type StickerDecorationCorner = "br" | "bl" | "tr" | "tl";

const CORNER_CLASS: Record<StickerDecorationCorner, string> = {
  br: "slide-sticker-decoration-br",
  bl: "slide-sticker-decoration-bl",
  tr: "slide-sticker-decoration-tr",
  tl: "slide-sticker-decoration-tl",
};

const OVERLAP_SELECTORS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "blockquote",
  "table",
  "pre",
  ".slide-content-heading",
  ".slide-primary-heading",
  ".katex-display",
  "img:not(.sr-only)",
  ".slide-image-panel",
].join(",");

const OVERLAP_INSET_PX = 12;

function rectsOverlap(a: DOMRect, b: DOMRect, inset = OVERLAP_INSET_PX): boolean {
  return !(
    a.right - inset <= b.left ||
    a.left + inset >= b.right ||
    a.bottom - inset <= b.top ||
    a.top + inset >= b.bottom
  );
}

function decorationOverlapsContent(
  decorationRect: DOMRect,
  contentEl: HTMLElement,
): boolean {
  for (const el of contentEl.querySelectorAll(OVERLAP_SELECTORS)) {
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (rectsOverlap(decorationRect, rect)) return true;
  }
  return false;
}

export function getPreferredStickerDecorationCorner(
  slideIndex: number,
): StickerDecorationCorner {
  return slideIndex % 2 === 0 ? "br" : "bl";
}

/** Bottom corners first, then top corners (alternating by slide index). */
export function getStickerDecorationCornerCandidates(
  slideIndex: number,
): StickerDecorationCorner[] {
  const preferredBottom = getPreferredStickerDecorationCorner(slideIndex);
  const otherBottom: StickerDecorationCorner =
    preferredBottom === "br" ? "bl" : "br";
  const preferredTop: StickerDecorationCorner = slideIndex % 2 === 0 ? "tr" : "tl";
  const otherTop: StickerDecorationCorner = preferredTop === "tr" ? "tl" : "tr";

  return [preferredBottom, otherBottom, preferredTop, otherTop];
}

export function getStickerDecorationImage(
  themeId: StickerSlideThemeId,
  slideIndex: number,
  layout: SlideLayoutType,
): string {
  const assets = getStickerThemeAssets(themeId);
  const isTitleLike = layout === "title" || layout === "subtitle";
  const bgIndex = isTitleLike ? slideIndex % 2 : slideIndex % 3;
  return isTitleLike ? assets.titleBgs[bgIndex] : assets.pageBgs[bgIndex];
}

export function resolveStickerDecorationCorner(
  decorationEl: HTMLElement,
  contentEl: HTMLElement,
  themeId: StickerSlideThemeId,
  slideIndex: number,
  layout: SlideLayoutType,
): StickerDecorationCorner {
  const preferred = getPreferredStickerDecorationCorner(slideIndex);
  const imageUrl = getStickerDecorationImage(themeId, slideIndex, layout);
  const candidates = getStickerDecorationCornerCandidates(slideIndex);

  for (const corner of candidates) {
    decorationEl.className = cn("slide-sticker-decoration", CORNER_CLASS[corner]);
    decorationEl.style.backgroundImage = `url(${imageUrl})`;

    const decRect = decorationEl.getBoundingClientRect();
    if (!decorationOverlapsContent(decRect, contentEl)) {
      return corner;
    }
  }

  return preferred;
}

export function getStickerDecorationProps(
  themeId: StickerSlideThemeId,
  slideIndex: number,
  layout: SlideLayoutType,
  corner: StickerDecorationCorner,
): { className: string; style: CSSProperties } {
  return {
    className: cn("slide-sticker-decoration", CORNER_CLASS[corner]),
    style: {
      backgroundImage: `url(${getStickerDecorationImage(themeId, slideIndex, layout)})`,
    },
  };
}
