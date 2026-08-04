import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Github,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { NamePromptDialog } from "@/components/NamePromptDialog";
import type { WorkspaceMode } from "@/components/Header";
import { RepoFileTree } from "@/components/RepoFileTree";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { LibraryIndexEntry } from "@/lib/library/deckFormat";
import {
  connectLibraryRoot,
  createDeck,
  deleteDeck,
  ensureBrowserLibraryRoot,
  getLibraryRoot,
  loadDeck,
  updateDeckTitle,
} from "@/lib/library/deckStorage";
import {
  isDiskFolderPickerSupported,
  isLibrarySupported,
  pickCustomLibraryRoot,
} from "@/lib/library/fsAccess";
import { getAuthStatus } from "@/lib/github/auth";
import { clearDeckGithubLink, listDeckGithubLinks } from "@/lib/github/deckSync";
import type { FileScmKind } from "@/lib/github/scmStatus";
import type { RepoFileEntry } from "@/lib/github/workingTree";
import { refreshLibraryIndex } from "@/lib/library/libraryIndex";
import {
  DEFAULT_LIBRARY_DISPLAY_PATH,
  getLibraryDisplayPath,
} from "@/lib/library/libraryPaths";
import { getLibraryPreference } from "@/lib/library/libraryPreference";
import { getDefaultPresentationFilename } from "@/lib/presentationFilename";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

/** @deprecated use WorkspaceMode */
export type FilesSource = WorkspaceMode;

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
    projectHint: "Working tree for the linked GitHub repository.",
    open: "Open",
    current: "Current",
    loadFailed: "Could not load library.",
    createFailed: "Could not create presentation.",
    newFile: "New file",
    newFolder: "New folder",
    signInGit: "Sign in via GitHub to link repos.",
    openGithub: "Open GitHub",
    notLinked: "Link a GitHub repository to browse project files.",
    modeBrowser: "localStorage",
    modeDisk: "Local Repository",
    modeGit: "Git Project",
    modeLabel: "Workspace mode",
    namePrompt: "Presentation name",
    rename: "Rename…",
    delete: "Delete…",
    renamePrompt: "Rename presentation",
    renameConfirm: "Rename",
    deleteConfirm: "Delete this presentation? This cannot be undone.",
    deleteFailed: "Could not delete presentation.",
    renameFailed: "Could not rename presentation.",
    noFolderChosen: "No folder chosen.",
    noFolderChosenHint: "Choose a local folder to browse presentations on disk.",
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
    projectHint: "已关联仓库的工作区文件。",
    open: "打开",
    current: "当前",
    loadFailed: "无法加载库。",
    createFailed: "无法创建演示文稿。",
    newFile: "新建文件",
    newFolder: "新建文件夹",
    signInGit: "请先通过 GitHub 登录以关联仓库。",
    openGithub: "打开 GitHub",
    notLinked: "关联 GitHub 仓库后可浏览项目文件。",
    modeBrowser: "本地存储",
    modeDisk: "本地仓库",
    modeGit: "Git 项目",
    modeLabel: "工作区模式",
    namePrompt: "演示文稿名称",
    rename: "重命名…",
    delete: "删除…",
    renamePrompt: "重命名演示文稿",
    renameConfirm: "重命名",
    deleteConfirm: "删除此演示文稿？此操作无法撤销。",
    deleteFailed: "无法删除演示文稿。",
    renameFailed: "无法重命名演示文稿。",
    noFolderChosen: "尚未选择文件夹。",
    noFolderChosenHint: "请选择本机文件夹以浏览磁盘上的演示文稿。",
  },
} as const;

type ContextMenuState = {
  id: string;
  title: string;
  x: number;
  y: number;
};

type FilesPanelProps = {
  open: boolean;
  onClose: () => void;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  currentDeckId?: string | null;
  onOpenGithub?: () => void;
  isLinked?: boolean;
  fileTree?: RepoFileEntry[];
  selectedFilePath?: string | null;
  scmByPath?: Record<string, FileScmKind>;
  onSelectFile?: (path: string) => void;
  onNewFile?: (parentPath?: string) => void;
  onNewFolder?: (parentPath?: string) => void;
  onRenameFile?: (path: string) => void;
  onIncludeFile?: (path: string) => void;
  onRevertFile?: (path: string) => void;
  onDeckDeleted?: (deckId: string) => void;
  onDeckRenamed?: (deckId: string, title: string) => void;
};

export function FilesPanel({
  open,
  onClose,
  mode,
  onModeChange,
  currentDeckId,
  onOpenGithub,
  isLinked = false,
  fileTree = [],
  selectedFilePath = null,
  scmByPath = {},
  onSelectFile,
  onNewFile,
  onNewFolder,
  onRenameFile,
  onIncludeFile,
  onRevertFile,
  onDeckDeleted,
  onDeckRenamed,
}: FilesPanelProps) {
  const language = useLanguage();
  const t = copy[language];
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LibraryIndexEntry[]>([]);
  const [gitEntries, setGitEntries] = useState<
    Array<{ deckId: string; title: string; fullName: string }>
  >([]);
  const [displayPath, setDisplayPath] = useState(DEFAULT_LIBRARY_DISPLAY_PATH);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [namePrompt, setNamePrompt] = useState<
    | { kind: "create" }
    | { kind: "rename"; id: string; title: string }
    | null
  >(null);
  const [folderEpoch, setFolderEpoch] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const signedIn = getAuthStatus().signedIn;
  const hasDiskFolder = getLibraryPreference() === "custom";
  const diskNeedsFolder = mode === "disk" && !hasDiskFolder;

  const modes: Array<{ id: WorkspaceMode; label: string }> = [
    { id: "browser", label: t.modeBrowser },
    { id: "disk", label: t.modeDisk },
    { id: "git", label: t.modeGit },
  ];
  const modeIndex = Math.max(0, modes.findIndex((item) => item.id === mode));

  const refresh = useCallback(async () => {
    setError(null);
    try {
      if (mode === "disk" && getLibraryPreference() !== "custom") {
        setEntries([]);
        setDisplayPath(DEFAULT_LIBRARY_DISPLAY_PATH);
        setGitEntries([]);
        return;
      }

      const root = await getLibraryRoot();
      setDisplayPath(getLibraryDisplayPath(root));
      const next = await refreshLibraryIndex();
      setEntries(next);

      const titleById = new Map(next.map((entry) => [entry.folderName, entry.title]));
      const links = listDeckGithubLinks().map(({ deckId, link }) => ({
        deckId,
        title: titleById.get(deckId) ?? deckId,
        fullName: link.pathPrefix
          ? `${link.fullName}/${link.pathPrefix}`
          : link.fullName,
      }));
      setGitEntries(links);
    } catch {
      setError(t.loadFailed);
      setEntries([]);
      setGitEntries([]);
    }
  }, [t.loadFailed, mode, folderEpoch]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (menu) {
          setMenu(null);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, refresh, mode, menu]);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      setMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menu]);

  const handleOpen = (folderName: string) => {
    onClose();
    navigate(`/edit/${folderName}`);
  };

  const handleCreate = async (name: string) => {
    setNamePrompt(null);
    if (mode === "disk" && getLibraryPreference() !== "custom") {
      setError(t.noFolderChosen);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let root: FileSystemDirectoryHandle | null = null;
      if (mode === "browser") {
        root = await ensureBrowserLibraryRoot();
      } else {
        root = await getLibraryRoot();
        if (!root && isDiskFolderPickerSupported()) {
          const handle = await pickCustomLibraryRoot();
          if (handle) {
            const ok = await connectLibraryRoot(handle, "custom");
            if (ok) {
              root = handle;
              setFolderEpoch((n) => n + 1);
            }
          }
        }
      }
      if (!root) {
        setError(t.loadFailed);
        return;
      }
      const deck = await createDeck(root, name.trim(), language);
      onClose();
      navigate(`/edit/${deck.folderName}`);
    } catch (err) {
      console.error("createDeck failed", err);
      setError(
        err instanceof Error && err.message
          ? `${t.createFailed} ${err.message}`
          : t.createFailed,
      );
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
      setFolderEpoch((n) => n + 1);
      await refresh();
      onModeChange("disk");
    } catch {
      setError(t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleRenameDeck = async (deckId: string, nextTitle: string) => {
    setNamePrompt(null);
    setBusy(true);
    setError(null);
    try {
      const root = await getLibraryRoot();
      if (!root) {
        setError(t.renameFailed);
        return;
      }
      const loaded = await loadDeck(root, deckId);
      if (!loaded) {
        setError(t.renameFailed);
        return;
      }
      await updateDeckTitle(
        loaded.handle,
        deckId,
        loaded.metadata,
        nextTitle.trim(),
      );
      await refresh();
      onDeckRenamed?.(deckId, nextTitle.trim());
    } catch {
      setError(t.renameFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
    setBusy(true);
    setError(null);
    try {
      const root = await getLibraryRoot();
      if (!root) {
        setError(t.deleteFailed);
        return;
      }
      await deleteDeck(root, deckId);
      clearDeckGithubLink(deckId);
      await refresh();
      onDeckDeleted?.(deckId);
      if (deckId === currentDeckId) {
        onClose();
        navigate("/", { replace: true });
      }
    } catch {
      setError(t.deleteFailed);
    } finally {
      setBusy(false);
    }
  };

  const openEntryMenu = (
    event: MouseEvent,
    entry: { id: string; title: string },
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      id: entry.id,
      title: entry.title,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const showProjectTree = mode === "git" && isLinked;
  const showLinkedList = mode === "git" && !isLinked;
  const showLibraryList = mode === "browser" || mode === "disk";
  const showDiskEmpty = diskNeedsFolder;

  const hint =
    mode === "browser"
      ? t.browserHint
      : mode === "disk"
        ? diskNeedsFolder
          ? t.noFolderChosenHint
          : displayPath === DEFAULT_LIBRARY_DISPLAY_PATH
            ? t.diskHint
            : displayPath
        : isLinked
          ? t.projectHint
          : t.gitHint;

  const listEntries = showLinkedList
    ? gitEntries.map((entry) => ({
        id: entry.deckId,
        title: entry.title,
        subtitle: entry.fullName,
      }))
    : showDiskEmpty
      ? []
      : entries.map((entry) => ({
          id: entry.folderName,
          title: entry.title,
          subtitle: undefined as string | undefined,
        }));

  return (
    <WorkspacePanel
      open={open}
      title={t.title}
      onClose={onClose}
      size={showProjectTree ? "tall" : "default"}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div
          role="tablist"
          aria-label={t.modeLabel}
          className="glass-seg-track relative grid h-9 w-full shrink-0 gap-1"
          style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
        >
          <div
            aria-hidden
            className="glass-seg-active pointer-events-none absolute top-[var(--glass-seg-pad)] bottom-[var(--glass-seg-pad)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              left: `calc(${(modeIndex / modes.length) * 100}% + var(--glass-seg-pad))`,
              width: `calc(${100 / modes.length}% - (2 * var(--glass-seg-pad)))`,
            }}
          />
          {modes.map((item) => {
            const active = mode === item.id;
            const disabled =
              busy || (item.id === "disk" && !isDiskFolderPickerSupported());
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-state={active ? "active" : "inactive"}
                disabled={disabled}
                onClick={() => onModeChange(item.id)}
                className="relative z-[1] truncate px-1 text-[10px] font-semibold text-muted-foreground disabled:opacity-40"
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {showProjectTree ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onNewFile?.()}
              className="glass-toolbar-action inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <FilePlus2 className="size-3.5" aria-hidden />
              {t.newFile}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onNewFolder?.()}
              className="glass-toolbar-action inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <FolderPlus className="size-3.5" aria-hidden />
              {t.newFolder}
            </button>
          </div>
        ) : showLibraryList ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={busy || !isLibrarySupported() || diskNeedsFolder}
              onClick={() => setNamePrompt({ kind: "create" })}
              className="glass-toolbar-action inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden />
              {t.newPresentation}
            </button>
            {mode === "disk" && isDiskFolderPickerSupported() ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePickFolder()}
                className="glass-toolbar-action inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                <FolderOpen className="size-3.5" aria-hidden />
                {hasDiskFolder ? t.changeFolder : t.chooseFolder}
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

        {showProjectTree ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10">
            <RepoFileTree
              entries={fileTree}
              selectedPath={selectedFilePath}
              scmByPath={scmByPath}
              onSelect={(path) => {
                onSelectFile?.(path);
                onClose();
              }}
              onRename={onRenameFile}
              onNewFile={(parent) => onNewFile?.(parent)}
              onNewFolder={(parent) => onNewFolder?.(parent)}
              onInclude={onIncludeFile}
              onRevert={onRevertFile}
            />
          </div>
        ) : showLinkedList && !signedIn ? (
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
        ) : showLinkedList && signedIn && gitEntries.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t.notLinked}</p>
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
        ) : showDiskEmpty ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-white/10 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">{t.noFolderChosen}</p>
            <p className="text-xs text-muted-foreground">{t.noFolderChosenHint}</p>
            {isDiskFolderPickerSupported() ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePickFolder()}
                className="glass-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                <FolderOpen className="size-3.5" aria-hidden />
                {t.chooseFolder}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10">
            {listEntries.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {mode === "git" ? t.emptyGit : t.empty}
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
                        onContextMenu={(event) => openEntryMenu(event, entry)}
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

      {menu ? (
        <div
          ref={menuRef}
          className="fixed z-[320] min-w-[9rem] rounded-md border border-white/15 bg-background/95 p-1 shadow-lg backdrop-blur-sm"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/10"
            onClick={() => {
              const target = menu;
              setMenu(null);
              setNamePrompt({
                kind: "rename",
                id: target.id,
                title: target.title,
              });
            }}
          >
            <Pencil className="size-3.5" />
            {t.rename}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-600 hover:bg-white/10 dark:text-red-400"
            onClick={() => {
              const targetId = menu.id;
              setMenu(null);
              void handleDeleteDeck(targetId);
            }}
          >
            <Trash2 className="size-3.5" />
            {t.delete}
          </button>
        </div>
      ) : null}

      <NamePromptDialog
        open={namePrompt !== null}
        title={
          namePrompt?.kind === "rename" ? t.renamePrompt : t.newPresentation
        }
        label={namePrompt?.kind === "rename" ? undefined : t.namePrompt}
        initialValue={
          namePrompt?.kind === "rename"
            ? namePrompt.title
            : getDefaultPresentationFilename(language)
        }
        confirmLabel={
          namePrompt?.kind === "rename" ? t.renameConfirm : undefined
        }
        onCancel={() => setNamePrompt(null)}
        onConfirm={(name) => {
          if (namePrompt?.kind === "rename") {
            if (name.trim() === namePrompt.title) {
              setNamePrompt(null);
              return;
            }
            void handleRenameDeck(namePrompt.id, name);
            return;
          }
          void handleCreate(name);
        }}
      />
    </WorkspacePanel>
  );
}
