import { useCallback, useEffect, useRef, useState } from "react";
import { PresenterBar } from "@/components/PresenterBar";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { SlideView } from "@/components/SlideView";
import { splitSlides } from "@/lib/slides";
import { getSlideThemeAttributes, type SlideThemeId } from "@/lib/slideThemes";
import { parseSlide } from "@/lib/slideLayout";
import { cn } from "@/lib/utils";

type SlidePresenterProps = {
  markdown: string;
  theme: SlideThemeId;
  onExit: () => void;
};

export function SlidePresenter({
  markdown,
  theme,
  onExit,
}: SlidePresenterProps) {
  const slides = splitSlides(markdown);
  const [index, setIndex] = useState(0);
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
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, handleExit]);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  const slide = slides[index] ?? "";
  const themeAttributes = getSlideThemeAttributes(theme);
  const layout = parseSlide(slide).layout;

  return (
    <div
      ref={containerRef}
      className={cn(
        "slide-presenter fixed inset-0 z-50 flex flex-col bg-background",
        themeAttributes.className,
      )}
      style={themeAttributes.style}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-6 py-6 sm:px-10">
        <ScaledSlideFrame
          className="mx-auto h-full min-h-0 max-w-[min(100%,calc((100dvh-12rem)*16/9))]"
          theme={theme}
          slideIndex={index}
          layout={layout}
        >
          <SlideView markdown={slide} />
        </ScaledSlideFrame>
      </div>

      <PresenterBar
        index={index}
        total={slides.length}
        onPrevious={goPrev}
        onNext={goNext}
        onExit={handleExit}
      />
    </div>
  );
}
