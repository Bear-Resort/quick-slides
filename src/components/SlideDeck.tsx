import { forwardRef, useImperativeHandle, useRef } from "react";
import { TextCursor } from "lucide-react";
import { LocateIconButton } from "@/components/LocateIconButton";
import { ScaledSlideFrame } from "@/components/ScaledSlideFrame";
import { SlideView } from "@/components/SlideView";
import {
  getSlideThemeAttributes,
  slideColorModeClass,
  type SlideColorMode,
  type SlideThemeId,
} from "@/lib/slideThemes";
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
  colorMode?: SlideColorMode;
  onLocateEditor: (slideIndex: number) => void;
};

export const SlideDeck = forwardRef<SlideDeckHandle, SlideDeckProps>(
  function SlideDeck(
    { markdown, theme, colorMode = "light", onLocateEditor },
    ref,
  ) {
    const language = useLanguage();
    const t = copy[language];
    const slides = splitSlides(markdown);
    const slideRefs = useRef<Array<HTMLElement | null>>([]);
    const themeAttributes = getSlideThemeAttributes(theme);

    useImperativeHandle(ref, () => ({
      locateSlide: (slideIndex: number) => {
        slideRefs.current[slideIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      },
    }));

    return (
      <div className="flex flex-col gap-6">
        {slides.map((slide, index) => {
          const layout = parseSlide(slide).layout;

          return (
            <article
              key={index}
              ref={(node) => {
                slideRefs.current[index] = node;
              }}
              className="slide-frame w-full overflow-hidden rounded-xl border shadow-sm"
            >
              <div className="slide-frame-bar glass-toolbar relative z-[1] flex items-center justify-between border-b px-4 py-2 text-xs font-semibold tabular-nums">
                <span className="uppercase tracking-wide">Slide {index + 1}</span>
                <LocateIconButton
                  label={t.locate}
                  ariaLabel={`${t.locate} slide ${index + 1} in editor`}
                  className="slide-locate-btn glass-toolbar-action size-6"
                  onClick={() => onLocateEditor(index)}
                  icon={<TextCursor className="size-3" />}
                />
              </div>
              <div
                className={cn(
                  "aspect-video w-full",
                  slideColorModeClass(colorMode),
                  themeAttributes.className,
                )}
                style={themeAttributes.style}
              >
                <ScaledSlideFrame
                  theme={theme}
                  slideIndex={index}
                  layout={layout}
                >
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
