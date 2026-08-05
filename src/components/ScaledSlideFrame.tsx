import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SlideCanvasContent } from "@/components/SlideCanvasContent";
import { replaceMathEquationsForCapture } from "@/lib/exportMathJax";
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

type CanvasPlacement = {
  left: number;
  top: number;
  scale: number;
};

function isAppleWebKit(): boolean {
  return typeof CSS !== "undefined" && CSS.supports("font: -apple-system-body");
}

/** Prefer CSS zoom over transform:scale when available. */
function preferZoomScale(): boolean {
  if (typeof CSS === "undefined") return false;
  return CSS.supports("zoom", "1") || isAppleWebKit();
}

export function ScaledSlideFrame({
  children,
  className,
  theme = "regular",
  slideIndex = 0,
  layout = "content",
}: ScaledSlideFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<HTMLDivElement>(null);
  const useZoom = preferZoomScale();
  const useMathJaxPaint = isAppleWebKit();
  const [placement, setPlacement] = useState<CanvasPlacement>({
    left: 0,
    top: 0,
    scale: 1,
  });
  const paintGenRef = useRef(0);

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

      setPlacement({
        left: (width - scaledWidth) / 2,
        top: (height - scaledHeight) / 2,
        scale,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /**
   * Safari paints KaTeX HTML wrong under zoom/transform even when layout
   * metrics are correct. Keep React KaTeX hidden; show a clone with MathJax SVGs.
   */
  useLayoutEffect(() => {
    if (!useMathJaxPaint) return;
    const source = sourceRef.current;
    const paint = paintRef.current;
    if (!source || !paint) return;

    const generation = ++paintGenRef.current;
    let cancelled = false;

    const run = async () => {
      const clone = source.cloneNode(true) as HTMLElement;
      clone.style.opacity = "1";
      clone.style.visibility = "visible";
      clone.style.position = "relative";
      clone.removeAttribute("aria-hidden");

      try {
        await replaceMathEquationsForCapture(clone);
      } catch {
        // Keep KaTeX clone if MathJax fails.
      }
      if (cancelled || generation !== paintGenRef.current) return;

      paint.replaceChildren(clone);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [useMathJaxPaint, children, placement.scale]);

  const frameStyle: CSSProperties = useZoom
    ? {
        position: "absolute",
        left: placement.left,
        top: placement.top,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        zoom: placement.scale,
      }
    : {
        position: "absolute",
        left: 0,
        top: 0,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        transform: `translate(${placement.left}px, ${placement.top}px) scale(${placement.scale})`,
        transformOrigin: "top left",
      };

  const slide = (
    <SlideCanvasContent
      theme={theme}
      slideIndex={slideIndex}
      layout={layout}
      className="h-full w-full"
      style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}
    >
      {children}
    </SlideCanvasContent>
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      <div className="absolute left-0 top-0" style={frameStyle}>
        {useMathJaxPaint ? (
          <>
            <div
              ref={sourceRef}
              aria-hidden
              className="absolute left-0 top-0"
              style={{
                width: SLIDE_WIDTH,
                height: SLIDE_HEIGHT,
                opacity: 0,
                visibility: "hidden",
                pointerEvents: "none",
              }}
            >
              {slide}
            </div>
            <div
              ref={paintRef}
              className="absolute left-0 top-0"
              style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}
            />
          </>
        ) : (
          <div ref={sourceRef} className="absolute left-0 top-0 h-full w-full">
            {slide}
          </div>
        )}
      </div>
    </div>
  );
}
