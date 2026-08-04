import { useEffect, useRef, useState } from "react";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { useLanguage } from "@/lib/useLanguage";

const copy = {
  en: {
    cancel: "Cancel",
    create: "Create",
  },
  zh: {
    cancel: "取消",
    create: "创建",
  },
} as const;

type NamePromptDialogProps = {
  open: boolean;
  title: string;
  label?: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

export function NamePromptDialog({
  open,
  title,
  label,
  initialValue = "",
  confirmLabel,
  onCancel,
  onConfirm,
}: NamePromptDialogProps) {
  const language = useLanguage();
  const t = copy[language];
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = () => {
    const next = value.trim();
    if (!next) return;
    onConfirm(next);
  };

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-[340] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
        onClick={onCancel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="name-prompt-title"
          className="glass-panel glass-panel-dialog w-full max-w-sm rounded-xl border p-5 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="name-prompt-title" className="text-base font-semibold">
            {title}
          </h2>
          {label ? (
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          ) : null}
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            className="mt-3 w-full rounded-md border border-white/15 bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="glass-toolbar-action rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold"
              onClick={onCancel}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={!value.trim()}
              className="glass-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              onClick={submit}
            >
              {confirmLabel ?? t.create}
            </button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
