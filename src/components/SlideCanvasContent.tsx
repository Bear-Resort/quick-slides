import type { ReactNode } from "react";
import { ThemeStickerSlideDecoration } from "@/components/ThemeStickerSlideDecoration";
import type { SlideLayoutType } from "@/lib/slideLayout";
import type { SlideThemeId } from "@/lib/slideThemes";
import { isStickerSlideTheme } from "@/lib/themes/registry";
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
  return (
    <div
      className={cn("slide-canvas relative overflow-hidden", className)}
      style={style}
    >
      {isStickerSlideTheme(theme) ? (
        <ThemeStickerSlideDecoration
          themeId={theme}
          slideIndex={slideIndex}
          layout={layout}
        />
      ) : null}
      <div className="relative z-[2] h-full w-full">{children}</div>
    </div>
  );
}
