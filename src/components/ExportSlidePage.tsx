import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/lib/slideCanvas";
import { getSlideThemeAttributes, type SlideThemeId } from "@/lib/slideThemes";
import { SlideView } from "@/components/SlideView";
import { cn } from "@/lib/utils";

type ExportSlidePageProps = {
  markdown: string;
  theme: SlideThemeId;
};

export function ExportSlidePage({ markdown, theme }: ExportSlidePageProps) {
  const themeAttributes = getSlideThemeAttributes(theme);

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
        <div
          className="slide-canvas h-full w-full overflow-hidden bg-card"
          style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}
        >
          <SlideView markdown={markdown} exportMode />
        </div>
      </div>
    </div>
  );
}

export { SLIDE_WIDTH, SLIDE_HEIGHT };
