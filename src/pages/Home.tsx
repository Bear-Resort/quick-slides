import { useCallback, useRef, useState } from "react";
import { HtmlScrollbarArea } from "@/components/HtmlScrollbar";
import { Header } from "@/components/Header";
import { SlideActions } from "@/components/SlideActions";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/MarkdownEditor";
import { SlideDeck, type SlideDeckHandle } from "@/components/SlideDeck";
import { SlidePresenter } from "@/components/SlidePresenter";
import { StyleSelector } from "@/components/StyleSelector";
import { getSlideNavigation } from "@/lib/slideMarkers";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import type { SlideThemeId } from "@/lib/slideThemes";
import { useLanguage } from "@/lib/useLanguage";

const copy = {
  en: {
    placeholder: "Write markdown here. Separate slides with --- on its own line.",
    slides: "Slides",
    source: "Markdown Editor",
  },
  zh: {
    placeholder: "在此编写 Markdown。用单独一行的 --- 分隔幻灯片。",
    slides: "幻灯片",
    source: "Markdown 编辑器",
  },
};

export function Home() {
  const language = useLanguage();
  const t = copy[language];
  const [markdown, setMarkdown] = useState("");

  const handleLoadSample = useCallback(() => {
    setMarkdown(SAMPLE_MARKDOWN);
  }, []);
  const [presenting, setPresenting] = useState(false);
  const [slideTheme, setSlideTheme] = useState<SlideThemeId>("regular");
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const slideDeckRef = useRef<SlideDeckHandle>(null);

  const handleLocateSlide = (slideIndex: number) => {
    slideDeckRef.current?.locateSlide(slideIndex);
  };

  const handleLocateEditor = (slideIndex: number) => {
    const startLine = getSlideNavigation(markdown).slideStartLines[slideIndex] ?? 0;
    editorRef.current?.locateLine(startLine);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Header
        onLoadSample={handleLoadSample}
        hasEditorContent={markdown.trim().length > 0}
      />
      <main className="home-split-layout grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden sm:grid-cols-2 sm:grid-rows-[minmax(0,1fr)]">
        <section className="home-split-editor flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-gray-300 sm:border-r sm:border-b-0 dark:border-gray-700">
          <div className="shrink-0 border-b border-gray-300 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground dark:border-gray-700">
            {t.source}
          </div>
          <MarkdownEditor
            ref={editorRef}
            value={markdown}
            onChange={setMarkdown}
            onLocateSlide={handleLocateSlide}
            placeholder={t.placeholder}
          />
        </section>

        <section className="home-split-slides flex min-h-0 min-w-0 flex-col overflow-hidden">
          <StyleSelector value={slideTheme} onChange={setSlideTheme} />
          <div className="flex shrink-0 items-center justify-between border-b border-gray-300 px-4 py-2 dark:border-gray-700">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
              {t.slides}
            </span>
            <SlideActions
              markdown={markdown}
              theme={slideTheme}
              onPresent={() => setPresenting(true)}
            />
          </div>
          <HtmlScrollbarArea
            className="bg-secondary/30"
            contentClassName="p-4 sm:p-6"
            refreshToken={markdown}
          >
            <SlideDeck
              ref={slideDeckRef}
              markdown={markdown}
              theme={slideTheme}
              onLocateEditor={handleLocateEditor}
            />
          </HtmlScrollbarArea>
        </section>
      </main>

      {presenting && (
        <SlidePresenter
          markdown={markdown}
          theme={slideTheme}
          onExit={() => setPresenting(false)}
        />
      )}
    </div>
  );
}
