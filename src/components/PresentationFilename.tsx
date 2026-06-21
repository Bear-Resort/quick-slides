import { useEffect, useRef, useState } from "react";
import {
  normalizePresentationFilename,
  setPresentationFilename,
} from "@/lib/presentationFilename";
import { useLanguage } from "@/lib/useLanguage";
import { usePresentationFilename } from "@/lib/usePresentationFilename";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    renameLabel: "Rename presentation",
    renameHint: "Click to rename",
  },
  zh: {
    renameLabel: "重命名演示文稿",
    renameHint: "点击重命名",
  },
};

export function PresentationFilename() {
  const language = useLanguage();
  const t = copy[language];
  const name = usePresentationFilename();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(name);
    }
  }, [name, editing]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = normalizePresentationFilename(draft, language);
    setPresentationFilename(next);
    setDraft(next);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        aria-label={t.renameLabel}
        className={cn(
          "w-full min-w-0 rounded-sm border border-transparent bg-transparent",
          "text-lg font-semibold text-foreground outline-none",
          "border-b border-primary/40 focus:border-primary",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={t.renameHint}
      aria-label={`${t.renameLabel}: ${name}`}
      className={cn(
        "w-full min-w-0 truncate rounded-sm py-0.5 text-left text-lg font-semibold text-foreground",
        "transition-colors hover:text-foreground/80 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {name}
    </button>
  );
}
