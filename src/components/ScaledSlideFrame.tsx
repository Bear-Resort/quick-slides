import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SlideCanvasContent } from "@/components/SlideCanvasContent";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/lib/slideCanvas";
import type { SlideLayoutType } from "@/lib/slideLayout";
import type { SlideThemeId } from "@/lib/slideThemes";
import { cn } from "@/lib/utils";

type ScaledSlideFrameProps = {
  children: ReactNode;
  className?: string;
  theme?: SlideThemeId;
  slideIndex?: number;
  layout?: SlideLayoutType;
};

export function ScaledSlideFrame({
  children,
  className,
  theme = "regular",
  slideIndex = 0,
  layout = "content",
}: ScaledSlideFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("scale(1)");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;

      const scale = Math.min(width / SLIDE_WIDTH, height / SLIDE_HEIGHT);
      const scaledWidth = SLIDE_WIDTH * scale;
      const scaledHeight = SLIDE_HEIGHT * scale;
      const offsetX = (width - scaledWidth) / 2;
      const offsetY = (height - scaledHeight) / 2;

      setTransform(
        `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform,
          transformOrigin: "top left",
        }}
      >
        <SlideCanvasContent
          theme={theme}
          slideIndex={slideIndex}
          layout={layout}
          className="h-full w-full"
          style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}
        >
          {children}
        </SlideCanvasContent>
      </div>
    </div>
  );
}
