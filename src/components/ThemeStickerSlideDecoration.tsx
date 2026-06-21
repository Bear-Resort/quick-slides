import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { SlideLayoutType } from "@/lib/slideLayout";
import {
  applyContentMitigation,
  clearContentMitigation,
  getInitialStickerPlacement,
  pickStickerForSlide,
  resolveStickerPlacement,
} from "@/lib/slideStickerDecoration";
import type { ResolvedStickerPlacement, StickerSlideThemeId } from "@/lib/themes/types";

type ThemeStickerSlideDecorationProps = {
  themeId: StickerSlideThemeId;
  slideIndex: number;
  layout: SlideLayoutType;
  contentRef: RefObject<HTMLElement | null>;
};

function placementEquals(
  a: ResolvedStickerPlacement,
  b: ResolvedStickerPlacement,
): boolean {
  return (
    a.className === b.className &&
    a.imageUrl === b.imageUrl &&
    a.renderedMaxHeight === b.renderedMaxHeight &&
    a.contentMitigation.shiftUpPx === b.contentMitigation.shiftUpPx &&
    a.contentMitigation.contentColumns === b.contentMitigation.contentColumns &&
    a.contentMitigation.reserveRightPx === b.contentMitigation.reserveRightPx &&
    a.contentMitigation.reserveLeftPx === b.contentMitigation.reserveLeftPx
  );
}

function bindSlideImageLoadListeners(
  content: HTMLElement,
  onUpdate: () => void,
): () => void {
  const images = content.querySelectorAll(".slide-image-panel img");
  const cleanups: Array<() => void> = [];

  for (const node of images) {
    if (!(node instanceof HTMLImageElement)) continue;
    if (node.complete) continue;
    const handler = () => onUpdate();
    node.addEventListener("load", handler);
    node.addEventListener("error", handler);
    cleanups.push(() => {
      node.removeEventListener("load", handler);
      node.removeEventListener("error", handler);
    });
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

export function ThemeStickerSlideDecoration({
  themeId,
  slideIndex,
  layout,
  contentRef,
}: ThemeStickerSlideDecorationProps) {
  const decorationRef = useRef<HTMLImageElement>(null);
  const sticker = pickStickerForSlide(themeId, slideIndex, layout);
  const [placement, setPlacement] = useState<ResolvedStickerPlacement | null>(
    () =>
      sticker
        ? getInitialStickerPlacement(
            sticker,
            slideIndex,
            layout,
            contentRef.current,
          )
        : null,
  );

  useLayoutEffect(() => {
    const content = contentRef.current;
    const decoration = decorationRef.current;
    if (!content || !decoration || !sticker) return;

    const updatePlacement = () => {
      const next = resolveStickerPlacement(
        decoration,
        content,
        sticker,
        slideIndex,
        layout,
      );
      applyContentMitigation(content, next.contentMitigation);
      setPlacement((current) =>
        current && placementEquals(current, next) ? current : next,
      );
    };

    updatePlacement();

    const resizeObserver = new ResizeObserver(updatePlacement);
    resizeObserver.observe(content);
    resizeObserver.observe(decoration);

    const unbindImageListeners = bindSlideImageLoadListeners(
      content,
      updatePlacement,
    );

    return () => {
      resizeObserver.disconnect();
      unbindImageListeners();
      clearContentMitigation(content);
    };
  }, [contentRef, sticker, slideIndex, layout]);

  if (!sticker || !placement) return null;

  return (
    <img
      ref={decorationRef}
      aria-hidden
      alt=""
      src={placement.imageUrl}
      className={placement.className}
      style={placement.style}
    />
  );
}
