import { useRef } from "react";
import {
  Files,
  GitBranch,
  Github,
  Loader2,
  Redo2,
  Save,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { EnergySaveBadge } from "@/components/EnergySaveBadge";
import { setPanelIconTrigger } from "@/components/FlyingTitleIcon";
import { Return } from "@/components/Return";
import { HelpButton, AiInstructionsButton } from "@/components/HelpDialog";
import { Menu } from "@/components/Menu";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

export type WorkspaceMode = "browser" | "disk" | "git";

const copy = {
  en: {
    files: "Files",
    git: "Git",
    github: "GitHub",
    filesTitle: "Browse presentations in your library",
    gitTitle: "Push and pull this presentation",
    githubTitle: "Sign in to GitHub and link a repository",
    quickPush: "Quick push",
    quickPushTitle: "Quick push all changes to GitHub",
    quickPushBusy: "Pushing…",
    quickPushNoChanges: "No changes to push",
    undo: "Undo",
    redo: "Redo",
    modeBrowser: "localStorage",
    modeDisk: "Local Repository",
    modeGit: "Git Project",
  },
  zh: {
    files: "文件",
    git: "Git",
    github: "GitHub",
    filesTitle: "浏览本地库中的演示文稿",
    gitTitle: "推送与拉取此演示文稿",
    githubTitle: "登录 GitHub 并关联仓库",
    quickPush: "推送",
    quickPushTitle: "一键推送全部更改到 GitHub",
    quickPushBusy: "推送中…",
    quickPushNoChanges: "没有可推送的更改",
    undo: "撤销",
    redo: "重做",
    modeBrowser: "本地存储",
    modeDisk: "本地仓库",
    modeGit: "Git 项目",
  },
};

function ToolbarAction({
  icon: Icon,
  label,
  title,
  onClick,
  active,
  disabled,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const iconRef = useRef<SVGSVGElement>(null);
  return (
    <button
      type="button"
      onClick={() => {
        setPanelIconTrigger(iconRef.current);
        onClick();
      }}
      title={title}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      data-active={active ? "true" : undefined}
      className="glass-toolbar-action inline-flex h-auto flex-col items-center gap-0.5 rounded-md px-2 py-1 text-foreground"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Icon ref={iconRef} className="size-4" aria-hidden />
      )}
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}

type HeaderProps = {
  onLoadSample?: () => void;
  hasEditorContent?: boolean;
  workspace?: {
    mode: WorkspaceMode;
    /** Repository / folder name; empty for localStorage. */
    repositoryName?: string;
    openPanel: "files" | "vcs" | "github" | null;
    onOpenFiles: () => void;
    onOpenGit: () => void;
    onOpenGithub: () => void;
    onQuickPush?: () => void;
    quickPushBusy?: boolean;
    canQuickPush?: boolean;
    /** Linked to GitHub but working tree is clean. */
    quickPushClean?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
  };
};

function modePillClass(mode: WorkspaceMode): string {
  if (mode === "git") {
    return "bg-emerald-600 text-white";
  }
  if (mode === "disk") {
    return "bg-sky-600 text-white";
  }
  return "bg-orange-500 text-white";
}

export function Header({
  onLoadSample,
  hasEditorContent = false,
  workspace,
}: HeaderProps) {
  const language = useLanguage();
  const t = copy[language];

  const modeLabel =
    workspace?.mode === "git"
      ? t.modeGit
      : workspace?.mode === "disk"
        ? t.modeDisk
        : t.modeBrowser;

  return (
    <div className="qs-toolbar-layer relative shrink-0 px-2 pt-2">
      <div className="glass-panel glass-chrome app-header-bar flex h-12 items-center justify-between gap-3 px-3">
        <div className="relative z-[1] flex min-w-0 shrink-0 items-center gap-2">
          {workspace ? (
            <>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  title={t.undo}
                  aria-label={t.undo}
                  disabled={!workspace.canUndo}
                  onClick={() => workspace.onUndo?.()}
                  className="glass-toolbar-action inline-flex size-8 items-center justify-center rounded-md text-foreground"
                >
                  <Undo2 className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  title={t.redo}
                  aria-label={t.redo}
                  disabled={!workspace.canRedo}
                  onClick={() => workspace.onRedo?.()}
                  className="glass-toolbar-action inline-flex size-8 items-center justify-center rounded-md text-foreground"
                >
                  <Redo2 className="size-3.5" aria-hidden />
                </button>
              </div>

              {workspace.repositoryName ? (
                <p
                  className="max-w-[12rem] truncate text-sm font-semibold tracking-tight text-foreground"
                  title={workspace.repositoryName}
                >
                  {workspace.repositoryName}
                </p>
              ) : null}

              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none",
                  modePillClass(workspace.mode),
                )}
              >
                {modeLabel}
              </span>

              <ToolbarAction
                icon={Files}
                label={t.files}
                title={t.filesTitle}
                active={workspace.openPanel === "files"}
                onClick={workspace.onOpenFiles}
              />
              <ToolbarAction
                icon={GitBranch}
                label={t.git}
                title={t.gitTitle}
                active={workspace.openPanel === "vcs"}
                onClick={workspace.onOpenGit}
              />
              {workspace.mode === "git" ? (
                <ToolbarAction
                  icon={Save}
                  label={
                    workspace.quickPushBusy ? t.quickPushBusy : t.quickPush
                  }
                  title={
                    workspace.quickPushClean
                      ? t.quickPushNoChanges
                      : t.quickPushTitle
                  }
                  loading={workspace.quickPushBusy}
                  disabled={
                    workspace.quickPushBusy ||
                    workspace.canQuickPush === false ||
                    !workspace.onQuickPush
                  }
                  onClick={() => workspace.onQuickPush?.()}
                />
              ) : null}
              <ToolbarAction
                icon={Github}
                label={t.github}
                title={t.githubTitle}
                active={workspace.openPanel === "github"}
                onClick={workspace.onOpenGithub}
              />
            </>
          ) : (
            <>
              <Return />
              <h1 className="text-lg font-bold tracking-tight">Quick Slides</h1>
            </>
          )}
        </div>

        <div className="relative z-[1] flex shrink-0 items-center gap-1">
          <EnergySaveBadge />
          {onLoadSample ? (
            <>
              <Return iconOnly />
              <HelpButton
                onLoadSample={onLoadSample}
                hasEditorContent={hasEditorContent}
              />
              <AiInstructionsButton />
            </>
          ) : null}
          <Menu
            showLocalAutosave={
              !workspace ||
              workspace.mode === "browser" ||
              workspace.mode === "disk"
            }
          />
        </div>
      </div>
    </div>
  );
}
