import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { Menu } from "@/components/Menu";
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
import { usesBrowserStorageLibrary } from "@/lib/library/browserLibrary";
import { getDefaultPresentationFilename } from "@/lib/presentationFilename";
import { useLanguage } from "@/lib/useLanguage";

const copy = {
  en: {
    title: "Your presentations",
    useDefault: `Use ${DEFAULT_LIBRARY_DISPLAY_PATH}`,
    useDefaultHint:
      "Creates ~/qs-slides automatically — no folder picker. Use “Choose another folder” if you want presentations saved to a real folder on disk.",
    browserStorageHint:
      "Presentations are saved in this browser’s local storage (not a visible folder on disk).",
    chooseOther: "Choose another folder",
    autoSetupFailed:
      "Could not create the default library. Safari Private Browsing disables local storage — try a normal window, or use Continue without saving.",
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
    loadFailed: "Could not load library. Try reconnecting your folder.",
    deleteFailed: "Could not delete presentation.",
    createFailed: "Could not create presentation.",
  },
  zh: {
    title: "你的演示文稿",
    useDefault: `使用 ${DEFAULT_LIBRARY_DISPLAY_PATH}`,
    useDefaultHint:
      "自动创建 ~/qs-slides，无需选择文件夹。若要将演示文稿保存到磁盘上的真实文件夹，请使用「选择其他文件夹」。",
    browserStorageHint: "演示文稿保存在本浏览器的本地存储中（不会在磁盘上显示为文件夹）。",
    chooseOther: "选择其他文件夹",
    autoSetupFailed:
      "无法创建默认库。Safari 私密浏览会禁用本地存储，请使用普通窗口，或选择「不保存，继续编辑」。",
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
    loadFailed: "无法加载库。请尝试重新连接文件夹。",
    deleteFailed: "无法删除演示文稿。",
    createFailed: "无法创建演示文稿。",
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
  const browserStorageOnly = usesBrowserStorageLibrary();

  const [decks, setDecks] = useState<LibraryIndexEntry[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryPath, setLibraryPath] = useState(DEFAULT_LIBRARY_DISPLAY_PATH);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bootstrapLibrary();
      setLibraryReady(result.connected);
      setLibraryPath(result.displayPath);
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
      const entries = await refreshLibraryIndex();
      setDecks(entries);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const handleUseDefault = async () => {
    const handle = await createAutoDefaultLibraryRoot();
    if (!handle) {
      window.alert(t.autoSetupFailed);
      return;
    }
    await connectFolder(handle, "default");
  };

  const handleChooseOther = async () => {
    const handle = await pickCustomLibraryRoot();
    await connectFolder(handle, "custom");
  };

  const handleNew = async () => {
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
      const deck = await createDeck(root, getDefaultPresentationFilename(language), language);
      navigate(`/edit/${deck.folderName}`);
    } catch {
      window.alert(t.createFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (folderName: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="app-header-bar sticky top-0 z-10 flex items-center justify-between border-b px-4 py-4">
        <h1 className="text-lg font-bold tracking-tight">Quick Slides</h1>
        <Menu />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">{t.title}</h2>
          <div className="flex flex-wrap gap-2">
            {librarySupported && libraryReady && (
              <>
                {diskPickerSupported && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleChooseOther()}
                    className="slide-locate-btn inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-background px-3 py-2 text-sm font-medium dark:border-gray-700"
                  >
                    <FolderOpen className="size-4" aria-hidden="true" />
                    {t.changeFolder}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleNew()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t.newPresentation}
                </button>
              </>
            )}
          </div>
        </div>

        {!librarySupported && (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
            {t.fsaUnsupported}
          </p>
        )}

        {librarySupported && !libraryReady && !browserStorageOnly && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <p className="text-sm text-muted-foreground">{t.useDefaultHint}</p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleUseDefault()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <FolderOpen className="size-4" aria-hidden="true" />
                {t.useDefault}
              </button>
              {diskPickerSupported && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleChooseOther()}
                  className="slide-locate-btn inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-background px-4 py-2 text-sm font-medium dark:border-gray-700"
                >
                  {t.chooseOther}
                </button>
              )}
            </div>
          </div>
        )}

        {librarySupported && !libraryReady && browserStorageOnly && !loading && (
          <p className="text-sm text-muted-foreground">{t.autoSetupFailed}</p>
        )}

        {libraryReady && browserStorageOnly && (
          <p className="text-xs text-muted-foreground">{t.browserStorageHint}</p>
        )}

        {libraryReady && (
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
                className="flex flex-col gap-3 rounded-xl border border-gray-300 bg-card p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700"
              >
                <div className="min-w-0 flex-1">
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
                <div className="flex shrink-0 gap-2">
                  <Link
                    to={`/edit/${deck.folderName}`}
                    className="slide-locate-btn inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium dark:border-gray-700"
                  >
                    {t.open}
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(deck.folderName)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 dark:border-red-800 dark:text-red-400"
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

        <div className="border-t border-gray-300 pt-6 dark:border-gray-700">
          <Link
            to="/edit"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.continueWithoutSaving}
          </Link>
        </div>
      </main>
    </div>
  );
}
