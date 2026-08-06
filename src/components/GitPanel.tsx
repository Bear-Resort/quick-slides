import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  Github,
  LogOut,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { useToast } from "@/components/ui/toaster";
import {
  createRepo,
  getOrCreateSharedLibraryRepo,
  getPublicRepo,
  listRepos,
  SHARED_LIBRARY_REPO_NAME,
  type GithubRepo,
} from "@/lib/github/api";
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
  linkFromRepo,
  pullDeckFromGithub,
  formatContentUpdateMessage,
  PushConflictError,
  pushDeckToGithub,
  setDeckGithubLink,
  type DeckGithubLink,
  type PulledDeck,
} from "@/lib/github/deckSync";
import {
  clearStaged,
  getStagedPaths,
  stageAll,
  stagePath,
  unstageAll,
  unstagePath,
} from "@/lib/github/staging";
import {
  computeScmChanges,
  revertFileFromRemote,
  type ScmFileChange,
} from "@/lib/github/scmStatus";
import {
  createDeck,
  ensureBrowserLibraryRoot,
  loadDeck,
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
  onOpenFile?: (path: string) => void;
  onScmChanged?: () => void;
  /** Bump to force SCM refresh from the editor. */
  scmEpoch?: number;
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
    cancelAuth: "Cancel",
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
    commitMessage: "Commit message (optional)",
    commitPlaceholder: "Leave empty for Content update at MMDDYY HHMM",
    push: "Push staged",
    quickPush: "Quick push all",
    forcePush: "Force push",
    forceConfirm:
      "Force push overwrites the remote with your local files. Continue?",
    revertAll: "Revert all",
    revertAllConfirm:
      "Revert all local changes to match the remote? Local edits will be lost.",
    pull: "Pull",
    pullMerge: "Pull (take remote)",
    refresh: "Refresh",
    pushing: "Pushing…",
    pulling: "Pulling…",
    pushOk: "Pushed to GitHub.",
    pullOk: "Pulled from GitHub.",
    pullSkippedKeepLocal: "Linked. Kept your local files.",
    pullSkippedEmpty: "Linked. Remote has no files yet.",
    keepLocalTitle: "Keep local files?",
    keepLocalConfirm:
      "This presentation already has local files.\n\nKeep local — link only\nReplace — overwrite with the repository",
    keepLocal: "Keep local",
    replaceRemote: "Replace with remote",
    conflictHint:
      "Remote changed. Pull to take remote, or Force push to keep local.",
    noClientId:
      "Set VITE_GITHUB_CLIENT_ID in .env.local to enable GitHub sign-in.",
    createDeckFailed: "Could not create a local presentation for this repository.",
    emptyRepos: "No repositories found.",
    publicRepo: "Open public repository",
    publicRepoHint:
      "After signing in, load any public repo as read-only (owner/name). Sign-in is only for API rate limits — the deck stays read-only.",
    publicRepoPlaceholder: "owner/repo",
    publicRepoAction: "Open read-only",
    publicRepoOk: "Opened public repository (read-only).",
    publicRepoNeedSignIn: "Sign in first to open a public repository (GitHub API rate limits).",
    rateLimitHint:
      "GitHub API rate limit reached. Sign in (or wait) and try again — authenticated requests get a much higher limit.",
    readOnlyBadge: "Read-only",
    toastError: "Error",
    toastSuccess: "Done",
    changes: "Changes",
    staged: "Included for push",
    unstaged: "Changes",
    includeFile: "Include file",
    excludeFile: "Exclude",
    revertFile: "Revert file",
    includeAll: "Include all",
    excludeAll: "Exclude all",
    pushIncluded: "Push included",
    noChanges: "No changes — working tree clean.",
    statusLetter: {
      modified: "M",
      untracked: "N",
      deleted: "D",
    },
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
    cancelAuth: "取消",
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
    commitMessage: "提交说明（可选）",
    commitPlaceholder: "留空则使用 Content update at MMDDYY HHMM",
    push: "推送已纳入",
    quickPush: "一键推送全部",
    forcePush: "强制推送",
    forceConfirm: "强制推送会用本地文件覆盖远程，确定继续？",
    revertAll: "全部还原",
    revertAllConfirm: "将全部本地更改还原为远程版本？本地修改将丢失。",
    pull: "拉取",
    pullMerge: "拉取（采用远程）",
    refresh: "刷新",
    pushing: "推送中…",
    pulling: "拉取中…",
    pushOk: "已推送到 GitHub。",
    pullOk: "已从 GitHub 拉取。",
    pullSkippedKeepLocal: "已关联。已保留本地文件。",
    pullSkippedEmpty: "已关联。远程尚无文件。",
    keepLocalTitle: "保留本地文件？",
    keepLocalConfirm:
      "当前演示文稿已有本地文件。\n\n保留本地 — 仅关联\n替换 — 用仓库内容覆盖",
    keepLocal: "保留本地",
    replaceRemote: "用远程覆盖",
    conflictHint: "远程有变更。可拉取采用远程，或强制推送保留本地。",
    noClientId: "请在 .env.local 中设置 VITE_GITHUB_CLIENT_ID 以启用 GitHub 登录。",
    createDeckFailed: "无法为此仓库创建本地演示文稿。",
    emptyRepos: "未找到仓库。",
    publicRepo: "打开公开仓库",
    publicRepoHint:
      "登录后可以只读打开任意公开仓库（owner/name）。登录仅用于提高 API 限额，演示文稿仍为只读。",
    publicRepoPlaceholder: "owner/repo",
    publicRepoAction: "只读打开",
    publicRepoOk: "已打开公开仓库（只读）。",
    publicRepoNeedSignIn: "请先登录再打开公开仓库（受 GitHub API 速率限制）。",
    rateLimitHint:
      "已达到 GitHub API 速率限制。请先登录（或稍后再试）— 登录后限额更高。",
    readOnlyBadge: "只读",
    toastError: "错误",
    toastSuccess: "完成",
    changes: "更改",
    staged: "已纳入推送",
    unstaged: "更改",
    includeFile: "纳入文件",
    excludeFile: "取消纳入",
    revertFile: "还原文件",
    includeAll: "全部纳入",
    excludeAll: "全部取消",
    pushIncluded: "推送已纳入",
    noChanges: "没有更改 — 工作区干净。",
    statusLetter: {
      modified: "M",
      untracked: "N",
      deleted: "D",
    },
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
  onOpenFile,
  onScmChanged,
  scmEpoch = 0,
}: GitPanelProps) {
  const language = useLanguage();
  const t = copy[language];
  const { toast } = useToast();
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
  const [conflict, setConflict] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [createRepoOpen, setCreateRepoOpen] = useState(false);
  const [scmChanges, setScmChanges] = useState<ScmFileChange[]>([]);
  const [publicRepoDraft, setPublicRepoDraft] = useState("");
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
  const [revertAllConfirmOpen, setRevertAllConfirmOpen] = useState(false);
  const [revertPathConfirm, setRevertPathConfirm] = useState<string | null>(
    null,
  );
  const [keepLocalPrompt, setKeepLocalPrompt] = useState<{
    id: string;
    handle: FileSystemDirectoryHandle;
    next: DeckGithubLink;
  } | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCancelledRef = useRef(false);

  const showError = useCallback(
    (description: string) => {
      toast({ type: "error", title: t.toastError, description });
    },
    [toast, t.toastError],
  );

  const showInfo = useCallback(
    (description: string) => {
      toast({ type: "success", title: t.toastSuccess, description });
    },
    [toast, t.toastSuccess],
  );

  const clearPoll = useCallback(() => {
    pollCancelledRef.current = true;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setBusy(true);
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
      showError(err instanceof Error ? err.message : String(err));
      setRepos([]);
    } finally {
      setBusy(false);
    }
  }, [showError]);

  const refreshScm = useCallback(async () => {
    if (!deckId || !deckHandle || !getDeckGithubLink(deckId)) {
      setScmChanges([]);
      return;
    }
    try {
      const staged = getStagedPaths(deckId);
      const { changes } = await computeScmChanges({
        deckId,
        deckHandle,
        staged,
      });
      setScmChanges(changes);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  }, [deckId, deckHandle, showError]);

  useEffect(() => {
    if (!open) {
      clearPoll();
      return;
    }
    setCreateRepoOpen(false);
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
    if (!isGithub) {
      void refreshScm();
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearPoll();
    };
  }, [
    open,
    onClose,
    clearPoll,
    deckId,
    deckTitle,
    isGithub,
    loadRepos,
    refreshScm,
  ]);

  useEffect(() => {
    if (!open || isGithub) return;
    void refreshScm();
  }, [open, isGithub, scmEpoch, refreshScm]);

  const ensureDeckForLink = async (
    preferredTitle?: string,
  ): Promise<{
    id: string;
    handle: FileSystemDirectoryHandle;
    created: boolean;
  }> => {
    if (deckId && deckHandle) {
      return { id: deckId, handle: deckHandle, created: false };
    }
    if (deckId) {
      const root = await ensureBrowserLibraryRoot();
      if (!root) throw new Error(t.createDeckFailed);
      const deck = await loadDeck(root, deckId);
      if (!deck) throw new Error(t.createDeckFailed);
      return { id: deckId, handle: deck.handle, created: false };
    }
    const root = await ensureBrowserLibraryRoot();
    if (!root) throw new Error(t.createDeckFailed);
    const title =
      preferredTitle?.trim() || getDefaultPresentationFilename(language);
    const deck = await createDeck(root, title, language);
    return { id: deck.folderName, handle: deck.handle, created: true };
  };

  /** After linking: pull remote contents unless user keeps existing local files. */
  const finishLink = async (options: {
    id: string;
    handle: FileSystemDirectoryHandle;
    next: DeckGithubLink;
    created: boolean;
  }) => {
    const { id, handle, next, created } = options;
    setDeckGithubLink(id, next);
    setLink(next);

    const { listRemoteDeckFiles } = await import("@/lib/github/scmStatus");
    const remoteFiles = await listRemoteDeckFiles(next);

    if (remoteFiles.size === 0) {
      showInfo(`${t.linked}: ${formatDeckGithubLinkLabel(next)}. ${t.pullSkippedEmpty}`);
      onDeckLinked?.(id);
      return;
    }

    if (!created) {
      setKeepLocalPrompt({ id, handle, next });
      return;
    }

    showInfo(t.pulling);
    const pulled = await pullDeckFromGithub({ deckId: id, deckHandle: handle });
    if (!deckId || deckId === id) {
      onPulled?.(pulled);
    }
    showInfo(`${t.linked}: ${formatDeckGithubLinkLabel(next)}. ${t.pullOk}`);
    onDeckLinked?.(id);
  };

  const applyKeepLocalChoice = async (keepLocal: boolean) => {
    const pending = keepLocalPrompt;
    if (!pending) return;
    setKeepLocalPrompt(null);
    const { id, handle, next } = pending;
    if (keepLocal) {
      showInfo(
        `${t.linked}: ${formatDeckGithubLinkLabel(next)}. ${t.pullSkippedKeepLocal}`,
      );
      onDeckLinked?.(id);
      return;
    }
    setBusy(true);
    try {
      showInfo(t.pulling);
      const pulled = await pullDeckFromGithub({ deckId: id, deckHandle: handle });
      if (!deckId || deckId === id) {
        onPulled?.(pulled);
      }
      showInfo(`${t.linked}: ${formatDeckGithubLinkLabel(next)}. ${t.pullOk}`);
      onDeckLinked?.(id);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const startDeviceFlow = async () => {
    clearPoll();
    pollCancelledRef.current = false;
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
          showError(result.message || result.status);
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
      showError(text.includes("VITE_GITHUB_CLIENT_ID") ? t.noClientId : text);
      setBusy(false);
    }
  };

  const handleTokenSignIn = async () => {
    setBusy(true);
    try {
      const next = await signInWithAccessToken(tokenDraft);
      setAuth(next);
      setTokenDraft("");
      setShowTokenForm(false);
      await loadRepos();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
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

  const cancelDeviceFlow = () => {
    clearPoll();
    setUserCode(null);
    setVerificationUri(null);
    setDeviceStatus(null);
    setBusy(false);
  };

  const handleLink = async (repo: GithubRepo) => {
    setBusy(true);
    try {
      const { id, handle, created } = await ensureDeckForLink(
        isSharedLibraryRepo(repo)
          ? deckTitle || getDefaultPresentationFilename(language)
          : repo.name,
      );
      const next = linkForDeckRepo(repo, id);
      await finishLink({ id, handle, next, created });
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenPublicRepo = async () => {
    if (!auth.signedIn) {
      showError(t.publicRepoNeedSignIn);
      return;
    }
    const raw = publicRepoDraft.trim().replace(/^https?:\/\/github\.com\//i, "");
    const match = raw.match(/^([^/\s]+)\/([^/\s#?]+)/);
    if (!match) {
      showError(t.publicRepoPlaceholder);
      return;
    }
    const owner = match[1]!;
    const repoName = match[2]!.replace(/\.git$/i, "");
    setBusy(true);
    try {
      const repo = await getPublicRepo(owner, repoName);
      const root = await ensureBrowserLibraryRoot();
      if (!root) throw new Error(t.createDeckFailed);
      const deck = await createDeck(root, repo.name, language);
      const next = linkFromRepo(repo, { readOnly: true });
      await finishLink({
        id: deck.folderName,
        handle: deck.handle,
        next,
        created: true,
      });
      showInfo(t.publicRepoOk);
      setPublicRepoDraft("");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      showError(
        /rate limit/i.test(text) ? t.rateLimitHint : text,
      );
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
    try {
      const name = newRepoName.trim() || defaultRepoName(deckTitle);
      if (name === SHARED_LIBRARY_REPO_NAME) {
        throw new Error(
          `Use “${t.createLibrary}” for the shared ${SHARED_LIBRARY_REPO_NAME} repository.`,
        );
      }
      const { id, handle, created } = await ensureDeckForLink(name);
      const repo = await createRepo({
        name,
        privateRepo: newRepoPrivate,
        description: deckTitle
          ? `Quick Slides: ${deckTitle}`
          : `Quick Slides: ${name}`,
      });
      const next = linkForDeckRepo(repo, id);
      await finishLink({ id, handle, next, created });
      setCreateRepoOpen(false);
      await loadRepos();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUseSharedLibrary = async () => {
    setBusy(true);
    try {
      const { id, handle, created } = await ensureDeckForLink(
        deckTitle || getDefaultPresentationFilename(language),
      );
      const repo = await getOrCreateSharedLibraryRepo();
      const next = linkForDeckRepo(repo, id);
      await finishLink({ id, handle, next, created });
      setCreateRepoOpen(false);
      await loadRepos();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runPush = async (options: {
    paths?: string[];
    force?: boolean;
    useTimestampMessage?: boolean;
  }) => {
    if (!deckId || !deckHandle) return;
    setBusy(true);
    setConflict(false);
    try {
      const commitMessage = options.useTimestampMessage
        ? formatContentUpdateMessage()
        : message.trim() || formatContentUpdateMessage();
      await pushDeckToGithub({
        deckId,
        deckHandle,
        message: commitMessage,
        paths: options.paths,
        force: options.force,
      });
      clearStaged(deckId);
      showInfo(`${t.pushOk} (${commitMessage})`);
      await refreshScm();
      onScmChanged?.();
    } catch (err) {
      if (err instanceof PushConflictError) {
        setConflict(true);
        showError(`${t.conflictHint}\n${err.message}`);
      } else {
        showError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePushStaged = async () => {
    if (!deckId) return;
    const staged = [...getStagedPaths(deckId)];
    const paths = staged.length > 0 ? staged : undefined;
    await runPush({ paths, useTimestampMessage: !message.trim() });
  };

  const handleQuickPush = async () => {
    await runPush({ useTimestampMessage: true });
  };

  const handleForcePush = async () => {
    setForceConfirmOpen(true);
  };

  const confirmForcePush = async () => {
    setForceConfirmOpen(false);
    await runPush({
      force: true,
      useTimestampMessage: !message.trim(),
    });
  };

  const handleInclude = async (path: string) => {
    if (!deckId) return;
    stagePath(deckId, path);
    await refreshScm();
    onScmChanged?.();
  };

  const handleExclude = async (path: string) => {
    if (!deckId) return;
    unstagePath(deckId, path);
    await refreshScm();
    onScmChanged?.();
  };

  const handleRevert = async (path: string) => {
    setRevertPathConfirm(path);
  };

  const confirmRevertPath = async () => {
    const path = revertPathConfirm;
    if (!path || !deckId || !deckHandle) return;
    setRevertPathConfirm(null);
    setBusy(true);
    try {
      await revertFileFromRemote({ deckId, deckHandle, path });
      unstagePath(deckId, path);
      await refreshScm();
      onScmChanged?.();
      onOpenFile?.(path);
      showInfo(`${t.revertFile}: ${path}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRevertAll = async () => {
    setRevertAllConfirmOpen(true);
  };

  const confirmRevertAll = async () => {
    if (!deckId || !deckHandle) return;
    setRevertAllConfirmOpen(false);
    setBusy(true);
    try {
      const paths = scmChanges.map((c) => c.path);
      for (const path of paths) {
        await revertFileFromRemote({ deckId, deckHandle, path });
        unstagePath(deckId, path);
      }
      await refreshScm();
      onScmChanged?.();
      showInfo(t.revertAll);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePull = async () => {
    if (!deckId || !deckHandle) return;
    setBusy(true);
    setConflict(false);
    try {
      const pulled = await pullDeckFromGithub({ deckId, deckHandle });
      onPulled?.(pulled);
      showInfo(t.pullOk);
      await refreshScm();
      onScmChanged?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
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

  const isReadOnly = Boolean(link?.readOnly);

  return (
    <WorkspacePanel
      open={open}
      title={isGithub ? t.githubTitle : t.gitTitle}
      onClose={onClose}
      titleIcon={isGithub ? Github : GitBranch}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {isGithub ? (
          <>
            {!auth.signedIn && !userCode ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startDeviceFlow()}
                  className="glass-primary inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Github className="size-4" aria-hidden />
                  {t.signIn}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowTokenForm((openForm) => !openForm)}
                  className="glass-toolbar-action inline-flex w-full max-w-sm items-center justify-center rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {t.signInToken}
                </button>
                {showTokenForm ? (
                  <div className="w-full max-w-sm space-y-2 rounded-lg border border-white/10 p-3">
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
                <button
                  type="button"
                  onClick={cancelDeviceFlow}
                  className="glass-toolbar-action inline-flex w-full items-center justify-center rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold"
                >
                  {t.cancelAuth}
                </button>
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

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setNewRepoName(defaultRepoName(deckTitle));
                      setNewRepoPrivate(true);
                      setCreateRepoOpen(true);
                    }}
                    className="glass-toolbar-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {t.createOptions}
                  </button>
                </div>

                <div className="space-y-2 rounded-lg border border-white/10 p-3">
                  <p className="text-xs font-semibold">{t.publicRepo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.publicRepoHint}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={publicRepoDraft}
                      onChange={(event) => setPublicRepoDraft(event.target.value)}
                      placeholder={t.publicRepoPlaceholder}
                      className="min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleOpenPublicRepo();
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy || !publicRepoDraft.trim()}
                      onClick={() => void handleOpenPublicRepo()}
                      className="glass-toolbar-action shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                    >
                      {t.publicRepoAction}
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
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                <p className="text-center text-sm text-muted-foreground">
                  {t.notSignedIn}
                </p>
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
                  <p className="font-medium">
                    {formatDeckGithubLinkLabel(link)}
                    {isReadOnly ? (
                      <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t.readOnlyBadge}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground">
                    {t.branch}: {link.branch}
                  </p>
                </div>
                {!isReadOnly ? (
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
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePull()}
                    className="glass-toolbar-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                    {busy ? t.pulling : conflict ? t.pullMerge : t.pull}
                  </button>
                  {!isReadOnly ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePushStaged()}
                      className="glass-toolbar-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {busy
                        ? t.pushing
                        : scmChanges.some((c) => c.staged)
                          ? t.pushIncluded
                          : t.push}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void refreshScm()}
                    className="glass-toolbar-action inline-flex size-9 items-center justify-center rounded-lg border border-white/15 disabled:opacity-50"
                    title={t.refresh}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                  </button>
                </div>
                {!isReadOnly ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleQuickPush()}
                      className="glass-primary inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      <ArrowUp className="size-3.5" aria-hidden />
                      {busy ? t.pushing : t.quickPush}
                    </button>
                    <button
                      type="button"
                      disabled={busy || scmChanges.length === 0}
                      onClick={() => void handleRevertAll()}
                      className="glass-toolbar-action inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      {t.revertAll}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleForcePush()}
                      className="glass-toolbar-action inline-flex flex-1 items-center justify-center rounded-lg border border-amber-500/40 px-3 py-2 text-[11px] font-semibold text-amber-800 disabled:opacity-50 dark:text-amber-300"
                    >
                      {t.forcePush}
                    </button>
                  </div>
                ) : null}

                {!isReadOnly ? (
                  scmChanges.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.noChanges}</p>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    {(["staged", "unstaged"] as const).map((section) => {
                      const rows =
                        section === "staged"
                          ? scmChanges.filter((c) => c.staged)
                          : scmChanges.filter((c) => !c.staged);
                      if (rows.length === 0 && section === "staged") return null;
                      return (
                        <div key={section} className="min-h-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                              {section === "staged" ? t.staged : t.unstaged}
                            </p>
                            {section === "unstaged" ? (
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-muted-foreground underline"
                                onClick={() => {
                                  if (!deckId) return;
                                  stageAll(
                                    deckId,
                                    scmChanges.map((c) => c.path),
                                  );
                                  void refreshScm().then(() => onScmChanged?.());
                                }}
                              >
                                {t.includeAll}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-muted-foreground underline"
                                onClick={() => {
                                  if (!deckId) return;
                                  unstageAll(deckId);
                                  void refreshScm().then(() => onScmChanged?.());
                                }}
                              >
                                {t.excludeAll}
                              </button>
                            )}
                          </div>
                          <ul className="max-h-48 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/10">
                            {rows.length === 0 ? (
                              <li className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                                {t.noChanges}
                              </li>
                            ) : (
                              rows.map((change) => (
                                <li
                                  key={`${section}-${change.path}`}
                                  className="flex items-center gap-2 px-2 py-1.5"
                                >
                                  <span
                                    className={cn(
                                      "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                                      change.status === "untracked" &&
                                        "bg-emerald-500 text-white",
                                      change.status === "modified" &&
                                        "bg-amber-400 text-amber-950",
                                      change.status === "deleted" &&
                                        "bg-rose-500 text-white",
                                    )}
                                  >
                                    {t.statusLetter[change.status]}
                                  </span>
                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 truncate text-left text-xs font-medium hover:underline"
                                    onClick={() => onOpenFile?.(change.path)}
                                  >
                                    {change.path}
                                  </button>
                                  {section === "unstaged" ? (
                                    <button
                                      type="button"
                                      title={t.includeFile}
                                      className="glass-toolbar-action inline-flex size-6 items-center justify-center rounded border border-white/15"
                                      onClick={() => void handleInclude(change.path)}
                                    >
                                      <Plus className="size-3" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      title={t.excludeFile}
                                      className="glass-toolbar-action inline-flex size-6 items-center justify-center rounded border border-white/15"
                                      onClick={() => void handleExclude(change.path)}
                                    >
                                      <Minus className="size-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    title={t.revertFile}
                                    className="glass-toolbar-action inline-flex size-6 items-center justify-center rounded border border-white/15"
                                    onClick={() => void handleRevert(change.path)}
                                  >
                                    <RotateCcw className="size-3" />
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      {createRepoOpen ? (
        <DialogPortal>
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
            onClick={() => setCreateRepoOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-repo-title"
              className="glass-panel glass-panel-dialog relative z-[301] flex max-h-[min(90vh,560px)] w-full max-w-md flex-col overflow-hidden rounded-xl border shadow-lg"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") setCreateRepoOpen(false);
              }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <h2
                  id="create-repo-title"
                  className="text-sm font-semibold tracking-wide"
                >
                  {t.createOptions}
                </h2>
                <button
                  type="button"
                  onClick={() => setCreateRepoOpen(false)}
                  className="glass-close inline-flex size-7 items-center justify-center"
                  aria-label="Close"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                <div className="space-y-2 rounded-lg border border-white/10 p-3">
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
                      autoFocus
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

                <div className="space-y-2 rounded-lg border border-white/10 p-3">
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
            </div>
          </div>
        </DialogPortal>
      ) : null}

      <ConfirmDialog
        open={forceConfirmOpen}
        title={t.forcePush}
        description={t.forceConfirm}
        variant="danger"
        onCancel={() => setForceConfirmOpen(false)}
        onConfirm={() => void confirmForcePush()}
      />
      <ConfirmDialog
        open={revertAllConfirmOpen}
        title={t.revertAll}
        description={t.revertAllConfirm}
        variant="danger"
        onCancel={() => setRevertAllConfirmOpen(false)}
        onConfirm={() => void confirmRevertAll()}
      />
      <ConfirmDialog
        open={revertPathConfirm !== null}
        title={t.revertFile}
        description={
          revertPathConfirm
            ? `Revert “${revertPathConfirm}”? Local changes will be lost.`
            : undefined
        }
        variant="danger"
        onCancel={() => setRevertPathConfirm(null)}
        onConfirm={() => void confirmRevertPath()}
      />
      <ConfirmDialog
        open={keepLocalPrompt !== null}
        title={t.keepLocalTitle}
        description={t.keepLocalConfirm}
        confirmLabel={t.keepLocal}
        cancelLabel={t.replaceRemote}
        onCancel={() => void applyKeepLocalChoice(false)}
        onConfirm={() => void applyKeepLocalChoice(true)}
      />
    </WorkspacePanel>
  );
}
