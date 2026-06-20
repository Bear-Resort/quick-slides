import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { useLanguage } from "@/lib/useLanguage";

const BEAR_RESORT_URL = "https://bear-resort.github.io/";

const copy = {
  en: {
    label: "Bear Resort",
    title: "A Bear Resort production",
    body: "Quick Slides is part of the Bear Resort ecosystem — playful tools and experiences from the resort.",
    visit: "Visit Bear Resort",
    close: "Close",
  },
  zh: {
    label: "小熊樂園",
    title: "小熊樂園出品",
    body: "Quick Slides 是小熊樂園生态的一部分 — 来自乐园的趣味工具与体验。",
    visit: "访问小熊樂園",
    close: "关闭",
  },
} as const;

type BearResortDialogProps = {
  open: boolean;
  onClose: () => void;
};

function BearResortDialog({ open, onClose }: BearResortDialogProps) {
  const language = useLanguage();
  const t = copy[language];

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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
          aria-labelledby="bear-resort-dialog-title"
          className="w-full max-w-sm rounded-xl border border-gray-300 bg-background p-6 shadow-lg dark:border-gray-700"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <img
              src="https://bear-resort.github.io/logos/default-bear.gif"
              alt=""
              className="h-12 w-12 shrink-0 object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t.close}
              title={t.close}
              className="shrink-0"
            >
              <X />
            </Button>
          </div>

          <h2 id="bear-resort-dialog-title" className="mt-4 text-lg font-bold">
            {t.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t.body}
          </p>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t.close}
            </Button>
            <Button asChild>
              <a href={BEAR_RESORT_URL} target="_blank" rel="noopener noreferrer">
                {t.visit}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}

export function Return() {
  const language = useLanguage();
  const t = copy[language];
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="slide-locate-btn gap-2">
        <img
          src="https://bear-resort.github.io/logos/default-bear.gif"
          alt=""
          className="h-6 w-6 object-contain"
        />
        {t.label}
      </Button>
      <BearResortDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
