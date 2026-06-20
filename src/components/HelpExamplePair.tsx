import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { HtmlScrollbar } from "@/components/HtmlScrollbar";
import { ChevronLeft, ChevronRight, Locate, TextCursor } from "lucide-react";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { SlideView } from "@/components/SlideView";
import { LocateIconButton } from "@/components/LocateIconButton";
import { Button } from "@/components/ui/button";
import { splitSlides } from "@/lib/slides";
import { getSlideNavigation } from "@/lib/slideMarkers";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

type LinePosition = {
  top: number;
  height: number;
};

function getLineCharIndex(lines: string[], lineIndex: number): number {
  let charIndex = 0;
  for (let i = 0; i < lineIndex; i++) {
    charIndex += (lines[i]?.length ?? 0) + 1;
  }
  return charIndex;
}

function measureLinePositions(
  mirror: HTMLDivElement,
  lines: string[],
  lineIndices: number[],
): Map<number, LinePosition> {
  const textNode = mirror.firstChild;
  const positions = new Map<number, LinePosition>();
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return positions;
  }

  const mirrorTop = mirror.getBoundingClientRect().top;

  for (const lineIndex of lineIndices) {
    const start = Math.min(getLineCharIndex(lines, lineIndex), textNode.textContent?.length ?? 0);
    const lineText = lines[lineIndex] ?? "";
    const end = Math.min(start + Math.max(lineText.length, 1), textNode.textContent?.length ?? 0);

    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);

    const rect = range.getBoundingClientRect();
    positions.set(lineIndex, {
      top: rect.top - mirrorTop,
      height: rect.height || parseFloat(getComputedStyle(mirror).lineHeight) || 20,
    });
  }

  return positions;
}

function syncMirrorLayout(source: HTMLElement, mirror: HTMLDivElement) {
  const style = getComputedStyle(source);
  mirror.style.width = `${source.clientWidth}px`;
  mirror.style.font = style.font;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.padding = style.padding;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.border = style.border;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "anywhere";
  mirror.style.wordBreak = style.wordBreak;
}

function HelpExampleCode({
  code,
  preRef,
}: {
  code: string;
  preRef: RefObject<HTMLPreElement | null>;
}) {
  const parts = code.split(/(<!--[\s\S]*?-->)/g);

  return (
    <pre
      ref={preRef}
      aria-readonly
      className="relative z-0 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-none p-3"
    >
      {parts.map((part, index) =>
        part.startsWith("<!--") ? (
          <span key={index} className="text-muted-foreground italic">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </pre>
  );
}

const copy = {
  en: {
    previous: "Previous slide",
    next: "Next slide",
    slide: (current: number, total: number) => `${current} / ${total}`,
    page: (current: number, total: number) => `${current} / ${total}`,
    locate: "Locate",
    locateSlide: (page: number) => `Locate slide ${page} in preview`,
    locateCode: (page: number) => `Locate slide ${page} in code`,
  },
  zh: {
    previous: "上一页",
    next: "下一页",
    slide: (current: number, total: number) => `${current} / ${total}`,
    page: (current: number, total: number) => `${current} / ${total}`,
    locate: "定位",
    locateSlide: (page: number) => `定位到预览第 ${page} 页`,
    locateCode: (page: number) => `定位到代码第 ${page} 页`,
  },
} as const;

export type HelpExamplePairProps = {
  markdown: string;
  className?: string;
};

export function HelpExamplePair({ markdown, className }: HelpExamplePairProps) {
  const language = useLanguage();
  const t = copy[language];
  const slides = useMemo(() => splitSlides(markdown), [markdown]);
  const navigation = useMemo(() => getSlideNavigation(markdown), [markdown]);
  const lines = useMemo(() => markdown.split("\n"), [markdown]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [linePositions, setLinePositions] = useState<Map<number, LinePosition>>(
    () => new Map(),
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const safeIndex = Math.min(slideIndex, Math.max(0, slides.length - 1));
  const preview = slides[safeIndex] ?? "";
  const canNavigate = slides.length > 1;

  const measuredLineIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const separator of navigation.separators) {
      indices.add(separator.line);
    }
    for (const line of navigation.slideStartLines) {
      indices.add(line);
    }
    return [...indices];
  }, [navigation]);

  const remeasure = useCallback(() => {
    const pre = preRef.current;
    const mirror = mirrorRef.current;
    if (!pre || !mirror) return;

    syncMirrorLayout(pre, mirror);
    mirror.textContent = markdown;
    setLinePositions(measureLinePositions(mirror, lines, measuredLineIndices));
  }, [markdown, lines, measuredLineIndices]);

  useLayoutEffect(() => {
    remeasure();
  }, [remeasure]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const observer = new ResizeObserver(() => {
      remeasure();
    });
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [remeasure]);

  const locateCodeToSlide = useCallback(
    (index: number) => {
      const line = navigation.slideStartLines[index] ?? 0;
      const position = linePositions.get(line);
      const scroll = scrollRef.current;
      if (!position || !scroll) return;

      scroll.scrollTo({
        top: Math.max(0, position.top - 12),
        behavior: "smooth",
      });
    },
    [linePositions, navigation.slideStartLines],
  );

  const locateSlideFromCode = useCallback((index: number) => {
    setSlideIndex(index);
  }, []);

  const goPrevious = () => {
    setSlideIndex((index) => Math.max(0, index - 1));
  };

  const goNext = () => {
    setSlideIndex((index) => Math.min(slides.length - 1, index + 1));
  };

  return (
    <div className={cn("help-example-pair grid gap-3 md:grid-cols-2 md:items-stretch", className)}>
      <div className="relative min-h-0 max-h-80 overflow-hidden rounded-lg border border-gray-300 bg-secondary dark:border-gray-700">
        <div
          ref={scrollRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          className="max-h-80 overflow-y-auto no-native-scrollbar"
        >
          <HelpExampleCode code={markdown} preRef={preRef} />
        </div>

        <HtmlScrollbar
          scrollRef={scrollRef}
          refreshToken={markdown}
          className="absolute inset-y-0 right-0 z-30"
        />

        <div
          ref={mirrorRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0 font-mono text-[11px] leading-relaxed"
        />

        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          <div
            className="relative h-full w-full"
            style={{ transform: `translateY(-${scrollTop}px)` }}
          >
            {navigation.separators.map((separator) => {
              const position = linePositions.get(separator.line);
              if (!position) return null;

              return (
                <div
                  key={separator.line}
                  className="pointer-events-auto absolute right-2 flex items-center gap-1.5"
                  style={{
                    top: position.top,
                    height: position.height,
                  }}
                >
                  <span className="rounded-md border border-border/70 bg-background/95 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground shadow-sm backdrop-blur-sm">
                    {t.page(separator.page, separator.total)}
                  </span>
                  <LocateIconButton
                    label={t.locate}
                    ariaLabel={t.locateSlide(separator.page)}
                    className="editor-locate-btn size-5"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => locateSlideFromCode(separator.page - 1)}
                    icon={<Locate className="size-3" />}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex min-h-[7.5rem] min-w-0 flex-col gap-2">
        <div className="slide-theme-regular overflow-hidden rounded-lg border border-gray-300 bg-card dark:border-gray-700">
          <div className="flex items-center justify-between border-b border-gray-300 px-3 py-1.5 text-xs font-semibold tabular-nums dark:border-gray-700">
            <span className="uppercase tracking-wide text-muted-foreground">Slide</span>
            <LocateIconButton
              label={t.locate}
              ariaLabel={t.locateCode(safeIndex + 1)}
              className="slide-locate-btn size-6"
              onClick={() => locateCodeToSlide(safeIndex)}
              icon={<TextCursor className="size-3" />}
            />
          </div>
          <div className="aspect-video min-h-0 overflow-hidden">
            <ScaledSlideFrame>
              <SlideView markdown={preview} />
            </ScaledSlideFrame>
          </div>
        </div>

        {canNavigate ? (
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={t.previous}
              disabled={safeIndex === 0}
              onClick={goPrevious}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-muted-foreground">
              {t.slide(safeIndex + 1, slides.length)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={t.next}
              disabled={safeIndex >= slides.length - 1}
              onClick={goNext}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
