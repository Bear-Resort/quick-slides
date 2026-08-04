import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HtmlScrollbarArea } from "@/components/HtmlScrollbar";
import { FilesPanel } from "@/components/FilesPanel";
import { GitPanel, type GitPanelVariant } from "@/components/GitPanel";
import { Header } from "@/components/Header";
import { SlideActions } from "@/components/SlideActions";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/MarkdownEditor";
import type { SaveStatus } from "@/components/EditorDocumentHeader";
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
import { bootstrapLibrary } from "@/lib/library/libraryBootstrap";
import type { PulledDeck } from "@/lib/github/deckSync";
import {
  getDefaultPresentationFilename,
  getPresentationFilename,
} from "@/lib/presentationFilename";
import type { SlideColorMode, SlideThemeId } from "@/lib/slideThemes";
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
  const [slideColorMode, setSlideColorMode] = useState<SlideColorMode>("light");
  const [presenting, setPresenting] = useState(false);
  const [loading, setLoading] = useState(isLibraryDeck);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(isLibraryDeck ? "saved" : null);

  const [deckHandle, setDeckHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [metadata, setMetadata] = useState<DeckMetadata | null>(null);
  const [ephemeralTitle, setEphemeralTitle] = useState(() => getPresentationFilename());
  const [workspacePanel, setWorkspacePanel] = useState<
    "files" | GitPanelVariant | null
  >(() => (deckId ? null : "files"));

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
    if (deckId) return;
    setWorkspacePanel("files");
    setDeckHandle(null);
    setMetadata(null);
    setMarkdown("");
    setSlideTheme("regular");
    setSlideColorMode("light");
    setSaveStatus(null);
    void bootstrapLibrary();
  }, [deckId]);

  useEffect(() => {
    if (!isLibraryDeck || !deckId) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const root = await getLibraryRoot();
        if (!root) {
          await bootstrapLibrary();
        }
        const libraryRoot = (await getLibraryRoot()) ?? root;
        if (!libraryRoot) {
          if (!cancelled) {
            window.alert(t.loadFailed);
            setWorkspacePanel("files");
            navigate("/", { replace: true });
          }
          return;
        }
        const deck = await loadDeck(libraryRoot, deckId);
        if (!deck || cancelled) {
          if (!cancelled) {
            window.alert(t.loadFailed);
            setWorkspacePanel("files");
            navigate("/", { replace: true });
          }
          return;
        }
        setDeckHandle(deck.handle);
        setMetadata(deck.metadata);
        setMarkdown(deck.markdown);
        setSlideTheme(deck.metadata.slideTheme);
        setSlideColorMode(deck.metadata.slideColorMode);
        setSaveStatus("saved");
        skipNextAutosaveRef.current = true;
      } catch {
        if (!cancelled) {
          window.alert(t.loadFailed);
          setWorkspacePanel("files");
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
        slideColorMode,
      });
      setMetadata(updated);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [slideTheme, slideColorMode]);

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
    (
      nextMarkdown: string,
      nextTheme: SlideThemeId,
      nextColorMode: SlideColorMode,
      nextMeta: DeckMetadata,
    ) => {
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
              slideColorMode: nextColorMode,
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
    scheduleSave(markdown, slideTheme, slideColorMode, meta);
  }, [
    markdown,
    slideTheme,
    slideColorMode,
    isLibraryDeck,
    deckHandle,
    deckId,
    loading,
    scheduleSave,
  ]);

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdown(value);
  }, []);

  const handleThemeChange = useCallback((theme: SlideThemeId) => {
    setSlideTheme(theme);
  }, []);

  const handleColorModeChange = useCallback((mode: SlideColorMode) => {
    setSlideColorMode(mode);
  }, []);

  const handleTitleChange = useCallback(
    (title: string) => {
      if (isLibraryDeck && metadata && deckHandle && deckId) {
        const nextMeta = { ...metadata, title };
        setMetadata(nextMeta);
        scheduleSave(markdown, slideTheme, slideColorMode, nextMeta);
        return;
      }
      setEphemeralTitle(title);
    },
    [
      deckHandle,
      deckId,
      isLibraryDeck,
      markdown,
      metadata,
      scheduleSave,
      slideTheme,
      slideColorMode,
    ],
  );

  const handleLoadSample = useCallback(() => {
    setMarkdown(SAMPLE_MARKDOWN);
  }, []);

  const handlePulled = useCallback(
    async (pulled: PulledDeck) => {
      if (deckId) {
        revokeAllDeckImageUrls(deckId);
      }
      skipNextAutosaveRef.current = true;
      setMarkdown(pulled.markdown);
      setSlideTheme(pulled.metadata.slideTheme);
      setSlideColorMode(pulled.metadata.slideColorMode);
      setMetadata(pulled.metadata);
      setSaveStatus("saved");
      const handle = deckHandleRef.current;
      const folderName = folderNameRef.current;
      if (handle && folderName) {
        try {
          const updated = await saveDeck(
            handle,
            folderName,
            pulled.markdown,
            pulled.metadata,
          );
          setMetadata(updated);
        } catch {
          // Local write already done in pull; index update is best-effort.
        }
      }
    },
    [deckId],
  );

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
          document={{
            title: presentationFilename,
            onTitleChange: handleTitleChange,
          }}
          workspace={{
            openPanel: workspacePanel,
            onOpenFiles: () =>
              setWorkspacePanel((current) =>
                current === "files" ? null : "files",
              ),
            onOpenGit: () =>
              setWorkspacePanel((current) => (current === "vcs" ? null : "vcs")),
            onOpenGithub: () =>
              setWorkspacePanel((current) =>
                current === "github" ? null : "github",
              ),
          }}
        />
        <FilesPanel
          open={workspacePanel === "files"}
          onClose={() => setWorkspacePanel(null)}
          currentDeckId={deckId ?? null}
          onOpenGithub={() => setWorkspacePanel("github")}
        />
        <GitPanel
          open={workspacePanel === "vcs" || workspacePanel === "github"}
          onClose={() => setWorkspacePanel(null)}
          variant={workspacePanel === "github" ? "github" : "vcs"}
          deckId={deckId ?? null}
          deckHandle={deckHandle}
          deckTitle={presentationFilename}
          onOpenGithub={() => setWorkspacePanel("github")}
          onPulled={(pulled) => void handlePulled(pulled)}
        />
        <main className="home-split-layout grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2 overflow-hidden p-2 pt-2 sm:grid-cols-2 sm:grid-rows-[minmax(0,1fr)]">
          <section className="home-split-editor glass-panel flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="panel-chrome relative z-[1] shrink-0 border-b px-4 py-2 text-xs font-semibold tracking-wide">
              {t.source}
            </div>
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
              <MarkdownEditor
                ref={editorRef}
                value={markdown}
                onChange={handleMarkdownChange}
                onLocateSlide={handleLocateSlide}
                placeholder={t.placeholder}
              />
            </div>
          </section>

          <section className="home-split-slides glass-panel flex min-h-0 min-w-0 flex-col">
            <div className="panel-chrome relative z-[1] flex shrink-0 items-center justify-between border-b px-4 py-2">
              <span className="relative z-[1] text-xs font-semibold tracking-wide">
                {t.slides}
              </span>
              <div className="relative z-[1] flex items-center gap-2">
                <StyleSelector
                  value={slideTheme}
                  colorMode={slideColorMode}
                  onChange={handleThemeChange}
                  onColorModeChange={handleColorModeChange}
                />
                <SlideActions
                  markdown={markdown}
                  theme={slideTheme}
                  colorMode={slideColorMode}
                  filename={presentationFilename}
                  deckHandle={deckHandle}
                  deckId={deckId ?? null}
                  onPresent={() => setPresenting(true)}
                />
              </div>
            </div>
            <HtmlScrollbarArea
              className="relative z-[1] min-h-0 flex-1 overflow-hidden bg-secondary/20"
              contentClassName="p-4 sm:p-6"
              refreshToken={markdown}
            >
              <SlideDeck
                ref={slideDeckRef}
                markdown={markdown}
                theme={slideTheme}
                colorMode={slideColorMode}
                onLocateEditor={handleLocateEditor}
              />
            </HtmlScrollbarArea>
          </section>
        </main>

        {presenting && (
          <SlidePresenter
            markdown={markdown}
            theme={slideTheme}
            colorMode={slideColorMode}
            onExit={() => setPresenting(false)}
          />
        )}
      </div>
    </DeckProvider>
  );
}
