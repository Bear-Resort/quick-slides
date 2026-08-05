import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import {
  SLIDE_FIT_READY_ATTR,
  SLIDE_FIT_REMEASURE_EVENT,
} from "@/lib/slideFitContent";
import {
  splitMarkdownToTwoColumnHtml,
  type TwoColumnHtml,
} from "@/lib/slideTwoColumn";

type SlideFitContentProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /**
   * - `columns`: short text stays 1 column; overflow uses 2 full-width panes
   *   via the same CSS grid as image+text (`grid-cols-2`).
   * - `clip`: always 1 column; overflow is clipped (text beside an image).
   */
  mode?: "columns" | "clip";
  /** Center only when content fits in a single column. */
  verticalAlign?: "top" | "center";
};

function getMarkdownEl(content: HTMLElement): HTMLElement | null {
  const el = content.querySelector(".markdown-preview.slide-content");
  return el instanceof HTMLElement ? el : null;
}

function measureBlockHeight(el: HTMLElement): number {
  return Math.max(el.getBoundingClientRect().height, el.scrollHeight);
}

export function SlideFitContent({
  children,
  className,
  contentClassName,
  mode = "columns",
  verticalAlign = "top",
}: SlideFitContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [twoCol, setTwoCol] = useState<TwoColumnHtml | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [fitEpoch, setFitEpoch] = useState(0);
  const remeasureGenerationRef = useRef(0);

  const remeasure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const generation = ++remeasureGenerationRef.current;
    content.removeAttribute(SLIDE_FIT_READY_ATTR);

    flushSync(() => {
      setTwoCol(null);
      setOverflowing(false);
    });

    requestAnimationFrame(() => {
      if (generation !== remeasureGenerationRef.current) return;

      if (container.clientHeight < 8) {
        return;
      }

      const markdown = getMarkdownEl(content);
      const measureTarget = markdown ?? content;
      const overflows =
        measureBlockHeight(measureTarget) > container.clientHeight + 1;

      let nextTwoCol: TwoColumnHtml | null = null;
      if (mode === "columns" && overflows && markdown) {
        nextTwoCol = splitMarkdownToTwoColumnHtml(markdown);
      }

      if (generation !== remeasureGenerationRef.current) return;

      flushSync(() => {
        setTwoCol(nextTwoCol);
        setOverflowing(overflows);
        setFitEpoch((epoch) => epoch + 1);
      });
    });
  }, [mode]);

  useLayoutEffect(() => {
    if (fitEpoch === 0) return;
    contentRef.current?.setAttribute(SLIDE_FIT_READY_ATTR, "true");
  }, [fitEpoch, twoCol]);

  useLayoutEffect(() => {
    remeasure();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => remeasure());
    observer.observe(container);

    const onRemeasure = () => remeasure();
    container.addEventListener(SLIDE_FIT_REMEASURE_EVENT, onRemeasure);

    return () => {
      observer.disconnect();
      container.removeEventListener(SLIDE_FIT_REMEASURE_EVENT, onRemeasure);
    };
  }, [children, remeasure]);

  const shouldCenter =
    verticalAlign === "center" && !overflowing && !twoCol;

  const hostStyle: CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  };

  // Same track sizing as image+text `.grid.grid-cols-2.gap-10`.
  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    columnGap: "2.5rem",
    alignItems: "start",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  };

  const paneStyle: CSSProperties = {
    minWidth: 0,
    width: "auto",
    maxWidth: "100%",
    boxSizing: "border-box",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full min-h-0 w-full",
        // Do not clip the right text pane (that was hiding column 2 in PDF).
        twoCol ? "overflow-visible" : "overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-full w-full min-w-0 flex-col",
          shouldCenter ? "justify-center" : "justify-start",
        )}
      >
        <div
          ref={contentRef}
          className={cn(
            "slide-fit-content-body w-full min-w-0 min-h-0",
            twoCol
              ? "slide-content-overflow h-full"
              : shouldCenter
                ? "h-auto"
                : "h-full",
            contentClassName,
          )}
          style={hostStyle}
        >
          {twoCol ? (
            <div
              className={cn(
                twoCol.className || "markdown-preview slide-content w-full",
              )}
              data-slide-two-col="true"
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                columns: "auto",
              }}
            >
              <div
                className="slide-text-two-col slide-two-col-grid grid w-full grid-cols-2 items-start gap-10"
                style={gridStyle}
              >
                <div
                  className="slide-two-col-pane min-w-0"
                  style={paneStyle}
                  dangerouslySetInnerHTML={{ __html: twoCol.left }}
                />
                <div
                  className="slide-two-col-pane min-w-0"
                  style={paneStyle}
                  dangerouslySetInnerHTML={{ __html: twoCol.right }}
                />
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
