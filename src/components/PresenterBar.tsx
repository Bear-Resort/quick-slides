import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Menu } from "@/components/Menu";
import { presenterUiCopy } from "@/lib/presenterUi";
import { useLanguage } from "@/lib/useLanguage";

type PresenterBarProps = {
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
};

export function PresenterBar({
  index,
  total,
  onPrevious,
  onNext,
  onExit,
}: PresenterBarProps) {
  const language = useLanguage();
  const t = presenterUiCopy[language];

  return (
    <div className="slide-frame-bar presenter-bar flex shrink-0 items-center gap-3 border-t px-4 py-4">
      <span className="slide-locate-btn shrink-0 rounded-md border px-3 py-1.5 text-sm font-semibold tabular-nums">
        {index + 1} / {total}
      </span>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        <button
          type="button"
          onClick={onPrevious}
          disabled={index === 0}
          className="slide-locate-btn inline-flex items-center gap-2 rounded border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
          {t.previous}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={index >= total - 1}
          className="slide-locate-btn inline-flex items-center gap-2 rounded border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.next}
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label={t.help}
          className="group relative slide-locate-btn inline-flex size-9 items-center justify-center rounded border text-sm font-bold"
        >
          <span>?</span>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-max max-w-xs whitespace-normal rounded-md border border-gray-300 bg-popover px-2 py-1.5 text-left text-xs font-normal text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-gray-700"
          >
            {t.hint}
          </span>
        </button>
        <Menu portalled={false} contentSide="top" />
        <button
          type="button"
          onClick={onExit}
          aria-label={t.exit}
          title={t.exit}
          className="slide-locate-btn inline-flex size-9 items-center justify-center rounded border"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
