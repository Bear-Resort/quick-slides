import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HtmlScrollbarArea } from "@/components/HtmlScrollbar";
import { Header } from "@/components/Header";
import { SlideActions } from "@/components/SlideActions";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/MarkdownEditor";
import { EditorDocumentHeader, type SaveStatus } from "@/components/EditorDocumentHeader";
import { SlideDeck, type SlideDeckHandle } from "@/components/SlideDeck";
import { SlidePresenter } from "@/components/SlidePresenter";
import { StyleSelector } from "@/components/StyleSelector";
import { DeckProvider } from "@/context/DeckContext";
import { getSlideNavigation } from "@/lib/slideMarkers";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import {
  resolveDeckImageSrc,
  revokeAllDeckImageUrls,
  storeDeckImage,
} from "@/lib/library/deckImages";
import type { DeckMetadata } from "@/lib/library/deckFormat";
import {
  getLibraryRoot,
  loadDeck,
  saveDeck,
} from "@/lib/library/deckStorage";
import {
  getDefaultPresentationFilename,
  getPresentationFilename,
} from "@/lib/presentationFilename";
import type { SlideThemeId } from "@/lib/slideThemes";
import { useLanguage } from "@/lib/useLanguage";

const copy = {
  en: {
    placeholder: "Write markdown here. Separate slides with --- on its own line.",
    slides: "Slides",
    source: "Markdown Editor",
    loadFailed: "Could not open this presentation.",
  },
  zh: {
    placeholder: "在此编写 Markdown。用单独一行的 --- 分隔幻灯片。",
    slides: "幻灯片",
    source: "Markdown 编辑器",
    loadFailed: "无法打开此演示文稿。",
  },
};

export function Editor() {
  const { deckId } = useParams<{ deckId?: string }>();
  const isLibraryDeck = Boolean(deckId);
  const language = useLanguage();
  const t = copy[language];
  const navigate = useNavigate();

  const [markdown, setMarkdown] = useState("");
  const markdownRef = useRef("");
  markdownRef.current = markdown;
  const [slideTheme, setSlideTheme] = useState<SlideThemeId>("regular");
  const [presenting, setPresenting] = useState(false);
  const [loading, setLoading] = useState(isLibraryDeck);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(isLibraryDeck ? "saved" : null);

  const [deckHandle, setDeckHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [metadata, setMetadata] = useState<DeckMetadata | null>(null);
  const [ephemeralTitle, setEphemeralTitle] = useState(() => getPresentationFilename());

  const editorRef = useRef<MarkdownEditorHandle>(null);
  const slideDeckRef = useRef<SlideDeckHandle>(null);
  const saveTimerRef = useRef<number | null>(null);
  const metadataRef = useRef<DeckMetadata | null>(null);
  const deckHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const folderNameRef = useRef<string | null>(null);
  const skipNextAutosaveRef = useRef(true);

  metadataRef.current = metadata;
  deckHandleRef.current = deckHandle;
  folderNameRef.current = deckId ?? null;

  const presentationFilename = isLibraryDeck
    ? metadata?.title ?? getDefaultPresentationFilename(language)
    : ephemeralTitle;

  useEffect(() => {
    if (!isLibraryDeck || !deckId) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const root = await getLibraryRoot();
        if (!root) {
          navigate("/", { replace: true });
          return;
        }
        const deck = await loadDeck(root, deckId);
        if (!deck || cancelled) {
          if (!cancelled) {
            window.alert(t.loadFailed);
            navigate("/", { replace: true });
          }
          return;
        }
        setDeckHandle(deck.handle);
        setMetadata(deck.metadata);
        setMarkdown(deck.markdown);
        setSlideTheme(deck.metadata.slideTheme);
        setSaveStatus("saved");
        skipNextAutosaveRef.current = true;
      } catch {
        if (!cancelled) {
          window.alert(t.loadFailed);
          navigate("/", { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (deckId) revokeAllDeckImageUrls(deckId);
    };
  }, [deckId, isLibraryDeck, navigate, t.loadFailed]);

  const flushSave = useCallback(async () => {
    const handle = deckHandleRef.current;
    const folderName = folderNameRef.current;
    const meta = metadataRef.current;
    if (!handle || !folderName || !meta) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    setSaveStatus("saving");
    try {
      const updated = await saveDeck(handle, folderName, markdownRef.current, {
        ...meta,
        slideTheme,
      });
      setMetadata(updated);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [slideTheme]);

  useEffect(() => {
    if (!isLibraryDeck) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveStatus === "saving") {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isLibraryDeck, saveStatus]);

  const scheduleSave = useCallback(
    (nextMarkdown: string, nextTheme: SlideThemeId, nextMeta: DeckMetadata) => {
      const handle = deckHandleRef.current;
      const folderName = folderNameRef.current;
      if (!handle || !folderName) return;

      setSaveStatus("saving");
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            const updated = await saveDeck(handle, folderName, nextMarkdown, {
              ...nextMeta,
              slideTheme: nextTheme,
            });
            setMetadata(updated);
            setSaveStatus("saved");
          } catch {
            setSaveStatus("error");
          }
        })();
      }, 800);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLibraryDeck || !metadata || !deckHandle || !deckId || loading) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    const meta = metadataRef.current;
    if (!meta) return;
    scheduleSave(markdown, slideTheme, meta);
  }, [markdown, slideTheme, isLibraryDeck, deckHandle, deckId, loading, scheduleSave]);

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdown(value);
  }, []);

  const handleThemeChange = useCallback((theme: SlideThemeId) => {
    setSlideTheme(theme);
  }, []);

  const handleTitleChange = useCallback(
    (title: string) => {
      if (isLibraryDeck && metadata && deckHandle && deckId) {
        const nextMeta = { ...metadata, title };
        setMetadata(nextMeta);
        scheduleSave(markdown, slideTheme, nextMeta);
        return;
      }
      setEphemeralTitle(title);
    },
    [deckHandle, deckId, isLibraryDeck, markdown, metadata, scheduleSave, slideTheme],
  );

  const handleLoadSample = useCallback(() => {
    setMarkdown(SAMPLE_MARKDOWN);
  }, []);

  const handleLocateSlide = (slideIndex: number) => {
    slideDeckRef.current?.locateSlide(slideIndex);
  };

  const handleLocateEditor = (slideIndex: number) => {
    const startLine = getSlideNavigation(markdown).slideStartLines[slideIndex] ?? 0;
    editorRef.current?.locateLine(startLine);
  };

  const resolveImageSrc = useCallback(
    async (src: string) => {
      if (!deckHandle || !deckId) return src;
      return resolveDeckImageSrc(deckHandle, deckId, src);
    },
    [deckHandle, deckId],
  );

  const storeImage = useCallback(
    async (file: File) => {
      if (!deckHandle || !deckId) {
        throw new Error("No deck open");
      }
      return storeDeckImage(deckHandle, deckId, file);
    },
    [deckHandle, deckId],
  );

  const deckContextValue = useMemo(
    () => ({
      folderName: deckId ?? null,
      handle: deckHandle,
      metadata,
      resolveImageSrc,
      storeImage,
    }),
    [deckId, deckHandle, metadata, resolveImageSrc, storeImage],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        …
      </div>
    );
  }

  return (
    <DeckProvider {...deckContextValue}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <Header
          onLoadSample={handleLoadSample}
          hasEditorContent={markdown.trim().length > 0}
        />
        <main className="home-split-layout grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden sm:grid-cols-2 sm:grid-rows-[minmax(0,1fr)]">
          <section className="home-split-editor flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-gray-300 sm:border-r sm:border-b-0 dark:border-gray-700">
            <EditorDocumentHeader
              title={presentationFilename}
              onTitleChange={handleTitleChange}
              saveStatus={saveStatus}
              onBack={() => void flushSave()}
            />
            <div className="shrink-0 border-b border-gray-300 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground dark:border-gray-700">
              {t.source}
            </div>
            <MarkdownEditor
              ref={editorRef}
              value={markdown}
              onChange={handleMarkdownChange}
              onLocateSlide={handleLocateSlide}
              placeholder={t.placeholder}
            />
          </section>

          <section className="home-split-slides flex min-h-0 min-w-0 flex-col overflow-hidden">
            <StyleSelector value={slideTheme} onChange={handleThemeChange} />
            <div className="flex shrink-0 items-center justify-between border-b border-gray-300 px-4 py-2 dark:border-gray-700">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                {t.slides}
              </span>
              <SlideActions
                markdown={markdown}
                theme={slideTheme}
                filename={presentationFilename}
                deckHandle={deckHandle}
                deckId={deckId ?? null}
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
    </DeckProvider>
  );
}
