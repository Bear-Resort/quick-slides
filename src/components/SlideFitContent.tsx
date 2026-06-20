import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type SlideFitContentProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Center content vertically when it fits on the slide. */
  verticalAlign?: "top" | "center";
  /** Skip auto-scaling (used for PDF export capture). */
  disableFit?: boolean;
};

const FILL_MARGIN = 0.98;

export function SlideFitContent({
  children,
  className,
  contentClassName,
  verticalAlign = "top",
  disableFit = false,
}: SlideFitContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [listColumns, setListColumns] = useState(false);
  const [scale, setScale] = useState(1);
  const [heightOverflow, setHeightOverflow] = useState(false);

  const remeasure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    setListColumns(false);
    setScale(1);
    setHeightOverflow(false);
    content.style.transform = "";
    content.style.width = "";

    requestAnimationFrame(() => {
      const needsMoreHeight = content.scrollHeight > container.clientHeight + 1;

      const applyScale = () => {
        const scaleH = container.clientHeight / content.scrollHeight;
        const scaleW = container.clientWidth / content.scrollWidth;

        if (scaleH < 1) {
          setHeightOverflow(true);
          const shrink = Math.min(scaleH, scaleW, 1) * FILL_MARGIN;
          setScale(Math.max(shrink, 0.4));
          return;
        }

        setHeightOverflow(false);

        if (scaleW < 1) {
          setScale(scaleW);
          return;
        }

        setScale(1);
      };

      if (!needsMoreHeight) {
        applyScale();
        return;
      }

      setListColumns(true);

      requestAnimationFrame(() => {
        applyScale();
      });
    });
  }, []);

  useLayoutEffect(() => {
    remeasure();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(remeasure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [children, remeasure]);

  const shouldCenter = verticalAlign === "center" && !heightOverflow;
  const scaled = !disableFit && (scale < 0.999 || scale > 1.001);

  if (disableFit) {
    return (
      <div className={cn("h-full min-h-0 w-full overflow-hidden", className)}>
        <div
          className={cn(
            "flex h-full w-full justify-start",
            verticalAlign === "center" ? "items-center" : "items-start",
          )}
        >
          <div className={cn("w-full", contentClassName)}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("h-full min-h-0 w-full overflow-hidden", className)}
    >
      <div
        className={cn(
          "flex h-full w-full justify-start",
          shouldCenter ? "items-center" : "items-start",
        )}
      >
        <div
          ref={contentRef}
          className={cn(
            "w-full origin-top-left",
            listColumns && "slide-content-overflow",
            contentClassName,
          )}
          style={
            scaled
              ? {
                  transform: `scale(${scale})`,
                  width: `${100 / scale}%`,
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
