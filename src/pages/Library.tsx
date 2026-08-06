import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NamePromptDialog } from "@/components/NamePromptDialog";
import {
  connectLibraryRoot,
  createDeck,
  deleteDeck,
  getLibraryRoot,
} from "@/lib/library/deckStorage";
import { refreshLibraryIndex } from "@/lib/library/libraryIndex";
import { bootstrapLibrary } from "@/lib/library/libraryBootstrap";
import type { LibraryIndexEntry } from "@/lib/library/deckFormat";
import {
  DEFAULT_LIBRARY_DISPLAY_PATH,
  getLibraryDisplayPath,
} from "@/lib/library/libraryPaths";
import {
  createAutoDefaultLibraryRoot,
  isDiskFolderPickerSupported,
  isLibrarySupported,
  pickCustomLibraryRoot,
} from "@/lib/library/fsAccess";
import { getDefaultPresentationFilename } from "@/lib/presentationFilename";
import { useLanguage } from "@/lib/useLanguage";

const copy = {
  en: {
    title: "Your presentations",
    browserStorageHint:
      "Presentations are saved in this browser’s local storage (not a visible folder on disk).",
    useLocalFolder: "Use local folder",
    newPresentation: "New presentation",
    continueWithoutSaving: "Continue without saving",
    open: "Open",
    delete: "Delete",
    deleteConfirm: "Delete this presentation? This removes its folder from your library.",
    created: "Created",
    lastOpened: "Last opened",
    empty: "No presentations yet. Create one to get started.",
    fsaUnsupported:
      "Local library requires a modern desktop browser with storage support. You can still use the editor without saving.",
    changeFolder: "Change library folder",
    libraryConnected: (path: string) => `Library folder: ${path}`,
    autoSetupFailed:
      "Could not set up browser storage. Safari Private Browsing disables local storage — try a normal window, or use Continue without saving.",
    loadFailed: "Could not load library. Try reconnecting your folder.",
    deleteFailed: "Could not delete presentation.",
    createFailed: "Could not create presentation.",
    namePrompt: "Presentation name",
  },
  zh: {
    title: "你的演示文稿",
    browserStorageHint: "演示文稿保存在本浏览器的本地存储中（不会在磁盘上显示为文件夹）。",
    useLocalFolder: "使用本地文件夹",
    newPresentation: "新建演示文稿",
    continueWithoutSaving: "不保存，继续编辑",
    open: "打开",
    delete: "删除",
    deleteConfirm: "删除此演示文稿？将从库文件夹中移除对应子文件夹。",
    created: "创建时间",
    lastOpened: "上次打开",
    empty: "还没有演示文稿。创建一个开始吧。",
    fsaUnsupported:
      "本地库需要支持存储的现代桌面浏览器。仍可使用编辑器（不保存到磁盘）。",
    changeFolder: "更换库文件夹",
    libraryConnected: (path: string) => `库文件夹：${path}`,
    autoSetupFailed:
      "无法设置浏览器存储。Safari 私密浏览会禁用本地存储，请使用普通窗口，或选择「不保存，继续编辑」。",
    loadFailed: "无法加载库。请尝试重新连接文件夹。",
    deleteFailed: "无法删除演示文稿。",
    createFailed: "无法创建演示文稿。",
    namePrompt: "演示文稿名称",
  },
};

function formatDate(iso: string, language: "en" | "zh"): string {
  try {
    return new Date(iso).toLocaleString(language === "zh" ? "zh-CN" : undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function Library() {
  const language = useLanguage();
  const t = copy[language];
  const navigate = useNavigate();
  const librarySupported = isLibrarySupported();
  const diskPickerSupported = isDiskFolderPickerSupported();

  const [decks, setDecks] = useState<LibraryIndexEntry[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryPath, setLibraryPath] = useState(DEFAULT_LIBRARY_DISPLAY_PATH);
  const [storageMode, setStorageMode] = useState<"disk" | "browser">("browser");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bootstrapLibrary();
      setLibraryReady(result.connected);
      setLibraryPath(result.displayPath);
      setStorageMode(result.storageMode);
      setDecks(result.decks);
    } catch {
      window.alert(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  const connectFolder = async (
    handle: FileSystemDirectoryHandle | null,
    preference: "default" | "custom",
  ) => {
    if (!handle) return false;
    setBusy(true);
    try {
      const ok = await connectLibraryRoot(handle, preference);
      if (!ok) return false;
      setLibraryReady(true);
      setLibraryPath(getLibraryDisplayPath(handle));
      setStorageMode(preference === "custom" ? "disk" : "browser");
      const entries = await refreshLibraryIndex();
      setDecks(entries);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const handleUseLocalFolder = async () => {
    const handle = await pickCustomLibraryRoot();
    await connectFolder(handle, "custom");
  };

  const handleNew = async (name: string) => {
    setNamePromptOpen(false);
    let root = await getLibraryRoot();
    if (!root) {
      const handle = await createAutoDefaultLibraryRoot();
      if (!handle) {
        window.alert(t.autoSetupFailed);
        return;
      }
      const connected = await connectFolder(handle, "default");
      if (!connected) return;
      root = await getLibraryRoot();
    }
    if (!root) return;

    setBusy(true);
    try {
      const deck = await createDeck(root, name.trim(), language);
      navigate(`/edit/${deck.folderName}`);
    } catch {
      window.alert(t.createFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (folderName: string) => {
    setDeleteConfirmId(folderName);
  };

  const confirmDelete = async () => {
    const folderName = deleteConfirmId;
    if (!folderName) return;
    setDeleteConfirmId(null);
    const root = await getLibraryRoot();
    if (!root) return;
    setBusy(true);
    try {
      await deleteDeck(root, folderName);
      await loadDecks();
    } catch {
      window.alert(t.deleteFailed);
    } finally {
      setBusy(false);
    }
  };

  const showLocalFolderButton = librarySupported && diskPickerSupported;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Header />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">{t.title}</h2>
          <div className="flex flex-wrap gap-2">
            {showLocalFolderButton && (
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void handleUseLocalFolder()}
                className="slide-locate-btn glass-toolbar-action inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                <FolderOpen className="size-4" aria-hidden="true" />
                {storageMode === "disk" ? t.changeFolder : t.useLocalFolder}
              </button>
            )}
            {librarySupported && libraryReady && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setNamePromptOpen(true)}
                className="glass-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
              >
                <Plus className="size-4" aria-hidden="true" />
                {t.newPresentation}
              </button>
            )}
          </div>
        </div>

        {!librarySupported && (
          <p className="glass-panel rounded-lg border px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            {t.fsaUnsupported}
          </p>
        )}

        {librarySupported && !libraryReady && !loading && (
          <p className="text-sm text-muted-foreground">{t.autoSetupFailed}</p>
        )}

        {libraryReady && storageMode === "browser" && (
          <p className="text-xs text-muted-foreground">{t.browserStorageHint}</p>
        )}

        {libraryReady && storageMode === "disk" && (
          <p className="text-xs text-muted-foreground">{t.libraryConnected(libraryPath)}</p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : decks.length === 0 && libraryReady ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {decks.map((deck) => (
              <li
                key={deck.folderName}
                className="glass-panel flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="relative z-[1] min-w-0 flex-1">
                  <div className="truncate text-base font-semibold">{deck.title}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t.created}: {formatDate(deck.createdAt, language)}
                    </span>
                    <span>
                      {t.lastOpened}: {formatDate(deck.lastOpenedAt, language)}
                    </span>
                  </div>
                </div>
                <div className="relative z-[1] flex shrink-0 gap-2">
                  <Link
                    to={`/edit/${deck.folderName}`}
                    className="slide-locate-btn glass-toolbar-action inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium"
                  >
                    {t.open}
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(deck.folderName)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-400/40 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400"
                    aria-label={t.delete}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="glass-divider border-t pt-6">
          <Link
            to="/edit"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.continueWithoutSaving}
          </Link>
        </div>
      </main>

      <NamePromptDialog
        open={namePromptOpen}
        title={t.newPresentation}
        label={t.namePrompt}
        initialValue={getDefaultPresentationFilename(language)}
        onCancel={() => setNamePromptOpen(false)}
        onConfirm={(name) => void handleNew(name)}
      />
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title={t.delete}
        description={t.deleteConfirm}
        variant="danger"
        confirmLabel={t.delete}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
