import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { readRepoFileBytes } from "@/lib/github/workingTree";

type ImagePreviewDialogProps = {
  open: boolean;
  path: string | null;
  deckHandle: FileSystemDirectoryHandle | null;
  onClose: () => void;
};

export function ImagePreviewDialog({
  open,
  path,
  deckHandle,
  onClose,
}: ImagePreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !path || !deckHandle) {
      setUrl(null);
      setError(null);
      return;
    }

    let revoked: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const bytes = await readRepoFileBytes(deckHandle, path);
        if (!bytes || cancelled) {
          if (!cancelled) setError("Could not load image.");
          return;
        }
        const lower = path.toLowerCase();
        const type = lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".gif")
            ? "image/gif"
            : lower.endsWith(".webp")
              ? "image/webp"
              : lower.endsWith(".svg")
                ? "image/svg+xml"
                : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
                  ? "image/jpeg"
                  : "application/octet-stream";
        const blob = new Blob([new Uint8Array(bytes)], { type });
        const objectUrl = URL.createObjectURL(blob);
        revoked = objectUrl;
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
        setError(null);
      } catch {
        if (!cancelled) setError("Could not load image.");
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, path, deckHandle]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !path) return null;

  const name = path.split("/").pop() ?? path;

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-[340] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={name}
          className="glass-panel glass-panel-dialog relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
            <p className="min-w-0 truncate text-sm font-semibold" title={path}>
              {name}
            </p>
            <button
              type="button"
              aria-label="Close"
              className="glass-toolbar-action inline-flex size-8 shrink-0 items-center justify-center rounded-md"
              onClick={onClose}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/20 p-4">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : url ? (
              <img
                src={url}
                alt={name}
                className="max-h-[min(75vh,720px)] max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
