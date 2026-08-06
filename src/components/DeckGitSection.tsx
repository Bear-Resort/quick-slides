import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Github,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getAuthStatus } from "@/lib/github/auth";
import { useToast } from "@/components/ui/toaster";
import {
  formatContentUpdateMessage,
  formatDeckGithubLinkLabel,
  getDeckGithubLink,
  pullDeckFromGithub,
  PushConflictError,
  pushDeckToGithub,
  type DeckGithubLink,
  type PulledDeck,
} from "@/lib/github/deckSync";
import {
  computeScmChanges,
  revertFileFromRemote,
  type ScmFileChange,
} from "@/lib/github/scmStatus";
import {
  clearStaged,
  getStagedPaths,
  stageAll,
  stagePath,
  unstageAll,
  unstagePath,
} from "@/lib/github/staging";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: {
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
    conflictHint:
      "Remote changed. Pull to take remote, or Force push to keep local.",
    staged: "Included for push",
    unstaged: "Changes",
    includeFile: "Include file",
    excludeFile: "Exclude",
    revertFile: "Revert file",
    includeAll: "Include all",
    excludeAll: "Exclude all",
    pushIncluded: "Push included",
    noChanges: "No changes — working tree clean.",
    toastError: "Error",
    toastSuccess: "Done",
    statusLetter: {
      modified: "M",
      untracked: "N",
      deleted: "D",
    },
  },
  zh: {
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
    conflictHint: "远程有变更。可拉取采用远程，或强制推送保留本地。",
    staged: "已纳入推送",
    unstaged: "更改",
    includeFile: "纳入文件",
    excludeFile: "取消纳入",
    revertFile: "还原文件",
    includeAll: "全部纳入",
    excludeAll: "全部取消",
    pushIncluded: "推送已纳入",
    noChanges: "没有更改 — 工作区干净。",
    toastError: "错误",
    toastSuccess: "完成",
    statusLetter: {
      modified: "M",
      untracked: "N",
      deleted: "D",
    },
  },
} as const;

type DeckGitSectionProps = {
  active: boolean;
  deckId: string | null;
  deckHandle: FileSystemDirectoryHandle | null;
  onOpenGithub?: () => void;
  onPulled?: (deck: PulledDeck) => void;
  onOpenFile?: (path: string) => void;
  onScmChanged?: () => void;
  scmEpoch?: number;
};

export function DeckGitSection({
  active,
  deckId,
  deckHandle,
  onOpenGithub,
  onPulled,
  onOpenFile,
  onScmChanged,
  scmEpoch = 0,
}: DeckGitSectionProps) {
  const language = useLanguage();
  const t = copy[language];
  const { toast } = useToast();
  const signedIn = getAuthStatus().signedIn;
  const [link, setLink] = useState<DeckGithubLink | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [scmChanges, setScmChanges] = useState<ScmFileChange[]>([]);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
  const [revertAllConfirmOpen, setRevertAllConfirmOpen] = useState(false);
  const [revertPathConfirm, setRevertPathConfirm] = useState<string | null>(
    null,
  );

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
    if (!active) return;
    setLink(deckId ? getDeckGithubLink(deckId) : null);
    void refreshScm();
  }, [active, deckId, refreshScm]);

  useEffect(() => {
    if (!active) return;
    void refreshScm();
  }, [active, scmEpoch, refreshScm]);

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
      for (const change of scmChanges) {
        await revertFileFromRemote({
          deckId,
          deckHandle,
          path: change.path,
        });
        unstagePath(deckId, change.path);
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

  if (!signedIn) {
    return (
      <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="text-xs text-muted-foreground">{t.notSignedIn}</p>
        <button
          type="button"
          onClick={() => onOpenGithub?.()}
          className="glass-primary inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
        >
          <Github className="size-3.5" aria-hidden />
          {t.openGithubCta}
        </button>
      </div>
    );
  }

  if (!deckId || !deckHandle) {
    return null;
  }

  if (!link) {
    return (
      <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="text-xs text-muted-foreground">{t.notLinked}</p>
        <button
          type="button"
          onClick={() => onOpenGithub?.()}
          className="glass-toolbar-action rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold"
        >
          {t.linkInGithub}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-white/10 pt-3">
      <div className="rounded-lg border border-white/10 px-3 py-2 text-xs">
        <p className="font-medium">{formatDeckGithubLinkLabel(link)}</p>
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
          {busy ? t.pulling : conflict ? t.pullMerge : t.pull}
        </button>
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

      {scmChanges.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.noChanges}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {(["staged", "unstaged"] as const).map((section) => {
            const rows =
              section === "staged"
                ? scmChanges.filter((c) => c.staged)
                : scmChanges.filter((c) => !c.staged);
            if (rows.length === 0 && section === "staged") return null;
            return (
              <div key={section} className="space-y-1">
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
                <ul className="max-h-36 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/10">
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
      )}

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
    </div>
  );
}
