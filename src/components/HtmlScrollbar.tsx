import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

function getScrollMetrics(element: HTMLElement): ScrollMetrics {
  return {
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  };
}

function useScrollMetrics(
  scrollRef: RefObject<HTMLElement | null>,
  refreshToken?: unknown,
) {
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  });

  const refresh = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setMetrics(getScrollMetrics(element));
  }, [scrollRef]);

  useLayoutEffect(() => {
    refresh();
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      refresh();
      innerFrame = requestAnimationFrame(refresh);
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [refresh, refreshToken]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    refresh();

    const onScroll = () => refresh();
    element.addEventListener("scroll", onScroll, { passive: true });

    const onInput = () => refresh();
    if (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement
    ) {
      element.addEventListener("input", onInput);
    }

    const resizeObserver = new ResizeObserver(() => refresh());
    const observeNode = (node: Element) => {
      if (node instanceof HTMLElement) {
        resizeObserver.observe(node);
      }
    };

    observeNode(element);
    for (const child of element.children) {
      observeNode(child);
    }

    const mutationObserver = new MutationObserver(() => {
      refresh();
      for (const child of element.children) {
        observeNode(child);
      }
    });
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("resize", refresh);

    return () => {
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("input", onInput);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", refresh);
    };
  }, [refresh, scrollRef, refreshToken]);

  return { metrics, refresh };
}

type HtmlScrollbarProps = {
  scrollRef: RefObject<HTMLElement | null>;
  className?: string;
  /** Re-measure when scrollable content changes (e.g. textarea value). */
  refreshToken?: unknown;
};

export function HtmlScrollbar({
  scrollRef,
  className,
  refreshToken,
}: HtmlScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startScrollTop: number } | null>(null);
  const { metrics } = useScrollMetrics(scrollRef, refreshToken);

  const scrollable = metrics.scrollHeight - metrics.clientHeight;
  const visible = scrollable > 1 && metrics.clientHeight > 0;

  const thumbRatio = metrics.clientHeight / Math.max(metrics.scrollHeight, 1);
  const thumbHeight = Math.max(
    metrics.clientHeight * thumbRatio,
    visible ? 28 : 0,
  );
  const thumbTravel = Math.max(metrics.clientHeight - thumbHeight, 0);
  const thumbTop =
    scrollable > 0 ? (metrics.scrollTop / scrollable) * thumbTravel : 0;

  const scrollToThumbCenter = useCallback(
    (clientY: number) => {
      const element = scrollRef.current;
      const track = trackRef.current;
      if (!element || !track || scrollable <= 0) return;

      const trackRect = track.getBoundingClientRect();
      const nextThumbTop = Math.min(
        Math.max(clientY - trackRect.top - thumbHeight / 2, 0),
        thumbTravel,
      );
      element.scrollTop = (nextThumbTop / thumbTravel) * scrollable;
    },
    [scrollRef, scrollable, thumbHeight, thumbTravel],
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const element = scrollRef.current;
      const drag = dragRef.current;
      if (!element || !drag || scrollable <= 0) return;

      const delta = event.clientY - drag.startY;
      element.scrollTop =
        drag.startScrollTop + (delta / thumbTravel) * scrollable;
    };

    const onMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [scrollRef, scrollable, thumbTravel]);

  if (!visible) return null;

  return (
    <div
      className={cn("html-scrollbar pointer-events-auto", className)}
      style={{ zIndex: 30 }}
      aria-hidden
    >
      <div
        ref={trackRef}
        className="html-scrollbar-track"
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          if ((event.target as HTMLElement).dataset.thumb === "true") return;
          event.preventDefault();
          scrollToThumbCenter(event.clientY);
        }}
      >
        <div
          data-thumb="true"
          className="html-scrollbar-thumb"
          style={{ height: thumbHeight, transform: `translateY(${thumbTop}px)` }}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            dragRef.current = {
              startY: event.clientY,
              startScrollTop: scrollRef.current?.scrollTop ?? 0,
            };
          }}
        />
      </div>
    </div>
  );
}

type HtmlScrollbarAreaProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  refreshToken?: unknown;
};

export function HtmlScrollbarArea({
  children,
  className,
  contentClassName,
  refreshToken,
}: HtmlScrollbarAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn(
        "html-scroll-area relative min-h-0 min-w-0 flex-1 basis-0 overflow-hidden",
        className,
      )}
    >
      <div
        ref={viewportRef}
        className={cn(
          "html-scroll-viewport no-native-scrollbar absolute inset-0 overflow-x-hidden overflow-y-auto",
          contentClassName,
        )}
      >
        {children}
      </div>
      <HtmlScrollbar
        scrollRef={viewportRef}
        refreshToken={refreshToken}
        className="absolute inset-y-0 right-0 z-30"
      />
    </div>
  );
}
