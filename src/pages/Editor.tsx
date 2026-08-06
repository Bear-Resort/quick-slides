import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HtmlScrollbarArea } from "@/components/HtmlScrollbar";
import { FilesPanel } from "@/components/FilesPanel";
import { GitPanel } from "@/components/GitPanel";
import { Header, type WorkspaceMode } from "@/components/Header";
import { SlideActions } from "@/components/SlideActions";
import {
  MarkdownEditor,
  type EditorHistoryState,
  type MarkdownEditorHandle,
} from "@/components/MarkdownEditor";
import type { SaveStatus } from "@/components/EditorDocumentHeader";
import { SlideDeck, type SlideDeckHandle } from "@/components/SlideDeck";
import { SlidePresenter } from "@/components/SlidePresenter";
import { StyleSelector } from "@/components/StyleSelector";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NamePromptDialog } from "@/components/NamePromptDialog";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { DeckProvider } from "@/context/DeckContext";
import { getSlideNavigation } from "@/lib/slideMarkers";
import { SAMPLE_MARKDOWN } from "@/lib/markdown";
import {
  resolveDeckImageSrc,
  revokeAllDeckImageUrls,
  storeDeckImage,
} from "@/lib/library/deckImages";
import {
  DECK_MARKDOWN_FILE,
  DECK_META_FILE,
  resolveFileStyle,
  withFileStyle,
  type DeckMetadata,
} from "@/lib/library/deckFormat";
import {
  connectLibraryRoot,
  ensureBrowserLibraryRoot,
  getLibraryRoot,
  loadDeck,
  saveDeck,
} from "@/lib/library/deckStorage";
import { bootstrapLibrary } from "@/lib/library/libraryBootstrap";
import { getDeckGithubLink, formatDeckGithubLinkLabel, type PulledDeck, formatContentUpdateMessage, pushDeckToGithub, PushConflictError } from "@/lib/github/deckSync";
import { computeLineChanges, type ScmLineChange } from "@/lib/github/lineDiff";
import { getRemoteText, computeScmChanges, revertFileFromRemote, type FileScmKind } from "@/lib/github/scmStatus";
import { clearStaged, stagePath, unstagePath } from "@/lib/github/staging";
import {
  createRepoFile,
  createRepoFolder,
  isImagePath,
  isTextPath,
  listRepoFileTree,
  readRepoTextFile,
  removeRepoPath,
  renameRepoPath,
  writeRepoTextFile,
  type RepoFileEntry,
} from "@/lib/github/workingTree";
import {
  getDefaultPresentationFilename,
  getPresentationFilename,
} from "@/lib/presentationFilename";
import {
  isDiskFolderPickerSupported,
  pickCustomLibraryRoot,
} from "@/lib/library/fsAccess";
import {
  DEFAULT_LIBRARY_DISPLAY_PATH,
  getLibraryDisplayPath,
} from "@/lib/library/libraryPaths";
import { getLibraryPreference } from "@/lib/library/libraryPreference";
import type { SlideColorMode, SlideThemeId } from "@/lib/slideThemes";
import { useLanguage } from "@/lib/useLanguage";
import {
  getAutosaveDelayMs,
  subscribeEditorSettings,
} from "@/lib/editorSettings";

const MODE_KEY = "quick-slides.workspace-mode";

function readWorkspaceMode(): WorkspaceMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === "browser" || raw === "disk" || raw === "git") return raw;
  } catch {
    // ignore
  }
  return getLibraryPreference() === "custom" ? "disk" : "browser";
}

function writeWorkspaceMode(mode: WorkspaceMode): void {
  localStorage.setItem(MODE_KEY, mode);
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

function fileBasename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

const copy = {
  en: {
    placeholder: "Write markdown here. Separate slides with --- on its own line.",
    slides: "Slides",
    loadFailed: "Could not open this presentation.",
    readOnly: "Read-only",
    editable: "Editable",
    unlock: "Unlock to edit",
    unlockTitle: "Edit JSON file?",
    unlockBody:
      "Modifying JSON files may break down the repository setup (themes, metadata, and sync). Continue only if you know what you are changing.",
    unlockConfirm: "Unlock and edit",
    unlockCancel: "Keep read-only",
  },
  zh: {
    placeholder: "在此编写 Markdown。用单独一行的 --- 分隔幻灯片。",
    slides: "幻灯片",
    loadFailed: "无法打开此演示文稿。",
    readOnly: "只读",
    editable: "可编辑",
    unlock: "解锁编辑",
    unlockTitle: "编辑 JSON 文件？",
    unlockBody:
      "修改 JSON 文件可能会破坏仓库结构（主题、元数据与同步）。请仅在清楚改动内容时继续。",
    unlockConfirm: "解锁并编辑",
    unlockCancel: "保持只读",
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
  const [ephemeralTitle] = useState(() => getPresentationFilename());
  const [workspacePanel, setWorkspacePanel] = useState<
    "files" | "vcs" | "github" | null
  >(() => (deckId ? null : "files"));
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() =>
    readWorkspaceMode(),
  );
  const [libraryDisplayPath, setLibraryDisplayPath] = useState(
    DEFAULT_LIBRARY_DISPLAY_PATH,
  );
  const [activeFilePath, setActiveFilePath] = useState(DECK_MARKDOWN_FILE);
  const [fileTree, setFileTree] = useState<RepoFileEntry[]>([]);
  const [scmByPath, setScmByPath] = useState<Record<string, FileScmKind>>({});
  const [hasScmChanges, setHasScmChanges] = useState(false);
  const [scmLineChanges, setScmLineChanges] = useState<ScmLineChange[]>([]);
  const [scmEpoch, setScmEpoch] = useState(0);
  /** Bumped after pull so slide images re-resolve blob URLs. */
  const [imageEpoch, setImageEpoch] = useState(0);
  const [auxFileText, setAuxFileText] = useState("");
  const [jsonUnlocked, setJsonUnlocked] = useState(false);
  const [jsonUnlockOpen, setJsonUnlockOpen] = useState(false);
  const [imagePreviewPath, setImagePreviewPath] = useState<string | null>(null);
  const [quickPushBusy, setQuickPushBusy] = useState(false);
  const [namePrompt, setNamePrompt] = useState<
    | { kind: "file"; parentPath: string }
    | { kind: "folder"; parentPath: string }
    | { kind: "rename"; path: string }
    | null
  >(null);
  const [deleteConfirmPath, setDeleteConfirmPath] = useState<string | null>(null);
  const [revertConfirmPath, setRevertConfirmPath] = useState<string | null>(null);
  const githubLink = deckId ? getDeckGithubLink(deckId) : null;
  const isLinked = Boolean(githubLink);
  const isRepoReadOnly = Boolean(githubLink?.readOnly);
  const editingMarkdown = isMarkdownPath(activeFilePath);
  const isJsonFile = activeFilePath.toLowerCase().endsWith(".json");
  const jsonReadOnly = isJsonFile && !jsonUnlocked;
  const editorReadOnly = isRepoReadOnly || jsonReadOnly;
  const entryFile = metadata?.entryFile ?? DECK_MARKDOWN_FILE;

  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [editorHistory, setEditorHistory] = useState<EditorHistoryState>({
    canUndo: false,
    canRedo: false,
  });
  const slideDeckRef = useRef<SlideDeckHandle>(null);
  const saveTimerRef = useRef<number | null>(null);
  const metadataRef = useRef<DeckMetadata | null>(null);
  const deckHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const folderNameRef = useRef<string | null>(null);
  const skipNextAutosaveRef = useRef(true);
  const workspaceModeRef = useRef(workspaceMode);
  const autosaveDelayRef = useRef(getAutosaveDelayMs());

  metadataRef.current = metadata;
  deckHandleRef.current = deckHandle;
  folderNameRef.current = deckId ?? null;
  workspaceModeRef.current = workspaceMode;

  useEffect(() => {
    return subscribeEditorSettings(() => {
      autosaveDelayRef.current = getAutosaveDelayMs();
    });
  }, []);

  const resolveAutosaveDelayMs = useCallback(() => {
    // Custom interval applies to local modes only; git keeps a short debounce.
    if (workspaceModeRef.current === "git") return 800;
    return autosaveDelayRef.current;
  }, []);

  const presentationFilename = isLibraryDeck
    ? metadata?.title ?? getDefaultPresentationFilename(language)
    : ephemeralTitle;

  /** Markdown file whose theme the Style selector edits / preview uses. */
  const styleTargetPath = useMemo(() => {
    if (isMarkdownPath(activeFilePath)) return activeFilePath;
    return entryFile;
  }, [activeFilePath, entryFile]);

  /** Export downloads use the markdown basename, not the project/deck title. */
  const exportFilename = useMemo(() => {
    const base = fileBasename(styleTargetPath).replace(/\.md$/i, "").trim();
    return base || presentationFilename;
  }, [styleTargetPath, presentationFilename]);

  const applyStyleFromMetadata = useCallback(
    (meta: DeckMetadata, filePath: string) => {
      const style = resolveFileStyle(meta, filePath);
      setSlideTheme(style.theme);
      setSlideColorMode(style.colorMode);
    },
    [],
  );

  const withCurrentFileStyle = useCallback(
    (meta: DeckMetadata, filePath = styleTargetPath): DeckMetadata =>
      withFileStyle(meta, filePath, slideTheme, slideColorMode),
    [styleTargetPath, slideTheme, slideColorMode],
  );

  const repositoryName = (() => {
    if (workspaceMode === "browser") return "";
    if (workspaceMode === "git" && deckId) {
      const link = getDeckGithubLink(deckId);
      if (link) return formatDeckGithubLinkLabel(link);
      return "";
    }
    if (workspaceMode === "disk") {
      if (!libraryDisplayPath || libraryDisplayPath === DEFAULT_LIBRARY_DISPLAY_PATH) {
        return "";
      }
      return libraryDisplayPath;
    }
    return "";
  })();

  const handleWorkspaceModeChange = useCallback(async (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    writeWorkspaceMode(mode);
    try {
      if (mode === "browser") {
        await ensureBrowserLibraryRoot();
        setLibraryDisplayPath(DEFAULT_LIBRARY_DISPLAY_PATH);
      } else if (mode === "disk") {
        if (getLibraryPreference() === "custom") {
          const root = await getLibraryRoot();
          setLibraryDisplayPath(getLibraryDisplayPath(root));
        } else if (isDiskFolderPickerSupported()) {
          const handle = await pickCustomLibraryRoot();
          if (handle) {
            await connectLibraryRoot(handle, "custom");
            setLibraryDisplayPath(getLibraryDisplayPath(handle));
          } else {
            // Stay in disk mode with no folder — do not fall back to OPFS list
            setLibraryDisplayPath("");
          }
        } else {
          setLibraryDisplayPath("");
        }
      } else {
        const root = await getLibraryRoot();
        setLibraryDisplayPath(getLibraryDisplayPath(root));
      }
    } catch {
      // keep selected mode even if root switch fails; Files panel will surface errors
    }
  }, []);

  useEffect(() => {
    void (async () => {
      if (workspaceMode === "disk" && getLibraryPreference() !== "custom") {
        setLibraryDisplayPath("");
        return;
      }
      const root = await getLibraryRoot();
      setLibraryDisplayPath(getLibraryDisplayPath(root));
    })();
  }, [deckId, workspaceMode]);

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
        applyStyleFromMetadata(
          deck.metadata,
          deck.metadata.entryFile || DECK_MARKDOWN_FILE,
        );
        setActiveFilePath(deck.metadata.entryFile || DECK_MARKDOWN_FILE);
        setAuxFileText("");
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
  }, [deckId, isLibraryDeck, navigate, t.loadFailed, applyStyleFromMetadata]);

  const refreshWorkingTree = useCallback(async () => {
    if (!deckHandle || !deckId || !getDeckGithubLink(deckId)) {
      setFileTree([]);
      setScmByPath({});
      setHasScmChanges(false);
      return;
    }
    try {
      const tree = await listRepoFileTree(deckHandle);
      setFileTree(tree);
      const { getStagedPaths } = await import("@/lib/github/staging");
      const { changes, scmByPath: nextScm } = await computeScmChanges({
        deckId,
        deckHandle,
        staged: getStagedPaths(deckId),
      });
      setScmByPath(nextScm);
      setHasScmChanges(changes.length > 0);
    } catch {
      // ignore transient FS/API errors
    }
  }, [deckHandle, deckId]);

  const refreshLineDiff = useCallback(async () => {
    if (!deckId || !deckHandle || !getDeckGithubLink(deckId)) {
      setScmLineChanges([]);
      return;
    }
    if (!isTextPath(activeFilePath)) {
      setScmLineChanges([]);
      return;
    }
    try {
      const link = getDeckGithubLink(deckId);
      if (!link) return;
      const remote = await getRemoteText(link, activeFilePath);
      const local = editingMarkdown ? markdownRef.current : auxFileText;
      setScmLineChanges(computeLineChanges(remote, local));
    } catch {
      setScmLineChanges([]);
    }
  }, [deckId, deckHandle, activeFilePath, editingMarkdown, auxFileText]);

  useEffect(() => {
    void refreshWorkingTree();
  }, [refreshWorkingTree, scmEpoch, markdown, deckHandle]);

  useEffect(() => {
    void refreshLineDiff();
  }, [refreshLineDiff, markdown, auxFileText, scmEpoch]);

  const activeFilePathRef = useRef(activeFilePath);
  activeFilePathRef.current = activeFilePath;
  const auxFileTextRef = useRef(auxFileText);
  auxFileTextRef.current = auxFileText;

  const flushSave = useCallback(async () => {
    if (isRepoReadOnly) return;
    const handle = deckHandleRef.current;
    const folderName = folderNameRef.current;
    const meta = metadataRef.current;
    if (!handle || !folderName || !meta) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const path = activeFilePathRef.current;
    setSaveStatus("saving");
    try {
      if (isMarkdownPath(path)) {
        const updated = await saveDeck(handle, folderName, markdownRef.current, {
          ...withCurrentFileStyle(meta, path),
          entryFile: path,
        });
        setMetadata(updated);
        setSaveStatus("saved");
        setScmEpoch((n) => n + 1);
        return;
      }
      if (isTextPath(path)) {
        if (path === DECK_META_FILE && !jsonUnlocked) {
          // Keep read-only JSON in sync with live style settings
          const styled = withCurrentFileStyle(meta);
          const updated = await saveDeck(
            handle,
            folderName,
            markdownRef.current,
            styled,
          );
          setMetadata(updated);
          setAuxFileText(`${JSON.stringify(updated, null, 2)}\n`);
          setSaveStatus("saved");
          setScmEpoch((n) => n + 1);
          return;
        }
        await writeRepoTextFile(handle, path, auxFileTextRef.current);
        if (path === DECK_META_FILE) {
          try {
            const parsed = JSON.parse(auxFileTextRef.current) as unknown;
            const { parseDeckMetadata } = await import("@/lib/library/deckFormat");
            const nextMeta = parseDeckMetadata(parsed);
            if (nextMeta) {
              setMetadata(nextMeta);
              applyStyleFromMetadata(
                nextMeta,
                nextMeta.entryFile || DECK_MARKDOWN_FILE,
              );
              if (isMarkdownPath(nextMeta.entryFile)) {
                const entryText =
                  (await readRepoTextFile(handle, nextMeta.entryFile)) ?? "";
                setMarkdown(entryText);
              }
            }
          } catch {
            // Invalid JSON — keep previous metadata until fixed
          }
        } else {
          // Persist file style even while editing another non-markdown file
          const styled = withCurrentFileStyle(meta);
          await saveDeck(handle, folderName, markdownRef.current, styled);
          setMetadata(styled);
        }
        setSaveStatus("saved");
        setScmEpoch((n) => n + 1);
      }
    } catch {
      setSaveStatus("error");
    }
  }, [withCurrentFileStyle, applyStyleFromMetadata, jsonUnlocked, isRepoReadOnly]);

  const openRepoFile = useCallback(
    async (path: string) => {
      if (!deckHandle) return;
      await flushSave();
      if (isImagePath(path)) {
        setImagePreviewPath(path);
        return;
      }
      setActiveFilePath(path);
      setJsonUnlocked(false);
      setJsonUnlockOpen(false);
      if (!isTextPath(path)) {
        setAuxFileText("");
        window.alert("Binary files open in the file tree only.");
        return;
      }
      const text = (await readRepoTextFile(deckHandle, path)) ?? "";
      if (isMarkdownPath(path)) {
        setMarkdown(text);
        setAuxFileText("");
        const meta = metadataRef.current;
        if (meta) {
          applyStyleFromMetadata(meta, path);
          if (meta.entryFile !== path) {
            const style = resolveFileStyle(meta, path);
            const styled = withFileStyle(
              { ...meta, entryFile: path },
              path,
              style.theme,
              style.colorMode,
            );
            setMetadata(styled);
            metadataRef.current = styled;
            skipNextAutosaveRef.current = true;
            try {
              const folderName = folderNameRef.current;
              if (folderName) {
                await saveDeck(deckHandle, folderName, text, styled);
                setSaveStatus("saved");
                setScmEpoch((n) => n + 1);
              }
            } catch {
              setSaveStatus("error");
            }
          }
        }
        return;
      }
      setAuxFileText(text);
    },
    [deckHandle, flushSave, applyStyleFromMetadata],
  );

  const handleNewFile = useCallback(async (parentPath = "") => {
    if (!deckHandle || isRepoReadOnly) return;
    setNamePrompt({ kind: "file", parentPath });
  }, [deckHandle, isRepoReadOnly]);

  const handleNewFolder = useCallback(async (parentPath = "") => {
    if (!deckHandle || isRepoReadOnly) return;
    setNamePrompt({ kind: "folder", parentPath });
  }, [deckHandle, isRepoReadOnly]);

  const handleRenameFile = useCallback(
    async (path: string) => {
      if (!deckHandle || isRepoReadOnly) return;
      setNamePrompt({ kind: "rename", path });
    },
    [deckHandle, isRepoReadOnly],
  );

  const applyNamePrompt = useCallback(
    async (name: string) => {
      if (!deckHandle || !namePrompt) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      setNamePrompt(null);

      if (namePrompt.kind === "file") {
        const path = namePrompt.parentPath
          ? `${namePrompt.parentPath}/${trimmed}`
          : trimmed;
        await createRepoFile(deckHandle, path, "");
        setScmEpoch((n) => n + 1);
        await openRepoFile(path);
        return;
      }

      if (namePrompt.kind === "folder") {
        const path = namePrompt.parentPath
          ? `${namePrompt.parentPath}/${trimmed}`
          : trimmed;
        await createRepoFolder(deckHandle, path);
        setScmEpoch((n) => n + 1);
        return;
      }

      const path = namePrompt.path;
      if (trimmed === path) return;
      await renameRepoPath(deckHandle, path, trimmed);
      if (activeFilePath === path) setActiveFilePath(trimmed);
      const meta = metadataRef.current;
      if (meta) {
        const fileStyles = { ...(meta.fileStyles ?? {}) };
        if (isMarkdownPath(path) && fileStyles[path]) {
          fileStyles[trimmed] = fileStyles[path]!;
          delete fileStyles[path];
        }
        const nextMeta: DeckMetadata = {
          ...meta,
          fileStyles,
          entryFile: meta.entryFile === path ? trimmed : meta.entryFile,
        };
        setMetadata(nextMeta);
        metadataRef.current = nextMeta;
      }
      setScmEpoch((n) => n + 1);
    },
    [deckHandle, namePrompt, openRepoFile, activeFilePath],
  );

  const handleDeleteFile = useCallback(
    async (path: string) => {
      if (!deckHandle || isRepoReadOnly) return;
      setDeleteConfirmPath(path);
    },
    [deckHandle, isRepoReadOnly],
  );

  const confirmDeleteFile = useCallback(async () => {
    const path = deleteConfirmPath;
    if (!deckHandle || !path) return;
    setDeleteConfirmPath(null);
    try {
      await removeRepoPath(deckHandle, path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
      return;
    }
    if (deckId) unstagePath(deckId, path);

    const meta = metadataRef.current;
    if (meta) {
      const fileStyles = { ...(meta.fileStyles ?? {}) };
      let changed = false;
      for (const key of Object.keys(fileStyles)) {
        if (key === path || key.startsWith(`${path}/`)) {
          delete fileStyles[key];
          changed = true;
        }
      }
      let nextEntry = meta.entryFile;
      if (meta.entryFile === path || meta.entryFile.startsWith(`${path}/`)) {
        nextEntry = DECK_MARKDOWN_FILE;
        changed = true;
      }
      if (changed) {
        const nextMeta: DeckMetadata = {
          ...meta,
          fileStyles,
          entryFile: nextEntry,
        };
        setMetadata(nextMeta);
        metadataRef.current = nextMeta;
      }
    }

    if (activeFilePath === path || activeFilePath.startsWith(`${path}/`)) {
      const fallback =
        metadataRef.current?.entryFile || DECK_MARKDOWN_FILE;
      setActiveFilePath(fallback);
      const text = (await readRepoTextFile(deckHandle, fallback)) ?? "";
      skipNextAutosaveRef.current = true;
      setMarkdown(text);
      setAuxFileText("");
    }
    setScmEpoch((n) => n + 1);
  }, [deckHandle, deleteConfirmPath, deckId, activeFilePath]);

  const handleQuickPush = useCallback(async () => {
    if (!deckId || !deckHandle || !getDeckGithubLink(deckId)) return;
    setQuickPushBusy(true);
    try {
      await flushSave();
      const commitMessage = formatContentUpdateMessage();
      await pushDeckToGithub({
        deckId,
        deckHandle,
        message: commitMessage,
      });
      clearStaged(deckId);
      setScmEpoch((n) => n + 1);
    } catch (err) {
      const message =
        err instanceof PushConflictError
          ? `${err.message}\n\nPull first, or force-push from the Git panel.`
          : err instanceof Error
            ? err.message
            : String(err);
      window.alert(message);
    } finally {
      setQuickPushBusy(false);
    }
  }, [deckId, deckHandle, flushSave]);

  const handleIncludeFile = useCallback(
    async (path: string) => {
      if (!deckId) return;
      stagePath(deckId, path);
      setScmEpoch((n) => n + 1);
    },
    [deckId],
  );

  const handleRevertFile = useCallback(
    async (path: string) => {
      if (!deckId || !deckHandle || isRepoReadOnly) return;
      setRevertConfirmPath(path);
    },
    [deckId, deckHandle, isRepoReadOnly],
  );

  const confirmRevertFile = useCallback(async () => {
    const path = revertConfirmPath;
    if (!deckId || !deckHandle || !path) return;
    setRevertConfirmPath(null);
    await revertFileFromRemote({ deckId, deckHandle, path });
    unstagePath(deckId, path);
    if (isMarkdownPath(path) && (path === entryFile || path === activeFilePath)) {
      const text = (await readRepoTextFile(deckHandle, path)) ?? "";
      skipNextAutosaveRef.current = true;
      setMarkdown(text);
      if (path === activeFilePath) setAuxFileText("");
    } else if (path === activeFilePath) {
      await openRepoFile(path);
    }
    setScmEpoch((n) => n + 1);
  }, [
    deckId,
    deckHandle,
    revertConfirmPath,
    activeFilePath,
    entryFile,
    openRepoFile,
  ]);

  useEffect(() => {
    if (!isLibraryDeck) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveStatus === "saving") {
        event.preventDefault();
      }
      void flushSave();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isLibraryDeck, saveStatus, flushSave]);

  const scheduleSave = useCallback(
    (
      nextMarkdown: string,
      nextTheme: SlideThemeId,
      nextColorMode: SlideColorMode,
      nextMeta: DeckMetadata,
      styleFilePath?: string,
    ) => {
      const handle = deckHandleRef.current;
      const folderName = folderNameRef.current;
      if (!handle || !folderName) return;

      const delay = resolveAutosaveDelayMs();
      if (delay === 0) {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        return;
      }

      setSaveStatus("saving");
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            const path =
              styleFilePath ||
              nextMeta.entryFile ||
              DECK_MARKDOWN_FILE;
            const updated = await saveDeck(
              handle,
              folderName,
              nextMarkdown,
              withFileStyle(nextMeta, path, nextTheme, nextColorMode),
            );
            setMetadata(updated);
            setSaveStatus("saved");
            setScmEpoch((n) => n + 1);
          } catch {
            setSaveStatus("error");
          }
        })();
      }, delay);
    },
    [resolveAutosaveDelayMs],
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

    if (!isMarkdownPath(activeFilePath) && isTextPath(activeFilePath)) {
      if (activeFilePath === DECK_META_FILE && jsonReadOnly) {
        const styled = withCurrentFileStyle(meta);
        setAuxFileText(`${JSON.stringify(styled, null, 2)}\n`);
        scheduleSave(
          markdown,
          slideTheme,
          slideColorMode,
          {
            ...styled,
            entryFile: meta.entryFile || DECK_MARKDOWN_FILE,
          },
          styleTargetPath,
        );
        return;
      }
      if (jsonReadOnly) return;
      const delay = resolveAutosaveDelayMs();
      if (delay === 0) return;
      setSaveStatus("saving");
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            await writeRepoTextFile(deckHandle, activeFilePath, auxFileText);
            if (activeFilePath !== DECK_META_FILE) {
              const styled = withCurrentFileStyle(meta);
              await saveDeck(deckHandle, deckId, markdownRef.current, styled);
              setMetadata(styled);
            } else {
              try {
                const parsed = JSON.parse(auxFileText) as unknown;
                const { parseDeckMetadata } = await import(
                  "@/lib/library/deckFormat"
                );
                const nextMeta = parseDeckMetadata(parsed);
                if (nextMeta) {
                  setMetadata(nextMeta);
                  applyStyleFromMetadata(
                    nextMeta,
                    nextMeta.entryFile || DECK_MARKDOWN_FILE,
                  );
                }
              } catch {
                // keep previous metadata
              }
            }
            setSaveStatus("saved");
            setScmEpoch((n) => n + 1);
          } catch {
            setSaveStatus("error");
          }
        })();
      }, delay);
      return;
    }

    if (!isMarkdownPath(activeFilePath)) return;

    scheduleSave(
      markdown,
      slideTheme,
      slideColorMode,
      {
        ...meta,
        entryFile: activeFilePath,
      },
      activeFilePath,
    );
  }, [
    markdown,
    auxFileText,
    activeFilePath,
    slideTheme,
    slideColorMode,
    styleTargetPath,
    isLibraryDeck,
    deckHandle,
    deckId,
    loading,
    scheduleSave,
    jsonReadOnly,
    withCurrentFileStyle,
    applyStyleFromMetadata,
    resolveAutosaveDelayMs,
    workspaceMode,
  ]);

  const handleMarkdownChange = useCallback(
    (value: string) => {
      if (isJsonFile && !jsonUnlocked) return;
      if (isMarkdownPath(activeFilePath)) {
        setMarkdown(value);
      } else {
        setAuxFileText(value);
      }
    },
    [activeFilePath, isJsonFile, jsonUnlocked],
  );

  const handleThemeChange = useCallback(
    (theme: SlideThemeId) => {
      setSlideTheme(theme);
      const meta = metadataRef.current;
      if (meta) {
        const next = withFileStyle(meta, styleTargetPath, theme, slideColorMode);
        setMetadata(next);
        metadataRef.current = next;
      }
    },
    [styleTargetPath, slideColorMode],
  );

  const handleColorModeChange = useCallback(
    (mode: SlideColorMode) => {
      setSlideColorMode(mode);
      const meta = metadataRef.current;
      if (meta) {
        const next = withFileStyle(meta, styleTargetPath, slideTheme, mode);
        setMetadata(next);
        metadataRef.current = next;
      }
    },
    [styleTargetPath, slideTheme],
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
      applyStyleFromMetadata(
        pulled.metadata,
        pulled.metadata.entryFile || DECK_MARKDOWN_FILE,
      );
      setMetadata(pulled.metadata);
      setActiveFilePath(pulled.metadata.entryFile || DECK_MARKDOWN_FILE);
      setAuxFileText("");
      setSaveStatus("saved");
      setScmEpoch((n) => n + 1);
      setImageEpoch((n) => n + 1);
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
    [deckId, applyStyleFromMetadata],
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
    [deckHandle, deckId, imageEpoch],
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
          workspace={{
            mode: workspaceMode,
            repositoryName,
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
            onQuickPush: () => void handleQuickPush(),
            quickPushBusy,
            canQuickPush:
              isLinked &&
              !isRepoReadOnly &&
              Boolean(deckHandle) &&
              hasScmChanges,
            quickPushClean:
              isLinked && !isRepoReadOnly && Boolean(deckHandle) && !hasScmChanges,
            onUndo: () => editorRef.current?.undo(),
            onRedo: () => editorRef.current?.redo(),
            canUndo: editorHistory.canUndo,
            canRedo: editorHistory.canRedo,
          }}
        />
        <FilesPanel
          open={workspacePanel === "files"}
          onClose={() => setWorkspacePanel(null)}
          mode={workspaceMode}
          onModeChange={(mode) => void handleWorkspaceModeChange(mode)}
          currentDeckId={deckId ?? null}
          onOpenGithub={() => setWorkspacePanel("github")}
          isLinked={isLinked}
          fileTree={fileTree}
          selectedFilePath={activeFilePath}
          scmByPath={scmByPath}
          onSelectFile={(path) => void openRepoFile(path)}
          onNewFile={(parent) => void handleNewFile(parent)}
          onNewFolder={(parent) => void handleNewFolder(parent)}
          onRenameFile={(path) => void handleRenameFile(path)}
          onDeleteFile={(path) => void handleDeleteFile(path)}
          onIncludeFile={(path) => void handleIncludeFile(path)}
          onRevertFile={(path) => void handleRevertFile(path)}
          onDeckDeleted={(deletedId) => {
            if (deletedId === deckId) {
              setScmEpoch((n) => n + 1);
            }
          }}
          onDeckRenamed={(renamedId, title) => {
            if (renamedId === deckId && metadata) {
              setMetadata({ ...metadata, title });
            }
          }}
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
          onDeckLinked={(linkedDeckId) => {
            setWorkspacePanel(null);
            setScmEpoch((n) => n + 1);
            writeWorkspaceMode("git");
            setWorkspaceMode("git");
            if (linkedDeckId !== deckId) {
              navigate(`/edit/${linkedDeckId}`);
            }
          }}
          onOpenFile={(path) => {
            setWorkspacePanel(null);
            void openRepoFile(path);
          }}
          onScmChanged={() => {
            setScmEpoch((n) => n + 1);
            void refreshWorkingTree();
            void refreshLineDiff();
          }}
          scmEpoch={scmEpoch}
        />
        <main className="home-split-layout grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2 overflow-hidden p-2 pt-2 sm:grid-cols-2 sm:grid-rows-[minmax(0,1fr)]">
          <section className="home-split-editor glass-panel flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="panel-chrome relative z-[1] flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-xs font-semibold tracking-wide">
              <span className="min-w-0 truncate font-mono text-[11px]">
                {fileBasename(activeFilePath)}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                {isJsonFile ? (
                  jsonReadOnly ? (
                    <>
                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                        {t.readOnly}
                      </span>
                      <button
                        type="button"
                        onClick={() => setJsonUnlockOpen(true)}
                        className="glass-toolbar-action shrink-0 rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-semibold"
                      >
                        {t.unlock}
                      </button>
                    </>
                  ) : (
                    <span className="shrink-0 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      {t.editable}
                    </span>
                  )
                ) : null}
              </div>
            </div>
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
              <MarkdownEditor
                ref={editorRef}
                value={editingMarkdown ? markdown : auxFileText}
                onChange={handleMarkdownChange}
                onLocateSlide={handleLocateSlide}
                onHistoryChange={setEditorHistory}
                placeholder={t.placeholder}
                showLineNumbers
                scmLineChanges={isLinked ? scmLineChanges : []}
                readOnly={editorReadOnly}
              />
            </div>
          </section>

          <section className="home-split-slides glass-panel flex min-h-0 min-w-0 flex-col">
            <div className="panel-chrome panel-chrome-compact relative z-[1] flex shrink-0 items-center justify-between border-b px-4 py-2">
              <span className="relative z-[1] text-xs font-semibold tracking-wide">
                {t.slides}
              </span>
              <div className="relative z-[1] flex items-center gap-2">
                <StyleSelector
                  value={slideTheme}
                  colorMode={slideColorMode}
                  fileLabel={styleTargetPath}
                  onChange={handleThemeChange}
                  onColorModeChange={handleColorModeChange}
                />
                <SlideActions
                  markdown={markdown}
                  theme={slideTheme}
                  colorMode={slideColorMode}
                  filename={exportFilename}
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

        <ImagePreviewDialog
          open={imagePreviewPath !== null}
          path={imagePreviewPath}
          deckHandle={deckHandle}
          onClose={() => setImagePreviewPath(null)}
        />

        {jsonUnlockOpen ? (
          <DialogPortal>
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
              onClick={() => setJsonUnlockOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="json-unlock-title"
                className="glass-panel glass-panel-dialog w-full max-w-md rounded-xl border p-5 shadow-lg"
                onClick={(event) => event.stopPropagation()}
              >
                <h2
                  id="json-unlock-title"
                  className="text-base font-semibold"
                >
                  {t.unlockTitle}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.unlockBody}
                </p>
                {activeFilePath === DECK_META_FILE ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {DECK_META_FILE} · fileStyles
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="glass-toolbar-action rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold"
                    onClick={() => setJsonUnlockOpen(false)}
                  >
                    {t.unlockCancel}
                  </button>
                  <button
                    type="button"
                    className="glass-primary rounded-lg px-3 py-1.5 text-xs font-semibold"
                    onClick={() => {
                      setJsonUnlocked(true);
                      setJsonUnlockOpen(false);
                    }}
                  >
                    {t.unlockConfirm}
                  </button>
                </div>
              </div>
            </div>
          </DialogPortal>
        ) : null}

        <NamePromptDialog
          open={namePrompt !== null}
          title={
            namePrompt?.kind === "folder"
              ? "New folder"
              : namePrompt?.kind === "rename"
                ? "Rename"
                : "New file"
          }
          initialValue={
            namePrompt?.kind === "rename"
              ? namePrompt.path
              : namePrompt?.kind === "folder"
                ? "assets"
                : "notes.md"
          }
          confirmLabel={namePrompt?.kind === "rename" ? "Rename" : "Create"}
          onCancel={() => setNamePrompt(null)}
          onConfirm={(name) => void applyNamePrompt(name)}
        />
        <ConfirmDialog
          open={deleteConfirmPath !== null}
          title="Delete file?"
          description={
            deleteConfirmPath
              ? `Delete “${deleteConfirmPath}”? This cannot be undone locally. Missing references may break the deck.`
              : undefined
          }
          variant="danger"
          confirmLabel="Delete"
          onCancel={() => setDeleteConfirmPath(null)}
          onConfirm={() => void confirmDeleteFile()}
        />
        <ConfirmDialog
          open={revertConfirmPath !== null}
          title="Revert file?"
          description={
            revertConfirmPath
              ? `Revert “${revertConfirmPath}”? Local changes will be lost.`
              : undefined
          }
          variant="danger"
          confirmLabel="Revert"
          onCancel={() => setRevertConfirmPath(null)}
          onConfirm={() => void confirmRevertFile()}
        />
      </div>
    </DeckProvider>
  );
}
