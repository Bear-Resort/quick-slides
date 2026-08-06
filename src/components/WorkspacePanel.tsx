import { X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTitleIconFlight } from "@/components/FlyingTitleIcon";
import { Button } from "@/components/ui/button";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { cn } from "@/lib/utils";

type WorkspacePanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Larger dialog for combined file tree + git controls. */
  size?: "default" | "tall";
  /** Toolbar icon that flies into the title (Bear Resort style). */
  titleIcon?: LucideIcon;
};

export function WorkspacePanel({
  open,
  title,
  onClose,
  children,
  size = "default",
  titleIcon: TitleIcon,
}: WorkspacePanelProps) {
  const { panelShown, titleIcon, flightOverlay } = useTitleIconFlight({
    open,
    Icon: TitleIcon,
  });

  if (!open) return null;

  return (
    <DialogPortal>
      <div
        className={cn(
          "fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px] transition-opacity duration-[480ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          panelShown ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "glass-panel glass-panel-dialog flex w-full flex-col overflow-hidden rounded-xl border shadow-lg transition-opacity duration-[480ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            size === "tall"
              ? "h-[min(720px,92vh)] max-w-[460px]"
              : "h-[min(480px,90vh)] max-w-[420px]",
            panelShown ? "opacity-100" : "opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="glass-divider relative z-[1] flex shrink-0 items-center justify-between border-b px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {titleIcon}
              <h2 className="truncate text-base font-semibold">{title}</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="glass-close size-7 shrink-0"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 pt-3">
            {children}
          </div>
        </div>
      </div>
      {flightOverlay}
    </DialogPortal>
  );
}
