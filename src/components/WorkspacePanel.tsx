import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DialogPortal } from "@/components/ui/dialog-portal";

type WorkspacePanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function WorkspacePanel({
  open,
  title,
  onClose,
  children,
}: WorkspacePanelProps) {
  if (!open) return null;

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="glass-panel glass-panel-dialog flex h-[min(480px,90vh)] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="glass-divider relative z-[1] flex shrink-0 items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-base font-semibold">{title}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
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
    </DialogPortal>
  );
}
