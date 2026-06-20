import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/lib/slideCanvas";
import { parseSlide } from "@/lib/slideLayout";
import { getSlideThemeAttributes, type SlideThemeId } from "@/lib/slideThemes";
import { SlideCanvasContent } from "@/components/SlideCanvasContent";
import { SlideView } from "@/components/SlideView";
import { cn } from "@/lib/utils";

type ExportSlidePageProps = {
  markdown: string;
  theme: SlideThemeId;
  slideIndex: number;
};

export function ExportSlidePage({
  markdown,
  theme,
  slideIndex,
}: ExportSlidePageProps) {
  const themeAttributes = getSlideThemeAttributes(theme);
  const layout = parseSlide(markdown).layout;

  return (
    <div
      className={cn(themeAttributes.className, "export-slide-page text-foreground")}
      style={{
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        ...themeAttributes.style,
      }}
    >
      <div
        className="slide-frame h-full w-full overflow-hidden bg-card"
        style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}
      >
        <SlideCanvasContent
          theme={theme}
          slideIndex={slideIndex}
          layout={layout}
          className="h-full w-full"
          style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}
        >
          <SlideView markdown={markdown} exportMode />
        </SlideCanvasContent>
      </div>
    </div>
  );
}

export { SLIDE_WIDTH, SLIDE_HEIGHT };
