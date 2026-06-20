import { useRef, type ReactNode } from "react";
import { ThemeStickerSlideDecoration } from "@/components/ThemeStickerSlideDecoration";
import type { SlideLayoutType } from "@/lib/slideLayout";
import type { SlideThemeId } from "@/lib/slideThemes";
import { isStickerSlideTheme } from "@/lib/stickerThemeAssets";
import { cn } from "@/lib/utils";

type SlideCanvasContentProps = {
  theme: SlideThemeId;
  slideIndex: number;
  layout: SlideLayoutType;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function SlideCanvasContent({
  theme,
  slideIndex,
  layout,
  children,
  className,
  style,
}: SlideCanvasContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn("slide-canvas relative overflow-hidden bg-card", className)}
      style={style}
    >
      {isStickerSlideTheme(theme) ? (
        <ThemeStickerSlideDecoration
          themeId={theme}
          slideIndex={slideIndex}
          layout={layout}
          contentRef={contentRef}
        />
      ) : null}
      <div ref={contentRef} className="relative z-[2] h-full w-full">
        {children}
      </div>
    </div>
  );
}
