import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Github,
  LogOut,
  RefreshCw,
  Search,
} from "lucide-react";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { createRepo, getOrCreateSharedLibraryRepo, listRepos, SHARED_LIBRARY_REPO_NAME, type GithubRepo } from "@/lib/github/api";
import {
  getAuthStatus,
  githubDevicePoll,
  githubDeviceStart,
  refreshAuthStatus,
  signInWithAccessToken,
  signOut,
  type GithubAuthStatus,
} from "@/lib/github/auth";
import {
  clearDeckGithubLink,
  formatDeckGithubLinkLabel,
  getDeckGithubLink,
  isSharedLibraryRepo,
  linkForDeckRepo,
  pullDeckFromGithub,
  pushDeckToGithub,
  setDeckGithubLink,
  type DeckGithubLink,
  type PulledDeck,
} from "@/lib/github/deckSync";
import {
  createDeck,
  ensureBrowserLibraryRoot,
} from "@/lib/library/deckStorage";
import { getDefaultPresentationFilename } from "@/lib/presentationFilename";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

export type GitPanelVariant = "vcs" | "github";

type GitPanelProps = {
  open: boolean;
  onClose: () => void;
  variant: GitPanelVariant;
  deckId?: string | null;
  deckHandle?: FileSystemDirectoryHandle | null;
  deckTitle?: string;
  onOpenGithub?: () => void;
  onPulled?: (deck: PulledDeck) => void;
  /** Called after a repo is linked to a newly created (or existing) presentation. */
  onDeckLinked?: (deckId: string) => void;
};

const copy = {
  en: {
    githubTitle: "GitHub",
    gitTitle: "Git",
    signIn: "Sign in with GitHub",
    signInToken: "Use access token",
    tokenPlaceholder: "ghp_… or github_pat_…",
    tokenHelp:
      "Create a classic token with repo scope, or a fine-grained token with Contents read/write.",
    tokenSubmit: "Save token",
    signOut: "Sign out",
    waiting: "Waiting for authorization…",
    openGithub: "Open GitHub",
    userCode: "Enter this code on GitHub",
    signedInAs: "Signed in as",
    repos: "Your repositories",
    search: "Search repositories…",
    link: "Link",
    openRepo: "Open",
    linked: "Linked",
    createOptions: "Create repository",
    createCustom: "Custom repository",
    createCustomHint: "One presentation per repository. Choose a name and visibility.",
    createLibrary: "Shared library",
    createLibraryHint: `Use a private “${SHARED_LIBRARY_REPO_NAME}” repo for all slides (one folder each).`,
    createLibraryAction: `Use ${SHARED_LIBRARY_REPO_NAME}`,
    repoName: "Repository name",
    visibility: "Visibility",
    visibilityPrivate: "Private",
    visibilityPublic: "Public",
    createCustomAction: "Create & link",
    unlink: "Unlink",
    chooseRepo:
      "Choose a repository to open as a presentation, or create a new one.",
    noDeck: "Open a saved presentation to push or pull.",
    notSignedIn: "Sign in to GitHub first.",
    openGithubCta: "Open GitHub",
    notLinked: "Link a GitHub repository for this presentation.",
    linkInGithub: "Choose a repo in GitHub",
    branch: "Branch",
    commitMessage: "Commit message",
    commitPlaceholder: "Update presentation",
    push: "Push",
    pull: "Pull",
    refresh: "Refresh",
    pushing: "Pushing…",
    pulling: "Pulling…",
    pushOk: "Pushed to GitHub.",
    pullOk: "Pulled from GitHub.",
    noClientId:
      "Set VITE_GITHUB_CLIENT_ID in .env.local to enable GitHub sign-in.",
    createDeckFailed: "Could not create a local presentation for this repository.",
    emptyRepos: "No repositories found.",
  },
  zh: {
    githubTitle: "GitHub",
    gitTitle: "Git",
    signIn: "使用 GitHub 登录",
    signInToken: "使用访问令牌",
    tokenPlaceholder: "ghp_… 或 github_pat_…",
    tokenHelp: "创建带 repo 权限的经典令牌，或带 Contents 读写的细粒度令牌。",
    tokenSubmit: "保存令牌",
    signOut: "退出登录",
    waiting: "等待授权…",
    openGithub: "打开 GitHub",
    userCode: "在 GitHub 输入此代码",
    signedInAs: "已登录",
    repos: "你的仓库",
    search: "搜索仓库…",
    link: "关联",
    openRepo: "打开",
    linked: "已关联",
    createOptions: "创建仓库",
    createCustom: "自定义仓库",
    createCustomHint: "每个演示文稿一个仓库。可设置名称与公开/私有。",
    createLibrary: "共享文库",
    createLibraryHint: `使用私有 “${SHARED_LIBRARY_REPO_NAME}” 仓库存放全部幻灯片（每个演示一个文件夹）。`,
    createLibraryAction: `使用 ${SHARED_LIBRARY_REPO_NAME}`,
    repoName: "仓库名称",
    visibility: "可见性",
    visibilityPrivate: "私有",
    visibilityPublic: "公开",
    createCustomAction: "创建并关联",
    unlink: "取消关联",
    chooseRepo: "选择一个仓库作为演示文稿打开，或创建新仓库。",
    noDeck: "请先打开已保存的演示文稿再推送或拉取。",
    notSignedIn: "请先登录 GitHub。",
    openGithubCta: "打开 GitHub",
    notLinked: "为此演示文稿关联一个 GitHub 仓库。",
    linkInGithub: "在 GitHub 中选择仓库",
    branch: "分支",
    commitMessage: "提交说明",
    commitPlaceholder: "更新演示文稿",
    push: "推送",
    pull: "拉取",
    refresh: "刷新",
    pushing: "推送中…",
    pulling: "拉取中…",
    pushOk: "已推送到 GitHub。",
    pullOk: "已从 GitHub 拉取。",
    noClientId: "请在 .env.local 中设置 VITE_GITHUB_CLIENT_ID 以启用 GitHub 登录。",
    createDeckFailed: "无法为此仓库创建本地演示文稿。",
    emptyRepos: "未找到仓库。",
  },
} as const;

function defaultRepoName(title: string | undefined): string {
  const base = (title ?? "quick-slides")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "quick-slides";
}

export function GitPanel({
  open,
  onClose,
  variant,
  deckId = null,
  deckHandle = null,
  deckTitle,
  onOpenGithub,
  onPulled,
  onDeckLinked,
}: GitPanelProps) {
  const language = useLanguage();
  const t = copy[language];
  const isGithub = variant === "github";

  const [auth, setAuth] = useState<GithubAuthStatus>(() => getAuthStatus());
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [repoQuery, setRepoQuery] = useState("");
  const [link, setLink] = useState<DeckGithubLink | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCancelledRef = useRef(false);

  const clearPoll = useCallback(() => {
    pollCancelledRef.current = true;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const status = await refreshAuthStatus();
      setAuth(status);
      if (!status.signedIn) {
        setRepos([]);
        return;
      }
      const next = await listRepos();
      setRepos(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRepos([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      clearPoll();
      return;
    }
    setError(null);
    setInfo(null);
    setAuth(getAuthStatus());
    setLink(deckId ? getDeckGithubLink(deckId) : null);
    setNewRepoName(defaultRepoName(deckTitle));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    if (isGithub && getAuthStatus().signedIn) {
      void loadRepos();
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearPoll();
    };
  }, [open, onClose, clearPoll, deckId, deckTitle, isGithub, loadRepos]);

  const ensureDeckForLink = async (preferredTitle?: string): Promise<string> => {
    if (deckId) return deckId;
    const root = await ensureBrowserLibraryRoot();
    if (!root) throw new Error(t.createDeckFailed);
    const title =
      preferredTitle?.trim() || getDefaultPresentationFilename(language);
    const deck = await createDeck(root, title, language);
    return deck.folderName;
  };

  const startDeviceFlow = async () => {
    clearPoll();
    pollCancelledRef.current = false;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const start = await githubDeviceStart();
      setUserCode(start.userCode);
      setVerificationUri(start.verificationUri);
      setDeviceStatus(t.waiting);
      window.open(start.verificationUri, "_blank", "noopener,noreferrer");

      let intervalMs = Math.max(start.interval, 5) * 1000;

      const poll = async () => {
        if (pollCancelledRef.current) return;
        const result = await githubDevicePoll(start.deviceCode);
        if (pollCancelledRef.current) return;
        if (result.status === "signed_in") {
          setAuth(result.auth ?? { signedIn: true });
          setUserCode(null);
          setVerificationUri(null);
          setDeviceStatus(null);
          setBusy(false);
          await loadRepos();
          return;
        }
        if (result.status === "slow_down") {
          intervalMs += 5000;
          setDeviceStatus(t.waiting);
        } else if (result.status === "pending") {
          setDeviceStatus(t.waiting);
        } else {
          setError(result.message || result.status);
          setUserCode(null);
          setVerificationUri(null);
          setDeviceStatus(null);
          setBusy(false);
          return;
        }
        pollTimerRef.current = setTimeout(() => {
          void poll();
        }, intervalMs);
      };

      pollTimerRef.current = setTimeout(() => {
        void poll();
      }, intervalMs);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setError(text.includes("VITE_GITHUB_CLIENT_ID") ? t.noClientId : text);
      setBusy(false);
    }
  };

  const handleTokenSignIn = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const next = await signInWithAccessToken(tokenDraft);
      setAuth(next);
      setTokenDraft("");
      setShowTokenForm(false);
      await loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    clearPoll();
    signOut();
    setAuth({ signedIn: false });
    setRepos([]);
    setUserCode(null);
    setVerificationUri(null);
    setDeviceStatus(null);
  };

  const handleLink = async (repo: GithubRepo) => {
    setBusy(true);
    setError(null);
    try {
      const id = await ensureDeckForLink(
        isSharedLibraryRepo(repo)
          ? deckTitle || getDefaultPresentationFilename(language)
          : repo.name,
      );
      const next = linkForDeckRepo(repo, id);
      setDeckGithubLink(id, next);
      setLink(next);
      setInfo(`${t.linked}: ${formatDeckGithubLinkLabel(next)}`);
      onDeckLinked?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = () => {
    if (!deckId) return;
    clearDeckGithubLink(deckId);
    setLink(null);
  };

  const handleCreateCustomRepo = async () => {
    setBusy(true);
    setError(null);
    try {
      const name = newRepoName.trim() || defaultRepoName(deckTitle);
      if (name === SHARED_LIBRARY_REPO_NAME) {
        throw new Error(
          `Use “${t.createLibrary}” for the shared ${SHARED_LIBRARY_REPO_NAME} repository.`,
        );
      }
      const id = await ensureDeckForLink(name);
      const repo = await createRepo({
        name,
        privateRepo: newRepoPrivate,
        description: deckTitle
          ? `Quick Slides: ${deckTitle}`
          : `Quick Slides: ${name}`,
      });
      const next = linkForDeckRepo(repo, id);
      setDeckGithubLink(id, next);
      setLink(next);
      setInfo(`${t.linked}: ${formatDeckGithubLinkLabel(next)}`);
      await loadRepos();
      onDeckLinked?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUseSharedLibrary = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await ensureDeckForLink(
        deckTitle || getDefaultPresentationFilename(language),
      );
      const repo = await getOrCreateSharedLibraryRepo();
      const next = linkForDeckRepo(repo, id);
      setDeckGithubLink(id, next);
      setLink(next);
      setInfo(`${t.linked}: ${formatDeckGithubLinkLabel(next)}`);
      await loadRepos();
      onDeckLinked?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePush = async () => {
    if (!deckId || !deckHandle) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await pushDeckToGithub({
        deckId,
        deckHandle,
        message: message || undefined,
      });
      setInfo(t.pushOk);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePull = async () => {
    if (!deckId || !deckHandle) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const pulled = await pullDeckFromGithub({ deckId, deckHandle });
      onPulled?.(pulled);
      setInfo(t.pullOk);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const filteredRepos = repos.filter((repo) => {
    if (!repoQuery.trim()) return true;
    const q = repoQuery.trim().toLowerCase();
    return (
      repo.fullName.toLowerCase().includes(q) ||
      (repo.description?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <WorkspacePanel
      open={open}
      title={isGithub ? t.githubTitle : t.gitTitle}
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {error ? (
          <p className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="shrink-0 text-xs text-muted-foreground">{info}</p>
        ) : null}

        {isGithub ? (
          <>
            {!auth.signedIn && !userCode ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startDeviceFlow()}
                  className="glass-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Github className="size-4" aria-hidden />
                  {t.signIn}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowTokenForm((openForm) => !openForm)}
                  className="glass-toolbar-action inline-flex w-full items-center justify-center rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {t.signInToken}
                </button>
                {showTokenForm ? (
                  <div className="space-y-2 rounded-lg border border-white/10 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      {t.tokenHelp}
                    </p>
                    <input
                      type="password"
                      value={tokenDraft}
                      onChange={(event) => setTokenDraft(event.target.value)}
                      placeholder={t.tokenPlaceholder}
                      className="w-full rounded-md border border-white/15 bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      disabled={busy || !tokenDraft.trim()}
                      onClick={() => void handleTokenSignIn()}
                      className="glass-primary inline-flex w-full items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {t.tokenSubmit}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {userCode ? (
              <div className="space-y-2 rounded-lg border border-white/10 p-3">
                <p className="text-xs text-muted-foreground">{t.userCode}</p>
                <p className="font-mono text-2xl font-semibold tracking-widest">
                  {userCode}
                </p>
                {verificationUri ? (
                  <a
                    href={verificationUri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary underline"
                  >
                    {t.openGithub}
                  </a>
                ) : null}
                {deviceStatus ? (
                  <p className="text-xs text-muted-foreground">{deviceStatus}</p>
                ) : null}
              </div>
            ) : null}

            {auth.signedIn ? (
              <>
                <div className="flex shrink-0 items-center gap-2">
                  {auth.avatarUrl ? (
                    <img
                      src={auth.avatarUrl}
                      alt=""
                      className="size-7 rounded-full border border-white/20"
                    />
                  ) : (
                    <Github className="size-5" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.signedInAs} {auth.login}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="glass-toolbar-action inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] font-medium"
                  >
                    <LogOut className="size-3" aria-hidden />
                    {t.signOut}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void loadRepos()}
                    className="glass-toolbar-action inline-flex size-7 items-center justify-center rounded-md border border-white/15 disabled:opacity-50"
                    title={t.refresh}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                  </button>
                </div>

                {deckId && link ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs">
                    <span className="min-w-0 truncate font-medium">
                      {t.linked}: {formatDeckGithubLinkLabel(link)}
                    </span>
                    <button
                      type="button"
                      onClick={handleUnlink}
                      className="shrink-0 text-muted-foreground underline"
                    >
                      {t.unlink}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t.chooseRepo}</p>
                )}

                <div className="space-y-2 rounded-lg border border-white/10 p-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                    {t.createOptions}
                  </p>

                  <div className="space-y-2 rounded-md border border-white/10 p-2.5">
                    <p className="text-xs font-semibold">{t.createCustom}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.createCustomHint}
                    </p>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t.repoName}
                      </span>
                      <input
                        value={newRepoName}
                        onChange={(event) => setNewRepoName(event.target.value)}
                        placeholder={defaultRepoName(deckTitle)}
                        className="w-full rounded-md border border-white/15 bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t.visibility}
                      </span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setNewRepoPrivate(true)}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs font-semibold",
                            newRepoPrivate
                              ? "border-white/30 bg-white/12"
                              : "border-white/10 text-muted-foreground",
                          )}
                        >
                          {t.visibilityPrivate}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRepoPrivate(false)}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs font-semibold",
                            !newRepoPrivate
                              ? "border-white/30 bg-white/12"
                              : "border-white/10 text-muted-foreground",
                          )}
                        >
                          {t.visibilityPublic}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !newRepoName.trim()}
                      onClick={() => void handleCreateCustomRepo()}
                      className="glass-toolbar-action w-full rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {t.createCustomAction}
                    </button>
                  </div>

                  <div className="space-y-2 rounded-md border border-white/10 p-2.5">
                    <p className="text-xs font-semibold">{t.createLibrary}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.createLibraryHint}
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleUseSharedLibrary()}
                      className="glass-primary w-full rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {t.createLibraryAction}
                    </button>
                  </div>
                </div>

                <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {t.repos}
                </p>
                <div className="relative shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={repoQuery}
                    onChange={(event) => setRepoQuery(event.target.value)}
                    placeholder={t.search}
                    className="w-full rounded-md border border-white/15 bg-transparent py-1.5 pl-8 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10">
                  {filteredRepos.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      {busy ? "…" : t.emptyRepos}
                    </p>
                  ) : (
                    <ul className="divide-y divide-white/10">
                      {filteredRepos.map((repo) => {
                        const linkedHere =
                          Boolean(deckId) &&
                          link?.owner === repo.ownerLogin &&
                          link.repo === repo.name &&
                          (isSharedLibraryRepo(repo)
                            ? link.pathPrefix === deckId
                            : !link.pathPrefix);
                        return (
                          <li
                            key={repo.fullName}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {repo.fullName}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {repo.private ? "private" : "public"}
                                {isSharedLibraryRepo(repo) ? " · library" : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={busy || linkedHere}
                              onClick={() => void handleLink(repo)}
                              className={cn(
                                "shrink-0 rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold",
                                linkedHere
                                  ? "opacity-60"
                                  : "glass-toolbar-action",
                              )}
                            >
                              {linkedHere
                                ? t.linked
                                : deckId
                                  ? t.link
                                  : t.openRepo}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            {!auth.signedIn ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t.notSignedIn}</p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGithub?.();
                  }}
                  className="glass-primary inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                >
                  <Github className="size-4" aria-hidden />
                  {t.openGithubCta}
                </button>
              </div>
            ) : !deckId || !deckHandle ? (
              <p className="text-sm text-muted-foreground">{t.noDeck}</p>
            ) : !link ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t.notLinked}</p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGithub?.();
                  }}
                  className="glass-toolbar-action rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold"
                >
                  {t.linkInGithub}
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                  <p className="font-medium">{link.fullName}</p>
                  <p className="text-muted-foreground">
                    {t.branch}: {link.branch}
                  </p>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.commitMessage}
                  </span>
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={t.commitPlaceholder}
                    className="w-full rounded-md border border-white/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePull()}
                    className="glass-toolbar-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                    {busy ? t.pulling : t.pull}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePush()}
                    className="glass-primary inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    <ArrowUp className="size-3.5" aria-hidden />
                    {busy ? t.pushing : t.push}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </WorkspacePanel>
  );
}
