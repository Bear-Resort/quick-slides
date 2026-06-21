import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { Button } from "@/components/ui/button";
import {
  listDeckImages,
  resolveDeckImageSrc,
  type DeckImageEntry,
} from "@/lib/library/deckImages";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    title: "Choose image",
    stored: "Images in this presentation",
    empty: "No images stored yet. Upload one to add it here.",
    uploadNew: "Upload new image",
    uploadFailed: "Could not store image",
    close: "Close",
    selectImage: "Select",
  },
  zh: {
    title: "选择图片",
    stored: "本演示文稿中的图片",
    empty: "还没有已保存的图片。上传后会显示在这里。",
    uploadNew: "上传新图片",
    uploadFailed: "无法保存图片",
    close: "关闭",
    selectImage: "选择",
  },
};

type EditorImagePickerDialogProps = {
  open: boolean;
  deckHandle: FileSystemDirectoryHandle;
  deckId: string;
  onClose: () => void;
  onSelect: (relativePath: string) => void;
  storeImage: (file: File) => Promise<string>;
};

function StoredImageTile({
  entry,
  previewUrl,
  label,
  onSelect,
}: {
  entry: DeckImageEntry;
  previewUrl: string;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={entry.fileName}
      aria-label={`${label}: ${entry.fileName}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-gray-300 bg-background",
        "transition-colors hover:border-primary hover:ring-2 hover:ring-primary/30",
        "dark:border-gray-700",
      )}
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-secondary/40 p-2">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <span className="truncate px-2 py-1.5 text-left text-xs text-muted-foreground group-hover:text-foreground">
        {entry.fileName}
      </span>
    </button>
  );
}

export function EditorImagePickerDialog({
  open,
  deckHandle,
  deckId,
  onClose,
  onSelect,
  storeImage,
}: EditorImagePickerDialogProps) {
  const language = useLanguage();
  const t = copy[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<DeckImageEntry[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const listed = await listDeckImages(deckHandle);
      if (cancelled) return;

      const previews = new Map<string, string>();
      await Promise.all(
        listed.map(async (entry) => {
          const url = await resolveDeckImageSrc(deckHandle, deckId, entry.relativePath);
          if (url) previews.set(entry.relativePath, url);
        }),
      );

      if (!cancelled) {
        setEntries(listed);
        setPreviewUrls(previews);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, deckHandle, deckId]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const relativePath = await storeImage(file);
      onSelect(relativePath);
      onClose();
    } catch {
      window.alert(t.uploadFailed);
    }
  };

  if (!open) return null;

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="editor-image-picker-title"
          className="flex max-h-[min(32rem,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-300 bg-background shadow-lg dark:border-gray-700"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 px-4 py-3 dark:border-gray-700">
            <h2 id="editor-image-picker-title" className="text-base font-semibold">
              {t.title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t.close}
              title={t.close}
            >
              <X />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.stored}
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground">…</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.empty}</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {entries.map((entry) => (
                  <StoredImageTile
                    key={entry.relativePath}
                    entry={entry}
                    previewUrl={previewUrls.get(entry.relativePath) ?? ""}
                    label={t.selectImage}
                    onSelect={() => {
                      onSelect(entry.relativePath);
                      onClose();
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-300 px-4 py-3 dark:border-gray-700">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleUpload(event)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden="true" />
              {t.uploadNew}
            </Button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}
