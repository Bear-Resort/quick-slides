import { useLanguage } from "@/lib/useLanguage";
import type { CharRangePosition } from "@/lib/editorInsert";
import { EDITOR_PLACEHOLDER_LABELS } from "@/lib/editorPlaceholders";
import { EditorPlaceholderChip } from "@/components/EditorPlaceholderChip";
import type { ImageUploadSlot } from "@/lib/editorInsert";
import { storeEditorImage } from "@/lib/editorImages";
import { useRef } from "react";

const copy = {
  en: {
    upload: EDITOR_PLACEHOLDER_LABELS.url,
    uploadFailed: "Could not store image",
  },
  zh: {
    upload: "上传",
    uploadFailed: "无法保存图片",
  },
} as const;

type EditorImageUploadButtonsProps = {
  slots: ImageUploadSlot[];
  positions: Map<number, CharRangePosition>;
  onUpload: (slot: ImageUploadSlot, url: string) => void;
  onPrepareUpload?: () => void;
};

export function EditorImageUploadButtons({
  slots,
  positions,
  onUpload,
  onPrepareUpload,
}: EditorImageUploadButtonsProps) {
  const language = useLanguage();
  const t = copy[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<ImageUploadSlot | null>(null);

  const openFilePicker = (slot: ImageUploadSlot) => {
    onPrepareUpload?.();
    pendingSlotRef.current = slot;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const slot = pendingSlotRef.current;
    pendingSlotRef.current = null;
    if (!file || !slot) return;

    try {
      const url = await storeEditorImage(file);
      onUpload(slot, url);
    } catch {
      window.alert(t.uploadFailed);
    }
  };

  if (slots.length === 0) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
      {slots.map((slot) => {
        const position = positions.get(slot.parenStart);
        if (!position) return null;

        return (
          <EditorPlaceholderChip
            key={slot.parenStart}
            variant="url"
            label={t.upload}
            ariaLabel={t.upload}
            position={position}
            onClick={() => openFilePicker(slot)}
          />
        );
      })}
    </>
  );
}
