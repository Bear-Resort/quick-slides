import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  getPreferredStickerDecorationCorner,
  getStickerDecorationProps,
  resolveStickerDecorationCorner,
  type StickerDecorationCorner,
} from "@/lib/slideStickerDecoration";
import type { SlideLayoutType } from "@/lib/slideLayout";
import type { StickerSlideThemeId } from "@/lib/stickerThemeAssets";

type ThemeStickerSlideDecorationProps = {
  themeId: StickerSlideThemeId;
  slideIndex: number;
  layout: SlideLayoutType;
  contentRef: RefObject<HTMLElement | null>;
};

export function ThemeStickerSlideDecoration({
  themeId,
  slideIndex,
  layout,
  contentRef,
}: ThemeStickerSlideDecorationProps) {
  const decorationRef = useRef<HTMLDivElement>(null);
  const [corner, setCorner] = useState<StickerDecorationCorner>(() =>
    getPreferredStickerDecorationCorner(slideIndex),
  );

  useLayoutEffect(() => {
    const content = contentRef.current;
    const decoration = decorationRef.current;
    if (!content || !decoration) return;

    const updateCorner = () => {
      const next = resolveStickerDecorationCorner(
        decoration,
        content,
        themeId,
        slideIndex,
        layout,
      );
      setCorner((current) => (current === next ? current : next));
    };

    updateCorner();

    const observer = new ResizeObserver(updateCorner);
    observer.observe(content);
    return () => observer.disconnect();
  }, [contentRef, themeId, slideIndex, layout]);

  const props = getStickerDecorationProps(themeId, slideIndex, layout, corner);

  return (
    <div
      ref={decorationRef}
      aria-hidden
      className={props.className}
      style={props.style}
    />
  );
}
