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
import { createRepo, listRepos, type GithubRepo } from "@/lib/github/api";
import {
  getAuthStatus,
  githubDevicePoll,
  githubDeviceStart,
  refreshAuthStatus,
  signOut,
  type GithubAuthStatus,
} from "@/lib/github/auth";
import {
  clearDeckGithubLink,
  getDeckGithubLink,
  linkFromRepo,
  pullDeckFromGithub,
  pushDeckToGithub,
  setDeckGithubLink,
  type DeckGithubLink,
  type PulledDeck,
} from "@/lib/github/deckSync";
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
};

const copy = {
  en: {
    githubTitle: "GitHub",
    gitTitle: "Git",
    signIn: "Sign in with GitHub",
    signOut: "Sign out",
    waiting: "Waiting for authorization…",
    openGithub: "Open GitHub",
    userCode: "Enter this code on GitHub",
    signedInAs: "Signed in as",
    repos: "Your repositories",
    search: "Search repositories…",
    link: "Link",
    linked: "Linked",
    createRepo: "Create repo & link",
    unlink: "Unlink",
    noDeck: "Open a saved presentation to link a repository.",
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
    noClientId: "Set VITE_GITHUB_CLIENT_ID in .env.local to enable GitHub sign-in.",
  },
  zh: {
    githubTitle: "GitHub",
    gitTitle: "Git",
    signIn: "使用 GitHub 登录",
    signOut: "退出登录",
    waiting: "等待授权…",
    openGithub: "打开 GitHub",
    userCode: "在 GitHub 输入此代码",
    signedInAs: "已登录",
    repos: "你的仓库",
    search: "搜索仓库…",
    link: "关联",
    linked: "已关联",
    createRepo: "创建仓库并关联",
    unlink: "取消关联",
    noDeck: "请先打开已保存的演示文稿再关联仓库。",
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
  }, [open, onClose, clearPoll, deckId, isGithub, loadRepos]);

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
      setError(
        text.includes("VITE_GITHUB_CLIENT_ID") ? t.noClientId : text,
      );
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

  const handleLink = (repo: GithubRepo) => {
    if (!deckId) return;
    const next = linkFromRepo(repo);
    setDeckGithubLink(deckId, next);
    setLink(next);
    setInfo(`${t.linked}: ${next.fullName}`);
  };

  const handleUnlink = () => {
    if (!deckId) return;
    clearDeckGithubLink(deckId);
    setLink(null);
  };

  const handleCreateAndLink = async () => {
    if (!deckId) return;
    setBusy(true);
    setError(null);
    try {
      const repo = await createRepo({
        name: defaultRepoName(deckTitle),
        privateRepo: true,
        description: deckTitle ? `Quick Slides: ${deckTitle}` : undefined,
      });
      handleLink(repo);
      await loadRepos();
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
              <button
                type="button"
                disabled={busy}
                onClick={() => void startDeviceFlow()}
                className="glass-primary inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                <Github className="size-4" aria-hidden />
                {t.signIn}
              </button>
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

                {!deckId ? (
                  <p className="text-xs text-muted-foreground">{t.noDeck}</p>
                ) : (
                  <>
                    {link ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs">
                        <span className="min-w-0 truncate font-medium">
                          {t.linked}: {link.fullName}
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
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleCreateAndLink()}
                        className="glass-toolbar-action rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        {t.createRepo}
                      </button>
                    )}

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
                      <ul className="divide-y divide-white/10">
                        {filteredRepos.map((repo) => {
                          const isLinked =
                            link?.fullName === repo.fullName ||
                            (link?.owner === repo.ownerLogin &&
                              link?.repo === repo.name);
                          return (
                            <li
                              key={repo.fullName}
                              className="flex items-center justify-between gap-2 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {repo.fullName}
                                </p>
                                {repo.private ? (
                                  <p className="text-[10px] text-muted-foreground">
                                    private
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                disabled={busy || isLinked}
                                onClick={() => handleLink(repo)}
                                className={cn(
                                  "shrink-0 rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold",
                                  isLinked
                                    ? "opacity-60"
                                    : "glass-toolbar-action",
                                )}
                              >
                                {isLinked ? t.linked : t.link}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                )}
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
