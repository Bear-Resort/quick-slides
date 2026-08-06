import { useEffect } from "react";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    cancel: "Cancel",
    confirm: "Confirm",
  },
  zh: {
    cancel: "取消",
    confirm: "确定",
  },
} as const;

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling for delete / force / revert confirms. */
  variant?: "default" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const language = useLanguage();
  const t = copy[language];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-[340] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
        onClick={onCancel}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={description ? "confirm-dialog-desc" : undefined}
          className="glass-panel glass-panel-dialog w-full max-w-sm rounded-xl border p-5 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="confirm-dialog-title" className="text-base font-semibold">
            {title}
          </h2>
          {description ? (
            <p
              id="confirm-dialog-desc"
              className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
            >
              {description}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="glass-toolbar-action rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold"
              onClick={onCancel}
            >
              {cancelLabel ?? t.cancel}
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold",
                variant === "danger"
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "glass-primary",
              )}
              onClick={onConfirm}
            >
              {confirmLabel ?? t.confirm}
            </button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
