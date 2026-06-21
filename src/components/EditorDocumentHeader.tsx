import { Link } from "react-router-dom";
import { PresentationFilename } from "@/components/PresentationFilename";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

export type SaveStatus = "saved" | "saving" | "error" | null;

const copy = {
  en: {
    backToLibrary: "Library",
    saved: "Saved",
    saving: "Saving…",
    error: "Unable to save",
  },
  zh: {
    backToLibrary: "库",
    saved: "已保存",
    saving: "保存中…",
    error: "无法保存",
  },
};

type EditorDocumentHeaderProps = {
  title: string;
  onTitleChange: (title: string) => void;
  saveStatus: SaveStatus;
  onBack?: () => void;
};

export function EditorDocumentHeader({
  title,
  onTitleChange,
  saveStatus,
  onBack,
}: EditorDocumentHeaderProps) {
  const language = useLanguage();
  const t = copy[language];

  return (
    <div className="shrink-0 border-b border-gray-300 px-4 py-3 dark:border-gray-700">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          onClick={() => onBack?.()}
          className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← {t.backToLibrary}
        </Link>
        <PresentationFilename
          value={title}
          onChange={onTitleChange}
          className="min-w-0 flex-1"
        />
        {saveStatus && (
          <span
            className={cn(
              "shrink-0 text-xs",
              saveStatus === "error"
                ? "font-medium text-red-600 dark:text-red-400"
                : "text-muted-foreground",
            )}
          >
            {saveStatus === "saved"
              ? t.saved
              : saveStatus === "saving"
                ? t.saving
                : t.error}
          </span>
        )}
      </div>
    </div>
  );
}
