import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Github, Plus } from "lucide-react";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { LibraryIndexEntry } from "@/lib/library/deckFormat";
import {
  connectLibraryRoot,
  createDeck,
  getLibraryRoot,
} from "@/lib/library/deckStorage";
import {
  createAutoDefaultLibraryRoot,
  isDiskFolderPickerSupported,
  isLibrarySupported,
  pickCustomLibraryRoot,
} from "@/lib/library/fsAccess";
import { getAuthStatus } from "@/lib/github/auth";
import { listDeckGithubLinks } from "@/lib/github/deckSync";
import { refreshLibraryIndex } from "@/lib/library/libraryIndex";
import {
  DEFAULT_LIBRARY_DISPLAY_PATH,
  getLibraryDisplayPath,
} from "@/lib/library/libraryPaths";
import {
  getLibraryPreference,
} from "@/lib/library/libraryPreference";
import { getDefaultPresentationFilename } from "@/lib/presentationFilename";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

export type FilesSource = "browser" | "disk" | "git";

const SOURCE_KEY = "quick-slides.files-source";

function readFilesSource(): FilesSource {
  try {
    const raw = localStorage.getItem(SOURCE_KEY);
    if (raw === "browser" || raw === "disk" || raw === "git") return raw;
  } catch {
    // ignore
  }
  return getLibraryPreference() === "custom" ? "disk" : "browser";
}

function writeFilesSource(source: FilesSource): void {
  localStorage.setItem(SOURCE_KEY, source);
}

const copy = {
  en: {
    title: "Files",
    empty: "No presentations yet.",
    emptyGit: "No presentations linked to GitHub yet.",
    newPresentation: "New",
    chooseFolder: "Choose folder",
    changeFolder: "Change folder",
    browserHint: "Browser local storage (OPFS).",
    diskHint: "Folder on this computer.",
    gitHint: "Presentations linked to a GitHub repository.",
    open: "Open",
    current: "Current",
    loadFailed: "Could not load library.",
    createFailed: "Could not create presentation.",
    sourceBrowser: "localStorage",
    sourceDisk: "Local folder",
    sourceGit: "Git",
    signInGit: "Sign in via GitHub to link repos.",
    openGithub: "Open GitHub",
  },
  zh: {
    title: "文件",
    empty: "还没有演示文稿。",
    emptyGit: "还没有关联到 GitHub 的演示文稿。",
    newPresentation: "新建",
    chooseFolder: "选择文件夹",
    changeFolder: "更换文件夹",
    browserHint: "浏览器本地存储（OPFS）。",
    diskHint: "本机文件夹。",
    gitHint: "已关联 GitHub 仓库的演示文稿。",
    open: "打开",
    current: "当前",
    loadFailed: "无法加载库。",
    createFailed: "无法创建演示文稿。",
    sourceBrowser: "本地存储",
    sourceDisk: "本地文件夹",
    sourceGit: "Git",
    signInGit: "请先通过 GitHub 登录以关联仓库。",
    openGithub: "打开 GitHub",
  },
} as const;

type FilesPanelProps = {
  open: boolean;
  onClose: () => void;
  currentDeckId?: string | null;
  onOpenGithub?: () => void;
};

export function FilesPanel({
  open,
  onClose,
  currentDeckId,
  onOpenGithub,
}: FilesPanelProps) {
  const language = useLanguage();
  const t = copy[language];
  const navigate = useNavigate();
  const [source, setSource] = useState<FilesSource>(() => readFilesSource());
  const [entries, setEntries] = useState<LibraryIndexEntry[]>([]);
  const [gitEntries, setGitEntries] = useState<
    Array<{ deckId: string; title: string; fullName: string }>
  >([]);
  const [displayPath, setDisplayPath] = useState(DEFAULT_LIBRARY_DISPLAY_PATH);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signedIn = getAuthStatus().signedIn;

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const root = await getLibraryRoot();
      setDisplayPath(getLibraryDisplayPath(root));
      const next = await refreshLibraryIndex();
      setEntries(next);

      const titleById = new Map(next.map((entry) => [entry.folderName, entry.title]));
      const links = listDeckGithubLinks().map(({ deckId, link }) => ({
        deckId,
        title: titleById.get(deckId) ?? deckId,
        fullName: link.fullName,
      }));
      setGitEntries(links);
    } catch {
      setError(t.loadFailed);
      setEntries([]);
      setGitEntries([]);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, refresh]);

  const selectSource = async (next: FilesSource) => {
    setSource(next);
    writeFilesSource(next);
    setError(null);
    setBusy(true);
    try {
      if (next === "browser") {
        const handle = await createAutoDefaultLibraryRoot();
        if (handle) {
          await connectLibraryRoot(handle, "default");
        }
        await refresh();
      } else if (next === "disk") {
        if (!isDiskFolderPickerSupported()) {
          setError(t.loadFailed);
          return;
        }
        if (getLibraryPreference() !== "custom") {
          const handle = await pickCustomLibraryRoot();
          if (!handle) return;
          const ok = await connectLibraryRoot(handle, "custom");
          if (!ok) {
            setError(t.loadFailed);
            return;
          }
        }
        await refresh();
      } else {
        await refresh();
      }
    } catch {
      setError(t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = (folderName: string) => {
    onClose();
    navigate(`/edit/${folderName}`);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      let root = await getLibraryRoot();
      if (!root && source === "browser") {
        const handle = await createAutoDefaultLibraryRoot();
        if (handle) {
          await connectLibraryRoot(handle, "default");
          root = await getLibraryRoot();
        }
      }
      if (!root) {
        setError(t.loadFailed);
        return;
      }
      const deck = await createDeck(
        root,
        getDefaultPresentationFilename(language),
        language,
      );
      onClose();
      navigate(`/edit/${deck.folderName}`);
    } catch {
      setError(t.createFailed);
    } finally {
      setBusy(false);
    }
  };

  const handlePickFolder = async () => {
    if (!isDiskFolderPickerSupported()) return;
    setBusy(true);
    setError(null);
    try {
      const handle = await pickCustomLibraryRoot();
      if (!handle) return;
      const ok = await connectLibraryRoot(handle, "custom");
      if (!ok) {
        setError(t.loadFailed);
        return;
      }
      setSource("disk");
      writeFilesSource("disk");
      await refresh();
    } catch {
      setError(t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const sources: Array<{ id: FilesSource; label: string }> = [
    { id: "browser", label: t.sourceBrowser },
    { id: "disk", label: t.sourceDisk },
    { id: "git", label: t.sourceGit },
  ];

  const hint =
    source === "browser"
      ? t.browserHint
      : source === "disk"
        ? displayPath === DEFAULT_LIBRARY_DISPLAY_PATH
          ? t.diskHint
          : displayPath
        : t.gitHint;

  const listEntries =
    source === "git"
      ? gitEntries.map((entry) => ({
          id: entry.deckId,
          title: entry.title,
          subtitle: entry.fullName,
        }))
      : entries.map((entry) => ({
          id: entry.folderName,
          title: entry.title,
          subtitle: undefined as string | undefined,
        }));

  return (
    <WorkspacePanel open={open} title={t.title} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div
          role="tablist"
          aria-label={t.title}
          className="glass-seg-track relative grid h-9 w-full shrink-0 grid-cols-3 gap-1"
        >
          <div
            aria-hidden
            className="glass-seg-active pointer-events-none absolute top-[var(--glass-seg-pad)] bottom-[var(--glass-seg-pad)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              left: `calc(${(sources.findIndex((item) => item.id === source) / 3) * 100}% + var(--glass-seg-pad))`,
              width: "calc(33.333% - (2 * var(--glass-seg-pad)))",
            }}
          />
          {sources.map((item) => {
            const active = source === item.id;
            const disabled =
              busy ||
              (item.id === "disk" && !isDiskFolderPickerSupported());
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={disabled}
                onClick={() => void selectSource(item.id)}
                className="relative z-[1] truncate px-1 text-[10px] font-medium text-muted-foreground disabled:opacity-40"
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {source !== "git" ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={busy || !isLibrarySupported()}
              onClick={() => void handleCreate()}
              className="glass-toolbar-action inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden />
              {t.newPresentation}
            </button>
            {source === "disk" && isDiskFolderPickerSupported() ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePickFolder()}
                className="glass-toolbar-action inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                <FolderOpen className="size-3.5" aria-hidden />
                {getLibraryPreference() === "custom" ? t.changeFolder : t.chooseFolder}
              </button>
            ) : null}
          </div>
        ) : null}

        <p className="shrink-0 text-[11px] text-muted-foreground">{hint}</p>

        {error ? (
          <p className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        {source === "git" && !signedIn ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t.signInGit}</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenGithub?.();
              }}
              className="glass-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
            >
              <Github className="size-3.5" aria-hidden />
              {t.openGithub}
            </button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10">
            {listEntries.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {source === "git" ? t.emptyGit : t.empty}
              </p>
            ) : (
              <ul className="divide-y divide-white/10">
                {listEntries.map((entry) => {
                  const isCurrent = entry.id === currentDeckId;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => handleOpen(entry.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/8",
                          isCurrent && "bg-white/10",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {entry.title}
                          </span>
                          {entry.subtitle ? (
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {entry.subtitle}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {isCurrent ? t.current : t.open}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </WorkspacePanel>
  );
}
