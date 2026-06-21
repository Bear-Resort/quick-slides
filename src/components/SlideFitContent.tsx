import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { SLIDE_FIT_READY_ATTR } from "@/lib/slideFitContent";

type SlideFitContentProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Center content vertically when it fits on the slide. */
  verticalAlign?: "top" | "center";
  /** Skip auto-scaling only (export still uses overflow columns). */
  disableFit?: boolean;
};

type OverflowColumns = 1 | 2 | 3;

const FILL_MARGIN = 0.98;

function getMarkdownEl(content: HTMLElement): HTMLElement | null {
  const el = content.querySelector(".markdown-preview.slide-content");
  return el instanceof HTMLElement ? el : null;
}

function measureBlockHeight(el: HTMLElement): number {
  return Math.max(el.getBoundingClientRect().height, el.scrollHeight);
}

function applyOverflowColumns(
  content: HTMLElement,
  columns: OverflowColumns,
): void {
  content.classList.toggle("slide-content-overflow", columns > 1);
  if (columns > 1) {
    content.style.setProperty("--slide-overflow-columns", String(columns));
  } else {
    content.style.removeProperty("--slide-overflow-columns");
  }
}

function clearFitStyles(content: HTMLElement): void {
  content.style.removeProperty("--slide-content-scale");
  content.style.removeProperty("--slide-overflow-columns");
  content.classList.remove("slide-content-overflow");
}

export function SlideFitContent({
  children,
  className,
  contentClassName,
  verticalAlign = "top",
  disableFit = false,
}: SlideFitContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowColumns, setOverflowColumns] = useState<OverflowColumns>(1);
  const [scale, setScale] = useState(1);
  const [heightOverflow, setHeightOverflow] = useState(false);
  const remeasureGenerationRef = useRef(0);

  const remeasure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const generation = ++remeasureGenerationRef.current;
    clearFitStyles(content);
    content.removeAttribute(SLIDE_FIT_READY_ATTR);

    requestAnimationFrame(() => {
      if (generation !== remeasureGenerationRef.current) return;

      const measureTarget = () => getMarkdownEl(content) ?? content;
      const measureOverflow = () => {
        const target = measureTarget();
        return measureBlockHeight(target) > container.clientHeight + 1;
      };

      let columns: OverflowColumns = 1;

      if (measureOverflow()) {
        columns = 2;
        applyOverflowColumns(content, 2);
        void content.offsetHeight;

        if (measureOverflow()) {
          columns = 3;
          applyOverflowColumns(content, 3);
          void content.offsetHeight;
        }
      }

      let nextScale = 1;
      if (!disableFit) {
        const target = measureTarget();
        const targetHeight = measureBlockHeight(target);
        const targetWidth = target.getBoundingClientRect().width;
        const scaleH = container.clientHeight / targetHeight;
        const scaleW = container.clientWidth / Math.max(targetWidth, 1);

        if (scaleH < 1) {
          nextScale = Math.max(Math.min(scaleH, scaleW, 1) * FILL_MARGIN, 0.4);
        } else if (scaleW < 1) {
          nextScale = scaleW * FILL_MARGIN;
        }

        if (nextScale < 0.999) {
          content.style.setProperty("--slide-content-scale", String(nextScale));
        }
      }

      if (generation !== remeasureGenerationRef.current) return;

      setOverflowColumns(columns);
      setScale(nextScale);
      setHeightOverflow(!disableFit && nextScale < 0.999);
      content.setAttribute(SLIDE_FIT_READY_ATTR, "true");
    });
  }, [disableFit]);

  useLayoutEffect(() => {
    remeasure();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => remeasure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [children, remeasure]);

  const shouldCenter =
    verticalAlign === "center" && !heightOverflow && overflowColumns === 1;
  const scaled = !disableFit && scale < 0.999;

  const contentStyle: CSSProperties | undefined =
    overflowColumns > 1 || scaled
      ? ({
          ...(overflowColumns > 1
            ? { "--slide-overflow-columns": overflowColumns }
            : {}),
          ...(scaled ? { "--slide-content-scale": scale } : {}),
        } as CSSProperties)
      : undefined;

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
            "slide-fit-content-body w-full min-h-0",
            overflowColumns > 1
              ? "slide-content-overflow h-auto self-start"
              : shouldCenter
                ? "h-auto"
                : "h-full",
            scaled && "slide-content-scaled",
            contentClassName,
          )}
          style={contentStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
