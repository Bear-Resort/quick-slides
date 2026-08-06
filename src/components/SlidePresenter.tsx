import { useCallback, useEffect, useRef, useState } from "react";
import {
  PresenterAnnotator,
  type PresenterAnnotateTool,
} from "@/components/PresenterAnnotator";
import { PresenterBar } from "@/components/PresenterBar";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { SlideView } from "@/components/SlideView";
import { splitSlides } from "@/lib/slides";
import {
  getSlideThemeAttributes,
  slideColorModeClass,
  type SlideColorMode,
  type SlideThemeId,
} from "@/lib/slideThemes";
import { parseSlide } from "@/lib/slideLayout";
import { cn } from "@/lib/utils";

type SlidePresenterProps = {
  markdown: string;
  theme: SlideThemeId;
  colorMode?: SlideColorMode;
  onExit: () => void;
};

/**
 * In-app present mode — same layout as the exported HTML presentation:
 * black stage, full slide centered and scaled to fit (including narrow screens).
 */
export function SlidePresenter({
  markdown,
  theme,
  colorMode = "light",
  onExit,
}: SlidePresenterProps) {
  const slides = splitSlides(markdown);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<PresenterAnnotateTool>("none");
  const [clearNonce, setClearNonce] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    setIndex((current) => Math.min(current + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  const handleExit = useCallback(() => {
    const doc = document as Document & {
      webkitExitFullscreen?: () => void;
      webkitFullscreenElement?: Element | null;
    };
    const fsElement = document.fullscreenElement ?? doc.webkitFullscreenElement;
    if (fsElement) {
      void document.exitFullscreen?.().catch(() => {
        doc.webkitExitFullscreen?.();
      });
    }
    onExit();
  }, [onExit]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const el = node as HTMLElement & { webkitRequestFullscreen?: () => void };
    void node.requestFullscreen?.().catch(() => {
      el.webkitRequestFullscreen?.();
    });
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        onExit();
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [onExit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleExit();
        return;
      }
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrev();
      }
      if (event.key === "Home") {
        event.preventDefault();
        setIndex(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        setIndex(Math.max(slides.length - 1, 0));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, handleExit, slides.length]);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  const slide = slides[index] ?? "";
  const themeAttributes = getSlideThemeAttributes(theme);
  const layout = parseSlide(slide).layout;

  return (
    <div
      ref={containerRef}
      className="slide-presenter fixed inset-0 z-50 bg-black text-white"
    >
      <div
        className={cn(
          "presenter-stage absolute inset-0 box-border flex flex-col overflow-hidden px-4 pb-[4.5rem] pt-[3.25rem] sm:px-[4.5rem] sm:py-14",
          slideColorModeClass(colorMode),
          themeAttributes.className,
        )}
        style={themeAttributes.style}
      >
        <div className="relative min-h-0 w-full flex-1">
          <ScaledSlideFrame
            className="h-full w-full min-h-0 min-w-0"
            theme={theme}
            slideIndex={index}
            layout={layout}
            maxScale={1}
          >
            <SlideView markdown={slide} />
          </ScaledSlideFrame>
          <PresenterAnnotator
            slideIndex={index}
            tool={tool}
            colorMode={colorMode}
            clearNonce={clearNonce}
          />
        </div>
      </div>

      <PresenterBar
        index={index}
        total={slides.length}
        tool={tool}
        colorMode={colorMode}
        onToolChange={setTool}
        onClearPage={() => setClearNonce((n) => n + 1)}
        onPrevious={goPrev}
        onNext={goNext}
        onExit={handleExit}
      />
    </div>
  );
}
