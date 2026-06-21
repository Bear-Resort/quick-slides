import { useRef, useState } from "react";
import { useLanguage } from "@/lib/useLanguage";
import type { CharRangePosition } from "@/lib/editorInsert";
import { EDITOR_PLACEHOLDER_LABELS } from "@/lib/editorPlaceholders";
import { EditorPlaceholderChip } from "@/components/EditorPlaceholderChip";
import { EditorImagePickerDialog } from "@/components/EditorImagePickerDialog";
import type { ImageUploadSlot } from "@/lib/editorInsert";
import { storeEditorImage } from "@/lib/editorImages";
import { useDeckContext } from "@/context/DeckContext";

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
  const { storeImage, mode, handle, folderName } = useDeckContext();
  const isLibraryDeck = mode === "library" && handle && folderName;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<ImageUploadSlot | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openUpload = (slot: ImageUploadSlot) => {
    onPrepareUpload?.();
    pendingSlotRef.current = slot;

    if (isLibraryDeck) {
      setPickerOpen(true);
      return;
    }

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

  const handlePickerSelect = (relativePath: string) => {
    const slot = pendingSlotRef.current;
    pendingSlotRef.current = null;
    if (!slot) return;
    onUpload(slot, relativePath);
  };

  const handlePickerClose = () => {
    setPickerOpen(false);
    pendingSlotRef.current = null;
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
      {isLibraryDeck && (
        <EditorImagePickerDialog
          open={pickerOpen}
          deckHandle={handle}
          deckId={folderName}
          onClose={handlePickerClose}
          onSelect={handlePickerSelect}
          storeImage={storeImage}
        />
      )}
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
            onClick={() => openUpload(slot)}
          />
        );
      })}
    </>
  );
}
