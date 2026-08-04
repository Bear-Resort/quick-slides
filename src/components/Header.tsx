import { Files, GitBranch, Github, Redo2, Undo2 } from "lucide-react";
import { Return } from "@/components/Return";
import { HelpButton } from "@/components/HelpDialog";
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
}: {
  icon: typeof Files;
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-active={active ? "true" : undefined}
      className={cn(
        "glass-toolbar-action inline-flex h-auto flex-col items-center gap-0.5 rounded-md px-2 py-1 text-foreground",
        active && "bg-white/10",
      )}
    >
      <Icon className="size-4" aria-hidden />
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
    onUndo?: () => void;
    onRedo?: () => void;
  };
};

function modePillClass(mode: WorkspaceMode): string {
  if (mode === "git") {
    return "bg-emerald-600 text-white border-emerald-500/40";
  }
  if (mode === "disk") {
    return "bg-sky-600 text-white border-sky-500/40";
  }
  return "bg-orange-500 text-white border-orange-400/40";
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
                  onClick={() => workspace.onUndo?.()}
                  className="glass-toolbar-action inline-flex size-8 items-center justify-center rounded-md text-foreground"
                >
                  <Undo2 className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  title={t.redo}
                  aria-label={t.redo}
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
                  "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-none",
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
          {onLoadSample ? (
            <>
              <Return iconOnly />
              <HelpButton
                onLoadSample={onLoadSample}
                hasEditorContent={hasEditorContent}
              />
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
