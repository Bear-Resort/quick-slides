import { Files, GitBranch, Github } from "lucide-react";
import { Return } from "@/components/Return";
import { HelpButton } from "@/components/HelpDialog";
import { Menu } from "@/components/Menu";
import { PresentationFilename } from "@/components/PresentationFilename";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    files: "Files",
    git: "Git",
    github: "GitHub",
    filesTitle: "Browse presentations in your library",
    gitTitle: "Push and pull this presentation",
    githubTitle: "Sign in to GitHub and link a repository",
  },
  zh: {
    files: "文件",
    git: "Git",
    github: "GitHub",
    filesTitle: "浏览本地库中的演示文稿",
    gitTitle: "推送与拉取此演示文稿",
    githubTitle: "登录 GitHub 并关联仓库",
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
  /** Editor document chrome in the top bar (quick-tex style). */
  document?: {
    title: string;
    onTitleChange: (title: string) => void;
  };
  workspace?: {
    openPanel: "files" | "vcs" | "github" | null;
    onOpenFiles: () => void;
    onOpenGit: () => void;
    onOpenGithub: () => void;
  };
};

export function Header({
  onLoadSample,
  hasEditorContent = false,
  document: doc,
  workspace,
}: HeaderProps) {
  const language = useLanguage();
  const t = copy[language];

  return (
    <div className="qs-toolbar-layer relative shrink-0 px-2 pt-2">
      <div className="glass-panel glass-chrome app-header-bar flex h-12 items-center justify-between gap-3 px-3">
        <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-3">
          {doc ? (
            <PresentationFilename
              value={doc.title}
              onChange={doc.onTitleChange}
              className="min-w-0"
            />
          ) : (
            <>
              <Return />
              <h1 className="text-lg font-bold tracking-tight">Quick Slides</h1>
            </>
          )}
        </div>
        <div className="relative z-[1] flex shrink-0 items-center gap-1">
          {workspace ? (
            <>
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
              <div className="mx-1 h-6 w-px bg-white/14" aria-hidden />
            </>
          ) : null}
          {onLoadSample && (
            <HelpButton
              onLoadSample={onLoadSample}
              hasEditorContent={hasEditorContent}
            />
          )}
          <Menu />
        </div>
      </div>
    </div>
  );
}
