import { forwardRef, useImperativeHandle, useRef } from "react";
import { TextCursor } from "lucide-react";
import { LocateIconButton } from "@/components/LocateIconButton";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { SlideView } from "@/components/SlideView";
import { getSlideThemeAttributes, type SlideThemeId } from "@/lib/slideThemes";
import { parseSlide } from "@/lib/slideLayout";
import { splitSlides } from "@/lib/slides";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: { locate: "Locate" },
  zh: { locate: "定位" },
} as const;

export type SlideDeckHandle = {
  locateSlide: (slideIndex: number) => void;
};

type SlideDeckProps = {
  markdown: string;
  theme: SlideThemeId;
  onLocateEditor: (slideIndex: number) => void;
};

export const SlideDeck = forwardRef<SlideDeckHandle, SlideDeckProps>(
  function SlideDeck({ markdown, theme, onLocateEditor }, ref) {
    const language = useLanguage();
    const t = copy[language];
    const slides = splitSlides(markdown);
    const slideRefs = useRef<Array<HTMLElement | null>>([]);

    useImperativeHandle(ref, () => ({
      locateSlide: (slideIndex: number) => {
        slideRefs.current[slideIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      },
    }));

    const themeAttributes = getSlideThemeAttributes(theme);

    return (
      <div
        className={cn("flex flex-col gap-6", themeAttributes.className)}
        style={themeAttributes.style}
      >
        {slides.map((slide, index) => {
          const layout = parseSlide(slide).layout;

          return (
          <article
            key={index}
            ref={(node) => {
              slideRefs.current[index] = node;
            }}
            className="slide-frame w-full overflow-hidden rounded-xl border border-gray-300 bg-card shadow-sm dark:border-gray-700"
          >
            <div className="slide-frame-bar flex items-center justify-between border-b px-4 py-2 text-xs font-semibold tabular-nums">
              <span className="uppercase tracking-wide">Slide {index + 1}</span>
              <LocateIconButton
                label={t.locate}
                ariaLabel={`${t.locate} slide ${index + 1} in editor`}
                className="slide-locate-btn size-6"
                onClick={() => onLocateEditor(index)}
                icon={<TextCursor className="size-3" />}
              />
            </div>
            <div className="aspect-video w-full">
              <ScaledSlideFrame theme={theme} slideIndex={index} layout={layout}>
                <SlideView markdown={slide} />
              </ScaledSlideFrame>
            </div>
          </article>
          );
        })}
      </div>
    );
  },
);
